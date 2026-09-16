import {
  calculateInterest,
  calculateTotalInterest,
  calculateTotalPrincipal,
  isOpenLoan,
} from "$lib/calculations";
import {
  type CapitalInterval,
  computePeakConcurrentFromIntervals,
  toCapitalDayKey,
} from "$lib/capital-intervals";
import { toLoanDueDayKey } from "$lib/loan-due-date";
import type {
  Loan,
  LoanInvestor,
  LoanWitness,
  LoanWithInvestors,
} from "$lib/types";

export function passesLoanDueDateRangeFilter(
  loan: { dueDate: Date | string },
  from: string | null,
  to: string | null,
): boolean {
  if (!from && !to) return true;
  const dueKey = toLoanDueDayKey(loan.dueDate);
  if (from && dueKey < from) return false;
  if (to && dueKey > to) return false;
  return true;
}

export interface LoanListSummaryStats {
  totalPrincipal: number;
  interestEstimate: number;
  interestEarned: number;
  completedCount: number;
  totalLoanCount: number;
}

export type InvestorLoanAllocation = LoanInvestor & { loan: Loan };

function getLoanCapitalInterval(
  loan: LoanWithInvestors,
): CapitalInterval | null {
  const paidAllocations = loan.loanInvestors.filter((li) => li.isPaid);
  const principal = calculateTotalPrincipal(paidAllocations);
  if (principal <= 0) return null;

  const sentKeys = paidAllocations
    .map((li) => toCapitalDayKey(li.sentDate))
    .sort();
  const startKey = sentKeys[0] ?? toCapitalDayKey(loan.createdAt);
  const endKey = isOpenLoan(loan)
    ? toCapitalDayKey(loan.dueDate)
    : toCapitalDayKey(loan.updatedAt);

  if (startKey > endKey) return null;
  return { startKey, endKey, principal };
}

function getInvestorAllocationInterval(
  allocation: InvestorLoanAllocation,
): CapitalInterval | null {
  if (!allocation.isPaid) return null;

  const principal = calculateTotalPrincipal([allocation]);
  if (principal <= 0) return null;

  const startKey = toCapitalDayKey(allocation.sentDate);
  const endKey = isOpenLoan(allocation.loan)
    ? toCapitalDayKey(allocation.loan.dueDate)
    : toCapitalDayKey(allocation.loan.updatedAt);

  if (startKey > endKey) return null;
  return { startKey, endKey, principal };
}

function sumAllocationInterest(allocations: InvestorLoanAllocation[]): number {
  const byLoanId = new Map<number, InvestorLoanAllocation[]>();
  for (const allocation of allocations) {
    const existing = byLoanId.get(allocation.loanId) ?? [];
    existing.push(allocation);
    byLoanId.set(allocation.loanId, existing);
  }

  let total = 0;
  for (const loanAllocations of byLoanId.values()) {
    total += calculateTotalInterest(loanAllocations);
  }
  return total;
}

/**
 * Peak deployed principal in a date range (whole loans).
 */
export function computePeakConcurrentPrincipal(
  loans: LoanWithInvestors[],
  from: string | null = null,
  to: string | null = null,
): number {
  const intervals = loans
    .map(getLoanCapitalInterval)
    .filter((interval): interval is CapitalInterval => interval !== null);

  return computePeakConcurrentFromIntervals(intervals, from, to);
}

/** Peak deployed principal for one investor's paid allocations. */
export function computePeakConcurrentInvestorPrincipal(
  allocations: InvestorLoanAllocation[],
  from: string | null = null,
  to: string | null = null,
): number {
  const intervals = allocations
    .map(getInvestorAllocationInterval)
    .filter((interval): interval is CapitalInterval => interval !== null);

  return computePeakConcurrentFromIntervals(intervals, from, to);
}

export interface PortfolioCapitalStats {
  totalPrincipal: number;
  activePrincipal: number;
  completedPrincipal: number;
  interestEstimate: number;
  interestEarned: number;
  totalInterestScheduled: number;
}

export function computePortfolioCapitalStats(
  loans: LoanWithInvestors[],
  from: string | null = null,
  to: string | null = null,
): PortfolioCapitalStats {
  const openLoans = loans.filter(isOpenLoan);
  const completedLoans = loans.filter((loan) => !isOpenLoan(loan));

  let interestEstimate = 0;
  let interestEarned = 0;

  for (const loan of openLoans) {
    interestEstimate += calculateTotalInterest(loan.loanInvestors);
  }
  for (const loan of completedLoans) {
    interestEarned += calculateTotalInterest(loan.loanInvestors);
  }

  return {
    totalPrincipal: computePeakConcurrentPrincipal(loans, from, to),
    activePrincipal: computePeakConcurrentPrincipal(openLoans, from, to),
    completedPrincipal: computePeakConcurrentPrincipal(
      completedLoans,
      from,
      to,
    ),
    interestEstimate,
    interestEarned,
    totalInterestScheduled: interestEstimate + interestEarned,
  };
}

export interface InvestorPortfolioCapitalStats {
  totalCapital: number;
  activeCapital: number;
  completedCapital: number;
  interestEstimate: number;
  interestEarned: number;
  totalInterestScheduled: number;
  totalLoanCount: number;
  activeLoansCount: number;
  completedLoansCount: number;
}

export function computeInvestorPortfolioCapitalStats(
  allocations: InvestorLoanAllocation[],
  from: string | null = null,
  to: string | null = null,
): InvestorPortfolioCapitalStats {
  const openAllocations = allocations.filter((allocation) =>
    isOpenLoan(allocation.loan),
  );
  const completedAllocations = allocations.filter(
    (allocation) => !isOpenLoan(allocation.loan),
  );

  const activeLoanIds = new Set(
    openAllocations.map((allocation) => allocation.loanId),
  );
  const completedLoanIds = new Set(
    completedAllocations.map((allocation) => allocation.loanId),
  );
  const totalLoanIds = new Set(
    allocations.map((allocation) => allocation.loanId),
  );

  const interestEstimate = sumAllocationInterest(openAllocations);
  const interestEarned = sumAllocationInterest(completedAllocations);

  return {
    totalCapital: computePeakConcurrentInvestorPrincipal(allocations, from, to),
    activeCapital: computePeakConcurrentInvestorPrincipal(
      openAllocations,
      from,
      to,
    ),
    completedCapital: computePeakConcurrentInvestorPrincipal(
      completedAllocations,
      from,
      to,
    ),
    interestEstimate,
    interestEarned,
    totalInterestScheduled: interestEstimate + interestEarned,
    totalLoanCount: totalLoanIds.size,
    activeLoansCount: activeLoanIds.size,
    completedLoansCount: completedLoanIds.size,
  };
}

export function computeLoanListSummaryStats(
  loans: LoanWithInvestors[],
  from: string | null = null,
  to: string | null = null,
): LoanListSummaryStats {
  let completedCount = 0;

  for (const loan of loans) {
    if (!isOpenLoan(loan)) completedCount += 1;
  }

  const capital = computePortfolioCapitalStats(loans, from, to);

  return {
    totalPrincipal: capital.totalPrincipal,
    interestEstimate: capital.interestEstimate,
    interestEarned: capital.interestEarned,
    completedCount,
    totalLoanCount: loans.length,
  };
}

export interface ProfitStats {
  totalPrincipal: number;
  profitEstimate: number;
  profitEarned: number;
  totalProfitScheduled: number;
  completedCount: number;
  totalLoanCount: number;
}

/**
 * Profit stats for a borrower across their loans.
 * Estimate = open loans, Earned = completed loans — same split as investor interest.
 */
export type PartyCommissionContext = {
  userId: string;
  investorIds: number[];
  witnessIds: number[];
};

export function partyCommissionAmountForLoan(
  loan: LoanWithInvestors,
  ctx: PartyCommissionContext,
): number {
  const principal = calculateTotalPrincipal(loan.loanInvestors);
  let total = 0;

  if (loan.borrower?.borrowerUserId === ctx.userId) {
    total += calculateInterest(principal, loan.profitValue, loan.profitType);
  }

  for (const row of loan.loanWitnesses ?? []) {
    if (ctx.witnessIds.includes(row.witnessId)) {
      total += calculateInterest(principal, row.profitValue, row.profitType);
    }
  }

  for (const allocation of loan.loanInvestors) {
    if (ctx.investorIds.includes(allocation.investorId)) {
      total += calculateInterest(
        principal,
        allocation.profitValue ?? "0",
        allocation.profitType ?? "rate",
      );
    }
  }

  return total;
}

export function loanHasPartyCommission(
  loan: LoanWithInvestors,
  ctx: PartyCommissionContext,
): boolean {
  return partyCommissionAmountForLoan(loan, ctx) > 0;
}

/**
 * Commission stats for the signed-in user across loans (borrower, witness, and investor slots).
 */
export function computePartyCommissionStats(
  loans: LoanWithInvestors[],
  ctx: PartyCommissionContext,
  from: string | null = null,
  to: string | null = null,
): ProfitStats {
  const loansWithCommission = loans.filter((loan) =>
    loanHasPartyCommission(loan, ctx),
  );
  const openLoans = loansWithCommission.filter(isOpenLoan);
  const completedLoans = loansWithCommission.filter(
    (loan) => !isOpenLoan(loan),
  );

  const profitEstimate = openLoans.reduce(
    (sum, loan) => sum + partyCommissionAmountForLoan(loan, ctx),
    0,
  );
  const profitEarned = completedLoans.reduce(
    (sum, loan) => sum + partyCommissionAmountForLoan(loan, ctx),
    0,
  );

  return {
    totalPrincipal: computePeakConcurrentPrincipal(
      loansWithCommission,
      from,
      to,
    ),
    profitEstimate,
    profitEarned,
    totalProfitScheduled: profitEstimate + profitEarned,
    completedCount: completedLoans.length,
    totalLoanCount: loansWithCommission.length,
  };
}

export function computeBorrowerProfitStats(
  loans: LoanWithInvestors[],
  from: string | null = null,
  to: string | null = null,
): ProfitStats {
  const openLoans = loans.filter(isOpenLoan);
  const completedLoans = loans.filter((loan) => !isOpenLoan(loan));

  const profitFor = (loan: LoanWithInvestors) =>
    calculateInterest(
      calculateTotalPrincipal(loan.loanInvestors),
      loan.profitValue,
      loan.profitType,
    );

  const profitEstimate = openLoans.reduce(
    (sum, loan) => sum + profitFor(loan),
    0,
  );
  const profitEarned = completedLoans.reduce(
    (sum, loan) => sum + profitFor(loan),
    0,
  );

  return {
    totalPrincipal: computePeakConcurrentPrincipal(loans, from, to),
    profitEstimate,
    profitEarned,
    totalProfitScheduled: profitEstimate + profitEarned,
    completedCount: completedLoans.length,
    totalLoanCount: loans.length,
  };
}

export type WitnessLoanAllocation = LoanWitness & { loan: LoanWithInvestors };

/**
 * Profit stats for a witness across the loans they witness.
 * Estimate = open loans, Earned = completed loans — same split as investor interest.
 */
export function computeWitnessProfitStats(
  allocations: WitnessLoanAllocation[],
  from: string | null = null,
  to: string | null = null,
): ProfitStats {
  const openAllocations = allocations.filter((allocation) =>
    isOpenLoan(allocation.loan),
  );
  const completedAllocations = allocations.filter(
    (allocation) => !isOpenLoan(allocation.loan),
  );

  const profitFor = (allocation: WitnessLoanAllocation) =>
    calculateInterest(
      calculateTotalPrincipal(allocation.loan.loanInvestors),
      allocation.profitValue,
      allocation.profitType,
    );

  const profitEstimate = openAllocations.reduce(
    (sum, allocation) => sum + profitFor(allocation),
    0,
  );
  const profitEarned = completedAllocations.reduce(
    (sum, allocation) => sum + profitFor(allocation),
    0,
  );

  const uniqueLoans = [
    ...new Map(
      allocations.map((allocation) => [allocation.loanId, allocation.loan]),
    ).values(),
  ];

  return {
    totalPrincipal: computePeakConcurrentPrincipal(uniqueLoans, from, to),
    profitEstimate,
    profitEarned,
    totalProfitScheduled: profitEstimate + profitEarned,
    completedCount: completedAllocations.length,
    totalLoanCount: allocations.length,
  };
}
