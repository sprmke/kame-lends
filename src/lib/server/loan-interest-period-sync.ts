/**
 * Recalculate interest period statuses and the loan status from the single
 * money engine. Stored statuses are never trusted; linked payments decide.
 */
import { db } from "$lib/server/db";
import {
  interestPeriods,
  loanInvestors,
  loans,
  receivedPayments,
} from "$lib/server/db/schema";
import { eq, inArray, sql, and, isNull } from "drizzle-orm";
import type { InterestPeriodStatus, LoanStatus } from "$lib/types";
import { loadLoanLedger } from "$lib/server/loan-ledger";
import {
  loadStatusDriftLoans,
  statusDriftForLoans,
} from "$lib/server/status-drift";

export async function recalculateInterestPeriodStatusFromLinkedPayments(
  periodId: number,
): Promise<{ loanId: number } | null> {
  const period = await db.query.interestPeriods.findFirst({
    where: eq(interestPeriods.id, periodId),
    with: {
      loanInvestor: {
        with: {
          loan: true,
        },
      },
    },
  });

  if (!period) return null;

  const loanId = period.loanInvestor.loanId;
  const ledger = await loadLoanLedger(loanId);
  if (!ledger) return null;

  const derived = ledger.investors
    .flatMap((investor) => investor.periods)
    .find((row) => row.id === periodId)?.status;
  if (!derived) return { loanId };

  await db
    .update(interestPeriods)
    .set({ status: derived, updatedAt: new Date() })
    .where(eq(interestPeriods.id, periodId));

  return { loanId };
}

/**
 * Align every stored period status and the loan status with the ledger.
 * One read, then grouped updates instead of one UPDATE per row.
 */
export async function syncLoanStatusFromInterestPeriods(loanId: number) {
  const ledger = await loadLoanLedger(loanId);
  if (!ledger) return;

  const currentPeriods = await db.query.loanInvestors.findMany({
    where: eq(loanInvestors.loanId, loanId),
    with: { interestPeriods: true },
  });
  const storedById = new Map(
    currentPeriods.flatMap((allocation) =>
      (allocation.interestPeriods ?? []).map((period) => [
        period.id,
        period.status as InterestPeriodStatus,
      ]),
    ),
  );

  const byStatus = new Map<InterestPeriodStatus, number[]>();
  for (const period of ledger.investors.flatMap(
    (investor) => investor.periods,
  )) {
    if (period.id == null) continue;
    if (storedById.get(period.id) === period.status) continue;
    const ids = byStatus.get(period.status) ?? [];
    ids.push(period.id);
    byStatus.set(period.status, ids);
  }

  const now = new Date();
  for (const [status, ids] of byStatus) {
    if (ids.length === 0) continue;
    await db
      .update(interestPeriods)
      .set({ status, updatedAt: now })
      .where(inArray(interestPeriods.id, ids));
  }

  const currentLoan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    columns: {
      id: true,
      status: true,
      completedAt: true,
      statusOverride: true,
    },
  });
  if (!currentLoan) return;

  const override =
    currentLoan.statusOverride === "Completed" ? ("Completed" as const) : null;
  const nextStatus = override ?? ledger.status;

  if (currentLoan.status !== nextStatus) {
    await db
      .update(loans)
      .set({
        status: nextStatus,
        updatedAt: now,
        ...(nextStatus === "Completed" && !currentLoan.completedAt
          ? { completedAt: now }
          : {}),
      })
      .where(eq(loans.id, loanId));
  }
}

export interface LoanStatusSyncResult {
  loans: number;
  updatedLoans: number;
  updatedPeriods: number;
}

/**
 * Recompute period and loan statuses from the ledger for one user or for every
 * loan. Used by the dashboard safety net and the daily cron. Updates are
 * grouped by status, so a run costs a handful of UPDATEs, not one per row.
 */
export async function syncLoanStatuses(
  options: {
    userId?: string;
  } = {},
): Promise<LoanStatusSyncResult> {
  const rows = await loadStatusDriftLoans(options.userId);
  const drift = statusDriftForLoans(rows);

  const periodIdsByStatus = new Map<InterestPeriodStatus, number[]>();
  const loanIdsByStatus = new Map<LoanStatus, number[]>();

  for (const period of drift.periods) {
    const ids = periodIdsByStatus.get(period.derived) ?? [];
    ids.push(period.periodId);
    periodIdsByStatus.set(period.derived, ids);
  }
  for (const loan of drift.loans) {
    const ids = loanIdsByStatus.get(loan.derived) ?? [];
    ids.push(loan.loanId);
    loanIdsByStatus.set(loan.derived, ids);
  }

  const now = new Date();
  let updatedPeriods = 0;
  for (const [status, ids] of periodIdsByStatus) {
    if (ids.length === 0) continue;
    await db
      .update(interestPeriods)
      .set({ status, updatedAt: now })
      .where(inArray(interestPeriods.id, ids));
    updatedPeriods += ids.length;
  }

  let updatedLoans = 0;
  for (const [status, ids] of loanIdsByStatus) {
    if (ids.length === 0) continue;
    await db
      .update(loans)
      .set({
        status,
        updatedAt: now,
        ...(status === "Completed"
          ? { completedAt: sql`COALESCE(${loans.completedAt}, now())` }
          : {}),
      })
      .where(inArray(loans.id, ids));
    updatedLoans += ids.length;
  }

  return { loans: rows.length, updatedLoans, updatedPeriods };
}
