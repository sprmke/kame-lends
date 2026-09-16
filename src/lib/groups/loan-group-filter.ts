import type {
  GroupChipData,
  GroupChipSelection,
} from "$lib/components/groups/types";
import type { LoanWithInvestors } from "$lib/types";

export type GroupsIndexItem = {
  id: number;
  name: string;
  color: string;
  loanCount?: number;
};

export function parseGroupSelection(param: string | null): GroupChipSelection {
  if (!param || param === "all") return "all";
  if (param === "ungrouped") return "ungrouped";
  const id = Number(param);
  return Number.isFinite(id) ? id : "all";
}

export function groupSelectionToParam(
  value: GroupChipSelection,
): string | null {
  if (value === "all") return null;
  if (value === "ungrouped") return "ungrouped";
  return String(value);
}

export function loanGroupIds(loan: LoanWithInvestors): number[] {
  if (loan.groupIds?.length) return loan.groupIds;
  return (loan.groupLoans ?? []).map((g) => g.groupId);
}

export function filterLoansByGroup(
  loans: LoanWithInvestors[],
  selected: GroupChipSelection,
): LoanWithInvestors[] {
  if (selected === "all") return loans;
  if (selected === "ungrouped") {
    return loans.filter((loan) => loanGroupIds(loan).length === 0);
  }
  return loans.filter((loan) => loanGroupIds(loan).includes(selected));
}

export function buildGroupChipsForLoans(
  loans: LoanWithInvestors[],
  groupsIndex: GroupsIndexItem[],
): GroupChipData[] {
  const counts = new Map<number, number>();
  for (const loan of loans) {
    for (const id of loanGroupIds(loan)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return groupsIndex
    .filter((g) => (counts.get(g.id) ?? 0) > 0)
    .map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      loanCountOnPage: counts.get(g.id) ?? 0,
    }));
}

export function countUngrouped(loans: LoanWithInvestors[]): number {
  return loans.filter((loan) => loanGroupIds(loan).length === 0).length;
}

export function badgesForLoan(
  loan: LoanWithInvestors,
  groupsIndex: GroupsIndexItem[],
): Array<{ id: number; name: string; color: string }> {
  const ids = new Set(loanGroupIds(loan));
  return groupsIndex
    .filter((g) => ids.has(g.id))
    .map((g) => ({ id: g.id, name: g.name, color: g.color }));
}
