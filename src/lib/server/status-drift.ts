import { and, eq, isNull } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loanInvestors, loans, receivedPayments } from "$lib/server/db/schema";
import {
  collectStatusDrift,
  type StatusDrift,
  type StatusDriftLoan,
} from "$lib/money/status-drift";

/**
 * One query for both the status sweep and the health report. Soft-deleted
 * loans, allocations, and payments are excluded so derived status matches the
 * detail page and the ledger.
 */
export async function loadStatusDriftLoans(userId?: string) {
  return db.query.loans.findMany({
    where: userId
      ? and(eq(loans.userId, userId), isNull(loans.deletedAt))
      : isNull(loans.deletedAt),
    with: {
      loanInvestors: {
        where: isNull(loanInvestors.deletedAt),
        with: {
          interestPeriods: true,
          receivedPayments: { where: isNull(receivedPayments.deletedAt) },
        },
      },
    },
  });
}

export function statusDriftForLoans(
  rows: Awaited<ReturnType<typeof loadStatusDriftLoans>>,
): StatusDrift {
  return collectStatusDrift(rows as unknown as StatusDriftLoan[]);
}

export async function loadStatusDrift(userId?: string): Promise<StatusDrift> {
  return statusDriftForLoans(await loadStatusDriftLoans(userId));
}
