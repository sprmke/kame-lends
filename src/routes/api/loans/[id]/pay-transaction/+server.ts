import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanInvestors, loans } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { parseIdParam } from "$lib/server/route-params";
import { syncLoanStatusFromInterestPeriods } from "$lib/server/loan-interest-period-sync";
import { recordMoneyAudit } from "$lib/server/money-audit";
import { payTransactionSchema, firstSchemaError } from "$lib/schemas/payment";
import { toDateKey } from "$lib/dates/business-date";

/**
 * Mark a scheduled disbursement as sent.
 *
 * The real sent date is kept: an optional `sentDate` from the client wins, and
 * otherwise the date the user originally scheduled stays unchanged. Status is
 * recomputed from the engine afterwards, so a Completed loan re-opens when its
 * balance is no longer zero.
 */
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
      return json({ error: "Invalid loan id" }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = payTransactionSchema.safeParse(body);
    if (!parsedBody.success) {
      return json(
        { error: firstSchemaError(parsedBody.error) },
        { status: 400 },
      );
    }

    const transactionId = parseIdParam(String(body.transactionId ?? ""));
    if (transactionId === null) {
      return json({ error: "Invalid transaction ID" }, { status: 400 });
    }

    const loan = await db.query.loans.findFirst({
      where: and(eq(loans.id, loanId), eq(loans.userId, userId)),
    });
    if (!loan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const allocation = await db.query.loanInvestors.findFirst({
      where: and(
        eq(loanInvestors.id, transactionId),
        eq(loanInvestors.loanId, loanId),
      ),
    });
    if (!allocation) {
      return json({ error: "Disbursement not found" }, { status: 404 });
    }

    const requestedDate =
      typeof body.sentDate === "string" && body.sentDate.trim()
        ? new Date(body.sentDate)
        : null;
    if (requestedDate && Number.isNaN(requestedDate.getTime())) {
      return json({ error: "Invalid sent date" }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(loanInvestors)
        .set({
          isPaid: true,
          ...(requestedDate ? { sentDate: requestedDate } : {}),
        })
        .where(eq(loanInvestors.id, transactionId));

      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "allocation",
        entityId: transactionId,
        loanId,
        action: "update",
        before: {
          isPaid: allocation.isPaid,
          sentDate: toDateKey(allocation.sentDate),
        },
        after: {
          isPaid: true,
          sentDate: toDateKey(requestedDate ?? allocation.sentDate),
        },
        reason: "disbursement marked sent",
      });
    });

    await syncLoanStatusFromInterestPeriods(loanId);
    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error paying transaction:", error);
    return json({ error: "Failed to pay transaction" }, { status: 500 });
  }
};
