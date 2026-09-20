import { isOpenLoan } from "$lib/calculations";
import type { MultiSelectOption } from "$lib/components/common/MultiSelectFilter.svelte";

export const LIST_FILTER_TRIGGER_CLASS =
  "w-full shrink-0 sm:w-[10rem] xl:w-[11.25rem]";

/** Full-width trigger inside More Filters grids (overrides LIST_FILTER_TRIGGER_CLASS widths). */
export const LIST_FILTER_PANEL_TRIGGER_CLASS = "w-full sm:w-full xl:w-full";

/** Inline list filters visible from `xl` up; duplicated in More Filters on smaller screens. */
export const LIST_FILTER_DESKTOP_TRIGGER_CLASS =
  "hidden w-full shrink-0 xl:flex xl:w-[11.25rem]";

export const LOAN_STATUS_FILTER_OPTIONS: MultiSelectOption[] = [
  { value: "Fully Funded", label: "Fully Funded" },
  { value: "Partially Funded", label: "Partially Funded" },
  { value: "Completed", label: "Completed" },
  { value: "Overdue", label: "Overdue" },
];

export const LOAN_TYPE_FILTER_OPTIONS: MultiSelectOption[] = [
  { value: "Lot Title", label: "Lot Title" },
  { value: "OR/CR", label: "OR/CR" },
  { value: "Agent", label: "Agent" },
];

export const DEBT_INTERVAL_FILTER_OPTIONS: MultiSelectOption[] = [
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
  { value: "Annually", label: "Annually" },
];

export const TRANSACTION_DIRECTION_FILTER_OPTIONS: MultiSelectOption[] = [
  { value: "In", label: "In" },
  { value: "Out", label: "Out" },
];

/** Synthetic multi-select value for loans missing a borrower or linked witness. */
export const UNASSIGNED_PARTICIPANT_FILTER_VALUE = "__unassigned__";

export const UNASSIGNED_PARTICIPANT_FILTER_OPTION: MultiSelectOption = {
  value: UNASSIGNED_PARTICIPANT_FILTER_VALUE,
  label: "Unassigned",
};

export type LoanActivityFilter = "all" | "with_loans" | "without_loans";

/** Witness list: any witnessed loan vs none. */
export const LOAN_ACTIVITY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "with_loans", label: "With loans" },
  { value: "without_loans", label: "No loans" },
] as const;

/** Investors / borrowers: filter by current loan exposure. */
export type ParticipantExposureFilter = "all" | "active" | "overdue";

export const PARTICIPANT_EXPOSURE_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
] as const;

export type WitnessSigningFilter = "all" | "signed" | "pending";

export const WITNESS_SIGNING_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "signed", label: "Signed" },
  { value: "pending", label: "Pending" },
] as const;

export function matchesLoanActivityFilter(
  loanCount: number,
  filter: LoanActivityFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "with_loans") return loanCount > 0;
  return loanCount === 0;
}

export function matchesParticipantExposureFilter(
  loans: Array<{ status: string }>,
  filter: ParticipantExposureFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "active") {
    return loans.some((loan) => isOpenLoan(loan));
  }
  return loans.some((loan) => loan.status === "Overdue");
}

export function matchesWitnessSigningFilter(
  invitations: Array<{ signedAt: Date | string | null }>,
  filter: WitnessSigningFilter,
): boolean {
  if (filter === "all") return true;
  const hasSigned = invitations.some(
    (invitation) => invitation.signedAt != null,
  );
  const hasPending = invitations.some(
    (invitation) => invitation.signedAt == null,
  );
  if (filter === "signed") return hasSigned;
  return hasPending;
}
