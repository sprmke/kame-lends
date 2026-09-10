import { calculateLoanStats } from "$lib/calculations";
import { UNASSIGNED_PARTICIPANT_FILTER_VALUE } from "$lib/list-filters";
import type { LoanWithInvestors } from "$lib/types";

export interface LoanAmountFilterState {
  minPrincipal: string;
  maxPrincipal: string;
  minAvgRate: string;
  maxAvgRate: string;
  minInterest: string;
  maxInterest: string;
  minTotalAmount: string;
  maxTotalAmount: string;
}

export const EMPTY_LOAN_AMOUNT_FILTERS: LoanAmountFilterState = {
  minPrincipal: "",
  maxPrincipal: "",
  minAvgRate: "",
  maxAvgRate: "",
  minInterest: "",
  maxInterest: "",
  minTotalAmount: "",
  maxTotalAmount: "",
};

export function hasActiveLoanAmountFilters(
  filters: LoanAmountFilterState,
): boolean {
  return Object.values(filters).some((value) => value !== "");
}

export interface LoanParticipantFilterState {
  selectedInvestors: string[];
  selectedBorrowers: string[];
  selectedWitnesses: string[];
}

export const EMPTY_LOAN_PARTICIPANT_FILTERS: LoanParticipantFilterState = {
  selectedInvestors: [],
  selectedBorrowers: [],
  selectedWitnesses: [],
};

export function hasActiveLoanParticipantFilters(
  filters: LoanParticipantFilterState,
): boolean {
  return (
    filters.selectedInvestors.length > 0 ||
    filters.selectedBorrowers.length > 0 ||
    filters.selectedWitnesses.length > 0
  );
}

const WITNESS_PARTY_ROLES = new Set(["witness_1", "witness_2"]);

export function isLoanBorrowerUnassigned(loan: LoanWithInvestors): boolean {
  return (loan.borrowerId ?? loan.borrower?.id ?? null) === null;
}

export function isLoanWitnessUnassigned(loan: LoanWithInvestors): boolean {
  return getLoanWitnessIds(loan).length === 0;
}

export function getLoanWitnessIds(loan: LoanWithInvestors): number[] {
  const ids = (loan.signingInvitations ?? [])
    .filter(
      (invitation) =>
        WITNESS_PARTY_ROLES.has(invitation.partyRole) &&
        invitation.witnessId != null,
    )
    .map((invitation) => invitation.witnessId as number);

  return [...new Set(ids)];
}

export function matchesLoanParticipantFilters(
  loan: LoanWithInvestors,
  filters: LoanParticipantFilterState,
): boolean {
  if (filters.selectedInvestors.length > 0) {
    const matchesInvestor = loan.loanInvestors.some((entry) =>
      filters.selectedInvestors.includes(String(entry.investor.id)),
    );
    if (!matchesInvestor) return false;
  }

  if (filters.selectedBorrowers.length > 0) {
    const wantsUnassigned = filters.selectedBorrowers.includes(
      UNASSIGNED_PARTICIPANT_FILTER_VALUE,
    );
    const assignedBorrowerIds = filters.selectedBorrowers.filter(
      (value) => value !== UNASSIGNED_PARTICIPANT_FILTER_VALUE,
    );
    const borrowerId = loan.borrowerId ?? loan.borrower?.id ?? null;
    const matchesUnassigned = wantsUnassigned && isLoanBorrowerUnassigned(loan);
    const matchesAssigned =
      borrowerId !== null && assignedBorrowerIds.includes(String(borrowerId));

    if (!matchesUnassigned && !matchesAssigned) {
      return false;
    }
  }

  if (filters.selectedWitnesses.length > 0) {
    const wantsUnassigned = filters.selectedWitnesses.includes(
      UNASSIGNED_PARTICIPANT_FILTER_VALUE,
    );
    const assignedWitnessIds = filters.selectedWitnesses
      .filter((value) => value !== UNASSIGNED_PARTICIPANT_FILTER_VALUE)
      .map((value) => Number(value));
    const witnessIds = getLoanWitnessIds(loan);
    const matchesUnassigned = wantsUnassigned && isLoanWitnessUnassigned(loan);
    const matchesAssigned = assignedWitnessIds.some((witnessId) =>
      witnessIds.includes(witnessId),
    );

    if (!matchesUnassigned && !matchesAssigned) {
      return false;
    }
  }

  return true;
}

export function matchesLoanAmountFilters(
  loan: LoanWithInvestors,
  filters: LoanAmountFilterState,
): boolean {
  const stats = calculateLoanStats(loan);

  if (
    filters.minPrincipal !== "" &&
    stats.totalPrincipal < parseFloat(filters.minPrincipal)
  ) {
    return false;
  }
  if (
    filters.maxPrincipal !== "" &&
    stats.totalPrincipal > parseFloat(filters.maxPrincipal)
  ) {
    return false;
  }
  if (
    filters.minAvgRate !== "" &&
    stats.avgRate < parseFloat(filters.minAvgRate)
  )
    return false;
  if (
    filters.maxAvgRate !== "" &&
    stats.avgRate > parseFloat(filters.maxAvgRate)
  )
    return false;
  if (
    filters.minInterest !== "" &&
    stats.totalInterest < parseFloat(filters.minInterest)
  ) {
    return false;
  }
  if (
    filters.maxInterest !== "" &&
    stats.totalInterest > parseFloat(filters.maxInterest)
  ) {
    return false;
  }
  if (
    filters.minTotalAmount !== "" &&
    stats.totalAmount < parseFloat(filters.minTotalAmount)
  ) {
    return false;
  }
  if (
    filters.maxTotalAmount !== "" &&
    stats.totalAmount > parseFloat(filters.maxTotalAmount)
  ) {
    return false;
  }

  return true;
}
