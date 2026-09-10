import type { MultiSelectOption } from "$lib/components/common/MultiSelectFilter.svelte";

export const LIST_FILTER_TRIGGER_CLASS =
  "w-full shrink-0 sm:w-[10rem] xl:w-[11.25rem]";

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

export type LoanActivityFilter = "all" | "with_loans" | "without_loans";

export const LOAN_ACTIVITY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "with_loans", label: "With loans" },
  { value: "without_loans", label: "No loans" },
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
