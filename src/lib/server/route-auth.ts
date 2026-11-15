/**
 * Consistent authorization responses for money routes (API-03).
 *
 * A non-owner gets **404**, not 403 and never 401. 401 means "signed out" and
 * is handled once at the top of a route; 403 would confirm that a loan or
 * payment exists for someone else.
 */
import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { interestPeriods } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { hasLoanAdminAccess } from "$lib/server/access-control";

export function notFound(message = "Not found"): Response {
  return json({ error: message }, { status: 404 });
}

/** Null when the user may administer the loan; otherwise a 404 response. */
export async function assertLoanAdmin(
  loanId: number,
  userId: string,
): Promise<Response | null> {
  if (await hasLoanAdminAccess(loanId, userId)) return null;
  return notFound("Loan not found");
}

/** Null when the user owns the loan behind this period; otherwise a 404. */
export async function assertPeriodAdmin(
  periodId: number,
  userId: string,
): Promise<Response | null> {
  const period = await db.query.interestPeriods.findFirst({
    where: eq(interestPeriods.id, periodId),
    with: { loanInvestor: { with: { loan: true } } },
  });
  if (!period || period.loanInvestor.loan.userId !== userId) {
    return notFound("Interest period not found");
  }
  return null;
}

/** Null when the user owns the loan behind this payment; otherwise a 404. */
export async function assertPaymentAdmin(
  payment: { loanInvestor?: { loan?: { userId?: string } | null } | null },
  userId: string,
): Promise<Response | null> {
  return payment.loanInvestor?.loan?.userId === userId
    ? null
    : notFound("Received payment not found");
}
