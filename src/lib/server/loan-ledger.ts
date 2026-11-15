/**
 * Server helpers that read a loan once and hand back the single money engine's
 * answer. Routes must not re-implement "expected interest" or period status.
 */
import { db } from "$lib/server/db";
import { loanInvestors, loans, receivedPayments } from "$lib/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { buildLoanLedger, type LoanLedger } from "$lib/money/ledger";

export async function loadLoanLedger(
  loanId: number,
  options: { today?: string } = {},
): Promise<LoanLedger | null> {
  const loan = await db.query.loans.findFirst({
    where: and(eq(loans.id, loanId), isNull(loans.deletedAt)),
    with: {
      loanInvestors: {
        where: isNull(loanInvestors.deletedAt),
        with: {
          investor: true,
          interestPeriods: true,
          receivedPayments: { where: isNull(receivedPayments.deletedAt) },
        },
      },
    },
  });
  if (!loan) return null;
  return buildLoanLedger(loan, options);
}

/** Expected interest in centavos for one period, from the engine. */
export function expectedInterestC(
  ledger: LoanLedger,
  periodId: number,
): number | null {
  for (const investor of ledger.investors) {
    const period = investor.periods.find((row) => row.id === periodId);
    if (period) return period.expectedC;
  }
  return null;
}

/** Status the engine derives for one period. */
export function periodStatusFromLedger(
  ledger: LoanLedger,
  periodId: number,
): "Pending" | "Incomplete" | "Completed" | "Overdue" | null {
  for (const investor of ledger.investors) {
    const period = investor.periods.find((row) => row.id === periodId);
    if (period) return period.status;
  }
  return null;
}
