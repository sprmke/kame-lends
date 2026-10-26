/** Plain-language notes for summary stat cards. Shown from the help control. */

export type SummaryDetailPlace = "range" | "group" | "selection";
export type SummaryDetailBasis = "loan" | "share";

function loanSet(place: SummaryDetailPlace) {
  if (place === "group") {
    return {
      open: "open loans in this group",
      all: "loans in this group",
    };
  }

  if (place === "selection") {
    return {
      open: "open loans you selected",
      all: "loans you selected",
    };
  }

  return {
    open: "open loans due in this date range",
    all: "loans due in this date range",
  };
}

export function loanListMetricDetails(
  place: SummaryDetailPlace = "range",
  basis: SummaryDetailBasis = "loan",
) {
  const set = loanSet(place);
  const sentBy =
    basis === "share" ? "Money this person already sent" : "Money already sent";
  const owedOn =
    basis === "share"
      ? `Principal still owed to this person on ${set.open}`
      : `Principal still owed on ${set.open}`;
  const whoseLoans =
    basis === "share" ? `this person's ${set.all}` : `all ${set.all}`;
  const earnedLoans =
    basis === "share" ? "this person's completed loans" : "completed loans";

  return {
    principal: `${sentBy} on ${set.open}. Not paid back yet.`,
    total: `${owedOn}, plus interest on ${whoseLoans}.`,
    interest: `Earned / estimated. Earned counts ${earnedLoans} only. Estimated counts ${whoseLoans}.`,
    completed: `Completed loans / ${whoseLoans}.`,
  };
}

export function commissionMetricDetails(place: SummaryDetailPlace = "range") {
  const set = loanSet(place);

  return {
    principal: `The most principal owed at the same time, on ${set.all} where you earn a commission. Loans on different days are not added together.`,
    estimate: `Commission not collected yet, on ${set.open} where you earn a commission.`,
    earned: `Commission from completed loans, on ${set.all} where you earn a commission.`,
    completed: `Completed loans / all ${set.all} where you earn a commission.`,
  };
}

export const dashboardMetricDetails = {
  totalPrincipal:
    "The most principal owed on any one day. Money lent again later is not added twice.",
  active: "The most principal still owed on open loans at the same time.",
  interestEstimate: "Interest on every loan, open and completed.",
  interestEarned: "Interest on completed loans only.",
} as const;

export const investorOverviewDetails = {
  totalCapital:
    "The most of this person's money owed on any one day. Loans running at the same time are added together.",
  active:
    "The most of this person's money still owed on open loans at the same time.",
  activeBankLoans: "Bank loan principal that is still being paid.",
  bankLoanCostPaid: "Interest and fees already paid on bank loans.",
  interestEstimate:
    "Interest on all of this person's loans, open and completed.",
  interestEarned: "Interest on this person's completed loans only.",
  netWithBank: "Loan interest, minus bank loan interest and fees already paid.",
  netWithoutBank: "Interest on all of this person's loans.",
} as const;

export const borrowerMetricDetails = {
  activeBalance: "Principal still owed on open loans.",
  interest: "Interest still owed on those open loans.",
  totalDue: "Principal plus interest still owed on open loans.",
  overdue: "Still owed on loans marked overdue.",
  completed: "Loans that are fully paid.",
} as const;
