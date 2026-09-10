import { eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { investors, loanInvestors } from "$lib/server/db/schema";

/** All investor contact rows portal-linked to this auth user. */
export async function loadLinkedInvestorContactIds(
  userId: string,
): Promise<number[]> {
  const rows = await db
    .select({ id: investors.id })
    .from(investors)
    .where(eq(investors.investorUserId, userId));
  return rows.map((row) => row.id);
}

/** Loan ids where the user is linked as an investor (any contact row). */
export async function loadInvestmentLoanIds(userId: string): Promise<number[]> {
  const investorIds = await loadLinkedInvestorContactIds(userId);
  if (investorIds.length === 0) return [];

  const rows = await db
    .select({ loanId: loanInvestors.loanId })
    .from(loanInvestors)
    .where(inArray(loanInvestors.investorId, investorIds));

  return [...new Set(rows.map((row) => row.loanId))];
}
