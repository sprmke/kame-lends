/**
 * Business logic calculations for loans and investments.
 *
 * These functions are thin adapters over `src/lib/money/ledger.ts`. New code
 * should import `buildLoanLedger` directly; this module stays for the many
 * existing imports.
 */
import { computeTotalLot } from "./lot-utils";
import {
  centavosToPesos,
  addC,
  toCentavos,
  AMOUNT_TOLERANCE_CENTAVOS,
} from "./money/centavos";
import { buildLoanLedger, type LedgerAllocationInput } from "./money/ledger";
import {
  formatDurationBetweenKeys,
  todayKey,
  toDateKey,
} from "./dates/business-date";
import type {
  LoanWithInvestors,
  InvestorWithLoans,
  BorrowerWithLoans,
  LoanInvestor,
  Investor,
  Loan,
} from "./types";

/** Match received-payment APIs: amounts are stored to 2 decimal places. */
export const LOAN_AMOUNT_TOLERANCE = AMOUNT_TOLERANCE_CENTAVOS / 100;

const FAR_FUTURE = "9999-12-31";

type AllocationLike = LedgerAllocationInput & {
  loan?: { id?: number; dueDate?: Date | string } | null;
};

function asAllocations(
  loanInvestors: Array<Record<string, unknown>>,
): AllocationLike[] {
  return loanInvestors as unknown as AllocationLike[];
}

function groupByLoanId(
  allocations: AllocationLike[],
): Map<string, AllocationLike[]> {
  const groups = new Map<string, AllocationLike[]>();
  const loanKeys = new WeakMap<object, number>();
  let nextKey = 0;

  for (const allocation of allocations) {
    let key = "single";
    if (allocation.loan) {
      if (typeof allocation.loan.id === "number") {
        key = `id:${allocation.loan.id}`;
      } else {
        let ref = loanKeys.get(allocation.loan);
        if (ref === undefined) {
          ref = nextKey++;
          loanKeys.set(allocation.loan, ref);
        }
        key = `ref:${ref}`;
      }
    }
    const group = groups.get(key);
    if (group) group.push(allocation);
    else groups.set(key, [allocation]);
  }
  return groups;
}

/**
 * Sums expected interest for one loan, or for an investor across many loans.
 * Grouping by loan is what fixes the old 18,000-vs-26,000 merge (CALC-02).
 */
function totalInterestCentavos(allocations: AllocationLike[]): number {
  let total = 0;
  for (const group of groupByLoanId(allocations).values()) {
    const ledger = buildLoanLedger({
      dueDate: group[0]?.loan?.dueDate ?? FAR_FUTURE,
      loanInvestors: group,
    });
    total = addC(total, ledger.interestExpectedC);
  }
  return total;
}

/** Principal is still outstanding. Completed loans can be lent again. */
export function isOpenLoan(loan: { status: string }): boolean {
  return loan.status !== "Completed";
}

/**
 * Calculate total principal amount for a loan
 */
export function calculateTotalPrincipal(
  loanInvestors: Array<{ amount: string }>,
): number {
  return centavosToPesos(
    addC(...loanInvestors.map((li) => toCentavos(li.amount))),
  );
}

/**
 * Calculate total interest for a loan (or for an investor across loans when
 * rows carry a `loan` reference).
 */
export function calculateTotalInterest(
  loanInvestors: Array<{
    amount: string;
    interestRate: string;
    interestType?: string;
    hasMultipleInterest?: boolean;
    interestPeriods?: Array<{
      interestRate: string;
      interestType?: string;
    }>;
    investor?: { id: number };
    investorId?: number;
    loan?: { id?: number; dueDate?: Date | string } | null;
  }>,
): number {
  return centavosToPesos(totalInterestCentavos(asAllocations(loanInvestors)));
}

/**
 * Calculate total amount (principal + interest) for a loan
 */
export function calculateTotalAmount(
  loanInvestors: Array<{
    amount: string;
    interestRate: string;
    interestType?: string;
    hasMultipleInterest?: boolean;
    interestPeriods?: Array<{
      interestRate: string;
      interestType?: string;
    }>;
  }>,
): number {
  const allocations = asAllocations(loanInvestors);
  let principalC = 0;
  let interestC = 0;
  for (const group of groupByLoanId(allocations).values()) {
    const ledger = buildLoanLedger({
      dueDate: group[0]?.loan?.dueDate ?? FAR_FUTURE,
      loanInvestors: group,
    });
    principalC = addC(principalC, ledger.principalC);
    interestC = addC(interestC, ledger.interestExpectedC);
  }
  return centavosToPesos(addC(principalC, interestC));
}

export function calculateTotalReceived(
  loanInvestors: Array<{
    receivedPayments?: Array<{ amount: string }>;
  }>,
): number {
  const receivedC = addC(
    ...loanInvestors.flatMap((li) =>
      (li.receivedPayments ?? []).map((rp) => toCentavos(rp.amount)),
    ),
  );
  return centavosToPesos(receivedC);
}

/** True when received payments cover principal + interest. */
export function isLoanFullyReceived(
  totalDue: number,
  totalReceived: number,
  tolerance = LOAN_AMOUNT_TOLERANCE,
): boolean {
  return totalDue > 0 && totalReceived + tolerance >= totalDue;
}

/**
 * Calculate weighted average interest rate for a loan.
 * Includes fixed-amount interest; a fixed amount still raises the effective
 * rate on the capital that earned it (CALC-08).
 */
export function calculateAverageRate(
  loanInvestors: Array<{
    amount: string;
    interestRate: string;
    interestType?: string;
    hasMultipleInterest?: boolean;
    interestPeriods?: Array<{
      interestRate: string;
      interestType?: string;
    }>;
    investor?: { id: number };
    investorId?: number;
    loan?: { id?: number; dueDate?: Date | string } | null;
  }>,
): number {
  const allocations = asAllocations(loanInvestors);
  const totalPrincipalC = addC(
    ...allocations.map((allocation) => toCentavos(allocation.amount)),
  );
  if (totalPrincipalC === 0) return 0;
  const totalInterestC = totalInterestCentavos(allocations);
  return (totalInterestC / totalPrincipalC) * 100;
}

/**
 * Calculate interest for a single investment
 */
export function calculateInterest(
  amount: string | number,
  interestRate: string | number,
  interestType?: string,
): number {
  if (interestType === "fixed") {
    return centavosToPesos(toCentavos(interestRate));
  }
  return centavosToPesos(
    Math.round((toCentavos(amount) * toCentavos(interestRate)) / 10000),
  );
}

/**
 * Amount due for overdue loans (unpaid overdue items only).
 *
 * `dueDate` is the loan due date; when omitted the loan is treated as not
 * past due. Pass `today` in tests so the answer never depends on the clock.
 */
export function calculateOverdueAmount(
  loanInvestors: Array<{
    amount: string;
    interestRate: string;
    interestType?: string;
    hasMultipleInterest?: boolean;
    interestPeriods?: Array<{
      interestRate: string;
      interestType?: string;
      dueDate?: Date | string;
      status?: string;
    }>;
    investor?: { id: number };
    investorId?: number;
    receivedPayments?: Array<{
      amount: string;
      interestPeriodId?: number | null;
    }>;
    loan?: { id?: number; dueDate?: Date | string } | null;
  }>,
  dueDate: Date | string = FAR_FUTURE,
  today: string = todayKey(),
): number {
  const ledger = buildLoanLedger(
    {
      dueDate,
      loanInvestors: asAllocations(loanInvestors),
    },
    { today },
  );
  return centavosToPesos(ledger.overdueC);
}

/**
 * Amount due on the loan's final due date, using stored period statuses.
 * @deprecated Not used by any screen; kept only for characterization tests.
 * New code must use `buildLoanLedger().dueC` / `.balanceC`.
 */
export function calculateAmountDueOnDate(
  loanInvestors: Array<{
    amount: string;
    interestRate: string;
    interestType?: string;
    hasMultipleInterest?: boolean;
    interestPeriods?: Array<{
      interestRate: string;
      interestType?: string;
      dueDate?: Date | string;
      status?: string;
    }>;
    investor?: { id: number };
    investorId?: number;
  }>,
): number {
  const groups = new Map<number, typeof loanInvestors>();
  loanInvestors.forEach((li, index) => {
    const investorId = li.investor?.id ?? li.investorId ?? index;
    const group = groups.get(investorId);
    if (group) group.push(li);
    else groups.set(investorId, [li]);
  });

  let totalC = 0;
  for (const transactions of groups.values()) {
    const capitalC = addC(
      ...transactions.map((transaction) => toCentavos(transaction.amount)),
    );
    const withPeriods = transactions.find(
      (transaction) =>
        transaction.hasMultipleInterest &&
        (transaction.interestPeriods?.length ?? 0) > 0,
    );
    if (withPeriods?.interestPeriods) {
      const periods = [...withPeriods.interestPeriods].sort((a, b) =>
        toDateKey(a.dueDate).localeCompare(toDateKey(b.dueDate)),
      );
      const finalPeriod = periods[periods.length - 1];
      const rolledC = periods.slice(0, -1).reduce((sum, period) => {
        if (period.status !== "Overdue" && period.status !== "Incomplete") {
          return sum;
        }
        return addC(
          sum,
          toCentavos(
            calculateInterest(
              centavosToPesos(capitalC),
              period.interestRate,
              period.interestType,
            ),
          ),
        );
      }, 0);
      const finalC =
        finalPeriod.status === "Completed"
          ? 0
          : toCentavos(
              calculateInterest(
                centavosToPesos(capitalC),
                finalPeriod.interestRate,
                finalPeriod.interestType,
              ),
            );
      totalC = addC(totalC, capitalC, rolledC, finalC);
    } else {
      const interestC = addC(
        ...transactions.map((transaction) =>
          toCentavos(
            calculateInterest(
              transaction.amount,
              transaction.interestRate,
              transaction.interestType,
            ),
          ),
        ),
      );
      totalC = addC(totalC, capitalC, interestC);
    }
  }

  return centavosToPesos(totalC);
}

/**
 * Count unique investors in a loan
 */
export function countUniqueInvestors(
  loanInvestors: Array<{ investor: { id: number } }>,
): number {
  return new Set(loanInvestors.map((li) => li.investor.id)).size;
}

/**
 * Group loan investors by investor ID
 */
export function groupByInvestor<
  T extends { investor: Investor; amount: string; interestRate: string },
>(loanInvestors: T[]): Map<number, T[]> {
  const investorMap = new Map<number, T[]>();

  loanInvestors.forEach((li) => {
    const existing = investorMap.get(li.investor.id) || [];
    existing.push(li);
    investorMap.set(li.investor.id, existing);
  });

  return investorMap;
}

/**
 * Calculate aggregated stats for grouped investor transactions
 */
export function calculateTransactionStats(
  transactions: Array<{
    amount: string;
    interestRate: string;
    interestType?: string;
    hasMultipleInterest?: boolean;
    interestPeriods?: Array<{
      interestRate: string;
      interestType?: string;
    }>;
    loan?: { id?: number; dueDate?: Date | string } | null;
  }>,
): {
  totalPrincipal: number;
  totalInterest: number;
  averageRate: number;
  total: number;
} {
  const totalPrincipal = calculateTotalPrincipal(transactions);
  const totalInterest = calculateTotalInterest(transactions);
  const averageRate =
    totalPrincipal > 0 ? (totalInterest / totalPrincipal) * 100 : 0;
  const total = totalPrincipal + totalInterest;

  return {
    totalPrincipal,
    totalInterest,
    averageRate,
    total,
  };
}

/**
 * Loan duration from start date to due date, using calendar months with
 * month-end clamping (CALC-07). Jan 31 → Mar 31 is "2 Months".
 */
export function calculateLoanDuration(
  dueDate: Date | string,
  startDate?: Date | string,
): string {
  const start = startDate ? toDateKey(startDate) : todayKey();
  const due = toDateKey(dueDate);
  return formatDurationBetweenKeys(start, due);
}

/**
 * Check if a loan has any unpaid transactions
 */
export function hasUnpaidTransactions(
  loanInvestors: Array<{ isPaid: boolean }>,
): boolean {
  return loanInvestors.some((li) => !li.isPaid);
}

/**
 * Calculate comprehensive stats for a loan
 */
export function calculateLoanStats(loan: LoanWithInvestors): {
  totalPrincipal: number;
  totalInterest: number;
  avgRate: number;
  totalAmount: number;
  uniqueInvestors: number;
} {
  const ledger = buildLoanLedger(loan);
  const totalPrincipal = centavosToPesos(ledger.principalC);
  const totalInterest = centavosToPesos(ledger.interestExpectedC);
  const avgRate =
    ledger.principalC > 0
      ? (ledger.interestExpectedC / ledger.principalC) * 100
      : 0;
  const totalAmount = centavosToPesos(ledger.dueC);
  const uniqueInvestors = countUniqueInvestors(loan.loanInvestors);

  return {
    totalPrincipal,
    totalInterest,
    avgRate,
    totalAmount,
    uniqueInvestors,
  };
}

/**
 * Calculate comprehensive stats for an investor.
 *
 * Allocations are grouped by loan first, so an investor with two tranches on
 * one loan counts as one loan and gets that loan's schedule (CALC-02, CALC-09).
 */
export function calculateInvestorStats(investor: InvestorWithLoans): {
  totalCapital: number;
  totalInterest: number;
  activeLoans: number;
  currentBalance: number;
  totalLoans: number;
  completedLoans: number;
  overdueLoans: number;
  /** @deprecated Use `totalWithInterest`; kept for existing call-sites. */
  totalGain: number;
  totalWithInterest: number;
} {
  const rows = investor.loanInvestors as unknown as AllocationLike[];
  const groups = [...groupByLoanId(rows).values()];
  const openGroups = groups.filter((group) => {
    const loan = group[0]?.loan as { status?: string } | null | undefined;
    return isOpenLoan({ status: loan?.status ?? "Fully Funded" });
  });

  const totalCapitalC = addC(
    ...openGroups.map((group) => {
      const ledger = buildLoanLedger({
        dueDate: group[0]?.loan?.dueDate ?? FAR_FUTURE,
        loanInvestors: group,
      });
      return ledger.principalC;
    }),
  );
  const totalInterestC = addC(
    ...openGroups.map((group) => {
      const ledger = buildLoanLedger({
        dueDate: group[0]?.loan?.dueDate ?? FAR_FUTURE,
        loanInvestors: group,
      });
      return ledger.interestExpectedC;
    }),
  );

  const distinctStatus = (status: string) =>
    groups.filter((group) => {
      const loan = group[0]?.loan as { status?: string } | null | undefined;
      return loan?.status === status;
    }).length;

  // Copy before sorting: the old version mutated the caller's array.
  const latestTransaction = [...investor.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .at(0);

  const currentBalance = latestTransaction
    ? Number(latestTransaction.balance) || 0
    : 0;

  const totalCapital = centavosToPesos(totalCapitalC);
  const totalInterest = centavosToPesos(totalInterestC);

  return {
    totalCapital,
    totalInterest,
    activeLoans:
      distinctStatus("Fully Funded") + distinctStatus("Partially Funded"),
    currentBalance,
    totalLoans: groups.length,
    completedLoans: distinctStatus("Completed"),
    overdueLoans: distinctStatus("Overdue"),
    totalGain: totalCapital + totalInterest,
    totalWithInterest: totalCapital + totalInterest,
  };
}

/**
 * Aggregate loan stats for a borrower profile.
 */
export function calculateBorrowerStats(borrower: BorrowerWithLoans): {
  totalLoans: number;
  openLoans: number;
  activeLoans: number;
  overdueLoans: number;
  completedLoans: number;
  activePrincipal: number;
  activeInterest: number;
  activeTotal: number;
  overdueAmount: number;
  totalLot: number;
  totalLotWithDepacto: number;
} {
  const loans = borrower.loans ?? [];
  const openLoansList = loans.filter((loan) => isOpenLoan(loan));
  const overdueLoansList = loans.filter((loan) => loan.status === "Overdue");

  let activePrincipalC = 0;
  let activeInterestC = 0;
  let overdueC = 0;

  for (const loan of openLoansList) {
    const ledger = buildLoanLedger({
      dueDate: loan.dueDate,
      loanInvestors: (loan.loanInvestors ?? []) as LedgerAllocationInput[],
    });
    activePrincipalC = addC(activePrincipalC, ledger.principalC);
    activeInterestC = addC(activeInterestC, ledger.interestExpectedC);
  }

  for (const loan of overdueLoansList) {
    overdueC = addC(
      overdueC,
      buildLoanLedger({
        dueDate: loan.dueDate,
        loanInvestors: (loan.loanInvestors ?? []) as LedgerAllocationInput[],
      }).overdueC,
    );
  }

  const { totalLot, totalLotWithDepacto } = computeTotalLot(loans);

  return {
    totalLoans: loans.length,
    openLoans: openLoansList.length,
    activeLoans: loans.filter(
      (loan) =>
        loan.status === "Fully Funded" || loan.status === "Partially Funded",
    ).length,
    overdueLoans: overdueLoansList.length,
    completedLoans: loans.filter((loan) => loan.status === "Completed").length,
    activePrincipal: centavosToPesos(activePrincipalC),
    activeInterest: centavosToPesos(activeInterestC),
    activeTotal: centavosToPesos(addC(activePrincipalC, activeInterestC)),
    overdueAmount: centavosToPesos(overdueC),
    totalLot,
    totalLotWithDepacto,
  };
}
