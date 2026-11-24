import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { assertLoanAdmin } from "$lib/server/route-auth";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { parseIdParam } from "$lib/server/route-params";
import { publicJsonError } from "$lib/server/http-error";
import { recordMoneyAudit } from "$lib/server/money-audit";
import {
  claimIdempotencyKey,
  findIdempotentResponse,
  idempotencyKeyOf,
  rememberIdempotentResponse,
} from "$lib/server/idempotency";
import { idempotencyKeys } from "$lib/server/db/schema";
import { loanStatusSchema, firstSchemaError } from "$lib/schemas/payment";
import { syncLoanStatusFromInterestPeriods } from "$lib/server/loan-interest-period-sync";
import { toCentavos } from "$lib/money/centavos";

/**
 * Manual status change (D-7). The only override allowed is Completed, and it
 * requires a reason. Derived statuses are recomputed by the engine; use
 * `PATCH` with `{ status: "auto" }` to clear the override.
 */
export const PATCH: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = parseIdParam(params.id);
    if (loanId === null) {
      return json({ error: "Invalid loan id" }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = loanStatusSchema.safeParse(body);
    if (!parsedBody.success) {
      return json(
        { error: firstSchemaError(parsedBody.error) },
        { status: 400 },
      );
    }

    const status = typeof body.status === "string" ? body.status : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (status !== "Completed" && status !== "auto") {
      return json(
        {
          error:
            "Only a manual Completed status is allowed. Other statuses are derived from payments.",
        },
        { status: 400 },
      );
    }
    if (status === "Completed" && !reason) {
      return json(
        { error: "Add a reason for completing this loan." },
        { status: 400 },
      );
    }

    const authError = await assertLoanAdmin(loanId, userId);
    if (authError) return authError;

    const idempotencyKey = idempotencyKeyOf(request);
    const idempotencyRoute = `PATCH /api/loans/${loanId}/status`;
    if (idempotencyKey) {
      const replay = await findIdempotentResponse(
        idempotencyKey,
        userId,
        idempotencyRoute,
      );
      if (replay) {
        return json(replay.body as Record<string, unknown>, {
          status: replay.status,
        });
      }
    }

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      columns: {
        id: true,
        loanName: true,
        status: true,
        statusOverride: true,
        statusReason: true,
        completedAt: true,
        waivedAmount: true,
      },
    });
    if (!loan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const now = new Date();
    const waived =
      body.waivedAmount == null || body.waivedAmount === ""
        ? null
        : String(toCentavos(body.waivedAmount) / 100);

    if (idempotencyKey) {
      const claimed = await claimIdempotencyKey(
        idempotencyKey,
        userId,
        idempotencyRoute,
      );
      if (!claimed) {
        const replay = await findIdempotentResponse(
          idempotencyKey,
          userId,
          idempotencyRoute,
        );
        return replay
          ? json(replay.body as Record<string, unknown>, {
              status: replay.status,
            })
          : json(
              { error: "This request is already in progress." },
              { status: 409 },
            );
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(loans)
        .set(
          status === "Completed"
            ? {
                status: "Completed",
                statusOverride: "Completed",
                statusReason: reason,
                completedAt: loan.completedAt ?? now,
                waivedAmount: waived,
                updatedAt: now,
              }
            : {
                statusOverride: null,
                statusReason: null,
                completedAt: null,
                updatedAt: now,
              },
        )
        .where(eq(loans.id, loanId));

      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "loan",
        entityId: loanId,
        loanId,
        action: "status",
        before: {
          status: loan.status,
          statusOverride: loan.statusOverride,
          statusReason: loan.statusReason,
          waivedAmount: loan.waivedAmount,
        },
        after: {
          status,
          reason: status === "Completed" ? reason : null,
          waivedAmount: waived,
        },
        reason: reason || null,
      });
    });

    // Clearing the override lets the engine set the derived status.
    await syncLoanStatusFromInterestPeriods(loanId);

    const updatedLoan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    invalidateLoanData();
    try {
      const { enqueueGroupLoanChanged } =
        await import("$lib/server/jobs/queue");
      const { scheduleDrain } = await import("$lib/server/jobs/after-response");
      await enqueueGroupLoanChanged(loanId, {
        activity: {
          type:
            updatedLoan?.status === "Completed"
              ? "loan_completed"
              : "loan_updated",
          entityId: loanId,
          actorUserId: userId,
          actorEmail: session.user?.email ?? undefined,
          summary:
            updatedLoan?.status === "Completed"
              ? `Loan completed: ${updatedLoan.loanName}`
              : `Loan status updated: ${updatedLoan?.loanName ?? ""}`,
        },
      });
      scheduleDrain(event);
    } catch (groupErr) {
      console.error("[groups] post-status sync failed", groupErr);
    }

    if (idempotencyKey) {
      await rememberIdempotentResponse(
        idempotencyKey,
        userId,
        idempotencyRoute,
        200,
        { success: true, status: updatedLoan?.status ?? null },
      );
    }
    return json(updatedLoan);
  } catch (error) {
    console.error("Error updating loan status:", error);
    try {
      const key = idempotencyKeyOf(event.request);
      if (key) {
        await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
      }
    } catch {
      /* cleanup is best-effort */
    }
    return json(publicJsonError("Failed to update loan status", error), {
      status: 500,
    });
  }
};
