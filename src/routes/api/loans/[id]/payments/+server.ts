import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loanInvestors, loans, investors } from "$lib/server/db/schema";
import { assertLoanAdmin } from "$lib/server/route-auth";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { toLocalDateString } from "$lib/date-utils";
import {
  hasPaymentReceipt,
  receiptColumnsFromInput,
  RECEIPT_REQUIRED_ERROR,
} from "$lib/payment-receipts";
import { parseOptionalPaymentNotes } from "$lib/payment-notes";
import { parseIdParam } from "$lib/server/route-params";
import { disbursementSchema, firstSchemaError } from "$lib/schemas/payment";
import { recordMoneyAudit } from "$lib/server/money-audit";
import {
  claimIdempotencyKey,
  findIdempotentResponse,
  idempotencyKeyOf,
  rememberIdempotentResponse,
} from "$lib/server/idempotency";
import { idempotencyKeys } from "$lib/server/db/schema";
import { syncLoanStatusFromInterestPeriods } from "$lib/server/loan-interest-period-sync";

async function investorName(investorId: number): Promise<string> {
  const row = await db.query.investors.findFirst({
    where: eq(investors.id, investorId),
    columns: { name: true },
  });
  return row?.name?.trim() ?? "";
}

export const POST: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = parseIdParam(params.id);
    if (loanId === null) {
      return json({ error: "Invalid loan ID." }, { status: 400 });
    }
    const body = await request.json();
    const parsedBody = disbursementSchema.safeParse(body);
    if (!parsedBody.success) {
      return json(
        { error: firstSchemaError(parsedBody.error) },
        { status: 400 },
      );
    }

    const investorId = Number.parseInt(String(body.investorId), 10);
    const authError = await assertLoanAdmin(loanId, userId);
    if (authError) return authError;

    const idempotencyKey = idempotencyKeyOf(request);
    const idempotencyRoute = `POST /api/loans/${loanId}/payments`;
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

    const amount = Number.parseFloat(String(body.amount));
    const interestType = body.interestType === "fixed" ? "fixed" : "rate";
    const interestValue = Number.parseFloat(String(body.interestValue ?? 0));
    const sentDate = new Date(String(body.sentDate ?? ""));
    const isPaid = body.isPaid !== false;

    if (!Number.isFinite(investorId)) {
      return json(
        { error: "Select a lender for this payment." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(
        { error: "Enter an amount greater than zero." },
        { status: 400 },
      );
    }
    if (Number.isNaN(sentDate.getTime())) {
      return json({ error: "A valid sent date is required." }, { status: 400 });
    }
    if (!Number.isFinite(interestValue) || interestValue < 0) {
      return json({ error: "Interest cannot be negative." }, { status: 400 });
    }
    if (!hasPaymentReceipt(body)) {
      return json({ error: RECEIPT_REQUIRED_ERROR }, { status: 400 });
    }
    const notesParsed = parseOptionalPaymentNotes(body.notes);
    if ("error" in notesParsed) {
      return json({ error: notesParsed.error }, { status: 400 });
    }

    const existingPayments = await db.query.loanInvestors.findMany({
      where: and(
        eq(loanInvestors.loanId, loanId),
        eq(loanInvestors.investorId, investorId),
      ),
      with: { interestPeriods: true },
    });
    if (!existingPayments.length) {
      return json(
        { error: "The selected lender is not assigned to this loan." },
        { status: 400 },
      );
    }

    const scheduleSource = existingPayments.find(
      (payment) =>
        payment.hasMultipleInterest && payment.interestPeriods.length > 0,
    );

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
      const inserted = await tx
        .insert(loanInvestors)
        .values({
          loanId,
          investorId,
          amount: String(amount),
          interestType: scheduleSource?.interestType ?? interestType,
          interestRate:
            scheduleSource?.interestRate ?? String(interestValue || 0),
          sentDate,
          isPaid,
          // A new tranche has no schedule of its own. The investor's existing
          // schedule applies to the total capital; do not claim periods that
          // were never written.
          hasMultipleInterest: false,
          notes: notesParsed.notes,
          ...receiptColumnsFromInput(body),
        })
        .returning();

      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "allocation",
        entityId: inserted[0]?.id,
        loanId,
        action: "create",
        after: { investorId, amount, sentDate, isPaid },
      });
    });

    // A new disbursement can re-open a Completed loan; the engine decides.
    await syncLoanStatusFromInterestPeriods(loanId);

    if (idempotencyKey) {
      await rememberIdempotentResponse(
        idempotencyKey,
        userId,
        idempotencyRoute,
        201,
        { success: true },
      );
    }

    invalidateLoanData();
    try {
      const { enqueueGroupLoanChanged } =
        await import("$lib/server/jobs/queue");
      const { scheduleDrain } = await import("$lib/server/jobs/after-response");
      await enqueueGroupLoanChanged(loanId, {
        activity: {
          type: "disbursement",
          entityId: loanId,
          actorUserId: userId,
          actorEmail: session.user?.email ?? undefined,
          detail: {
            amount,
            date: toLocalDateString(sentDate),
            investorName: await investorName(investorId),
          },
        },
      });
      scheduleDrain(event);
    } catch (groupErr) {
      console.error("[groups] post-payment sync failed", groupErr);
    }
    return json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error adding principal payment:", error);
    try {
      const key = idempotencyKeyOf(event.request);
      if (key) {
        await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
      }
    } catch {
      /* cleanup is best-effort */
    }
    return json({ error: "Failed to add principal payment." }, { status: 500 });
  }
};
