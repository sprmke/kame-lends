import type { LoanStatus } from "./types";

export function interestPeriodStatusFlags(
  loanInvestors: Array<{
    hasMultipleInterest?: boolean | null;
    interestPeriods?: Array<{ status: string }> | null;
  }>,
): {
  hasOverduePeriod: boolean;
  hasIncompletePeriod: boolean;
  hasAnyPendingPeriod: boolean;
  allPeriodsCompleted: boolean;
} {
  const periods = loanInvestors.flatMap((li) =>
    li.hasMultipleInterest && li.interestPeriods ? li.interestPeriods : [],
  );
  return {
    hasOverduePeriod: periods.some((p) => p.status === "Overdue"),
    hasIncompletePeriod: periods.some((p) => p.status === "Incomplete"),
    hasAnyPendingPeriod: periods.some((p) => p.status === "Pending"),
    allPeriodsCompleted:
      periods.length > 0 && periods.every((p) => p.status === "Completed"),
  };
}

/**
 * Loan status from payments and interest periods.
 * Fully received (balance ~0) always wins over overdue due dates/periods.
 */
export function deriveLoanStatusFromPeriods(input: {
  currentStatus: LoanStatus;
  fullyReceived: boolean;
  hasOverduePeriod: boolean;
  hasIncompletePeriod: boolean;
  allPeriodsCompleted: boolean;
  allDisbursementsPaid: boolean;
}): LoanStatus {
  if (input.fullyReceived) return "Completed";

  if (input.hasOverduePeriod || input.hasIncompletePeriod) {
    return "Overdue";
  }

  if (input.allPeriodsCompleted && input.allDisbursementsPaid) {
    return "Completed";
  }

  if (
    input.currentStatus === "Overdue" &&
    !input.hasOverduePeriod &&
    !input.hasIncompletePeriod
  ) {
    return "Fully Funded";
  }

  return input.currentStatus;
}
