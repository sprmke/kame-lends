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
  /** Paid principal still outstanding on open loans in the visible list. */
  currentCapital: number;
  /**
   * Net new capital deployed in the date range (fundings minus reinvestment from
   * prior loan principal + interest returned to the liquidity pool).
   */
  totalCapitalInvested: number;
  interestEstimate: number;
  interestEarned: number;
  completedCount: number;
  totalLoanCount: number;
}

type CapitalLiquidityEvent =
  | { kind: "deploy"; dayKey: string; amount: number }
  | { kind: "return"; dayKey: string; amount: number };

function dayKeyInCapitalRange(
  dayKey: string,
  from: string | null,
  to: string | null,
): boolean {
  if (from && dayKey < from) return false;
  if (to && dayKey > to) return false;
  return true;
}

function compareCapitalLiquidityEvents(
  a: CapitalLiquidityEvent,
  b: CapitalLiquidityEvent,
): number {
  if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
  if (a.kind === b.kind) return 0;
  return a.kind === "return" ? -1 : 1;
}

function buildLoanCapitalLiquidityEvents(
  loan: LoanWithInvestors,
): CapitalLiquidityEvent[] {
  const events: CapitalLiquidityEvent[] = [];
  const paidAllocations = loan.loanInvestors.filter((li) => li.isPaid);

  for (const allocation of paidAllocations) {
    const amount = calculateTotalPrincipal([allocation]);
    if (amount <= 0) continue;
    events.push({
      kind: "deploy",
      dayKey: toCapitalDayKey(allocation.sentDate),
      amount,
    });
  }

  if (!isOpenLoan(loan)) {
    const principal = calculateTotalPrincipal(paidAllocations);
    const interest = calculateTotalInterest(paidAllocations);
    const returned = principal + interest;
    if (returned > 0) {
      events.push({
        kind: "return",
        dayKey: toCapitalDayKey(loan.updatedAt),
        amount: returned,
      });
    }
  }

  return events;
}

function buildInvestorCapitalLiquidityEvents(
  allocation: InvestorLoanAllocation,
): CapitalLiquidityEvent[] {
  const events: CapitalLiquidityEvent[] = [];
  if (!allocation.isPaid) return events;

  const amount = calculateTotalPrincipal([allocation]);
  if (amount > 0) {
    events.push({
      kind: "deploy",
      dayKey: toCapitalDayKey(allocation.sentDate),
      amount,
    });
  }

  if (!isOpenLoan(allocation.loan)) {
    const interest = calculateTotalInterest([allocation]);
    const returned = amount + interest;
    if (returned > 0) {
      events.push({
        kind: "return",
        dayKey: toCapitalDayKey(allocation.loan.updatedAt),
        amount: returned,
      });
    }
  }

  return events;
}

/** Outstanding paid principal on open loans. */
export function computeCurrentCapital(loans: LoanWithInvestors[]): number {
  let total = 0;
  for (const loan of loans) {
    if (!isOpenLoan(loan)) continue;
    const paidAllocations = loan.loanInvestors.filter((li) => li.isPaid);
    total += calculateTotalPrincipal(paidAllocations);
  }
  return total;
}

/** Outstanding paid principal for one investor's open allocations. */
export function computeCurrentInvestorCapital(
  allocations: InvestorLoanAllocation[],
): number {
  let total = 0;
  for (const allocation of allocations) {
    if (!isOpenLoan(allocation.loan)) continue;
    if (!allocation.isPaid) continue;
    total += calculateTotalPrincipal([allocation]);
  }
  return total;
}

/**
 * Net new capital deployed in `from`/`to` (inclusive day keys). Reinvestment from
 * completed loans (principal + scheduled interest) reduces net new on later fundings.
 */
export function computeNetCapitalInvested(
  loans: LoanWithInvestors[],
  from: string | null = null,
  to: string | null = null,
): number {
  const events = loans
    .flatMap(buildLoanCapitalLiquidityEvents)
    .sort(compareCapitalLiquidityEvents);

  let liquidPool = 0;
  let netInvested = 0;

  for (const event of events) {
    if (event.kind === "return") {
      liquidPool += event.amount;
      continue;
    }

    const fromPool = Math.min(event.amount, liquidPool);
    const netNew = event.amount - fromPool;
    liquidPool -= fromPool;

    if (dayKeyInCapitalRange(event.dayKey, from, to)) {
      netInvested += netNew;
    }
  }

  return netInvested;
}

export function computeNetInvestorCapitalInvested(
  allocations: InvestorLoanAllocation[],
  from: string | null = null,
  to: string | null = null,
): number {
  const events = allocations
    .flatMap(buildInvestorCapitalLiquidityEvents)
    .sort(compareCapitalLiquidityEvents);

  let liquidPool = 0;
  let netInvested = 0;

  for (const event of events) {
    if (event.kind === "return") {
      liquidPool += event.amount;
      continue;
    }

    const fromPool = Math.min(event.amount, liquidPool);
    const netNew = event.amount - fromPool;
    liquidPool -= fromPool;

    if (dayKeyInCapitalRange(event.dayKey, from, to)) {
      netInvested += netNew;
    }
  }

  return netInvested;
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

  for (const loan of loans) {
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
    totalInterestScheduled: interestEstimate,
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

  const interestEstimate = sumAllocationInterest(allocations);
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
    totalInterestScheduled: interestEstimate,
    totalLoanCount: totalLoanIds.size,
    activeLoansCount: activeLoanIds.size,
    completedLoansCount: completedLoanIds.size,
  };
}

export function computeLoanListSummaryStats(
  loans: LoanWithInvestors[],
  from: string | null = null,
  to: string | null = null,
  capitalHistoryLoans?: LoanWithInvestors[],
): LoanListSummaryStats {
  let completedCount = 0;

  for (const loan of loans) {
    if (!isOpenLoan(loan)) completedCount += 1;
  }

  const history = capitalHistoryLoans ?? loans;
  let interestEstimate = 0;
  let interestEarned = 0;

  for (const loan of loans) {
    interestEstimate += calculateTotalInterest(loan.loanInvestors);
    if (!isOpenLoan(loan)) {
      interestEarned += calculateTotalInterest(loan.loanInvestors);
    }
  }

  return {
    currentCapital: computeCurrentCapital(loans),
    totalCapitalInvested: computeNetCapitalInvested(history, from, to),
    interestEstimate,
    interestEarned,
    completedCount,
    totalLoanCount: loans.length,
  };
}

/** Same card shape as `computeLoanListSummaryStats`, scoped to one investor's allocations. */
export function computeInvestorLoanListSummaryStats(
  allocations: InvestorLoanAllocation[],
  from: string | null = null,
  to: string | null = null,
  capitalHistoryAllocations?: InvestorLoanAllocation[],
): LoanListSummaryStats {
  const history = capitalHistoryAllocations ?? allocations;
  const capital = computeInvestorPortfolioCapitalStats(allocations, from, to);

  return {
    currentCapital: computeCurrentInvestorCapital(allocations),
    totalCapitalInvested: computeNetInvestorCapitalInvested(history, from, to),
    interestEstimate: capital.interestEstimate,
    interestEarned: capital.interestEarned,
    completedCount: capital.completedLoansCount,
    totalLoanCount: capital.totalLoanCount,
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
export function partyCommissionAmountForLoan(loan: LoanWithInvestors): number {
  if (!loan.myCommission) return 0;
  const principal = calculateTotalPrincipal(loan.loanInvestors);
  return calculateInterest(
    principal,
    loan.myCommission.profitValue,
    loan.myCommission.profitType,
  );
}

export function loanHasPartyCommission(loan: LoanWithInvestors): boolean {
  return partyCommissionAmountForLoan(loan) > 0;
}

/**
 * Commission stats for the signed-in user across loans (private per-user commission).
 */
export function computePartyCommissionStats(
  loans: LoanWithInvestors[],
  from: string | null = null,
  to: string | null = null,
): ProfitStats {
  const loansWithCommission = loans.filter(loanHasPartyCommission);
  const openLoans = loansWithCommission.filter(isOpenLoan);
  const completedLoans = loansWithCommission.filter(
    (loan) => !isOpenLoan(loan),
  );

  const profitEstimate = openLoans.reduce(
    (sum, loan) => sum + partyCommissionAmountForLoan(loan),
    0,
  );
  const profitEarned = completedLoans.reduce(
    (sum, loan) => sum + partyCommissionAmountForLoan(loan),
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
