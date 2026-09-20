import {
  BadgePercent,
  Eye,
  FileText,
  HandCoins,
  PiggyBank,
} from "lucide-svelte";
import type { IconComponent } from "$lib/types/icon";
import type { DatePreset } from "$lib/date/navigation";
import { PAGE_DESCRIPTIONS } from "$lib/page-descriptions";

export type LoanListPageScope =
  "loans" | "investments" | "borrowed" | "commissioned" | "witnessed" | "group";

export type LoanListPageVariant = {
  documentTitle: string;
  defaultPageTitle: string;
  description: string;
  defaultEmptyMessage: string;
  emptyIcon: IconComponent;
  showDateRange: boolean;
  showLoanListSummary: boolean;
  showProfitSummary: boolean;
  showCommissionSummary: boolean;
  showAddCommission: boolean;
  showBulkActions: boolean;
  showGroupScopedInfo: boolean;
  groupScopeNoun: string;
  groupShowManageLink: boolean;
  /** Hub embed: no page header, title, or outer dashboard chrome. */
  embedded: boolean;
  defaultDatePreset: DatePreset;
  listInvalidate: string;
  hideGroupBadges: boolean;
  showAddToGroup: boolean;
};

export const LOAN_LIST_PAGE_VARIANTS: Record<
  LoanListPageScope,
  LoanListPageVariant
> = {
  loans: {
    documentTitle: "Loans",
    defaultPageTitle: "Loans",
    description: PAGE_DESCRIPTIONS.loans.loans,
    defaultEmptyMessage: "No loans yet",
    emptyIcon: FileText,
    showDateRange: true,
    showLoanListSummary: true,
    showProfitSummary: false,
    showCommissionSummary: false,
    showAddCommission: true,
    showBulkActions: true,
    showGroupScopedInfo: false,
    groupScopeNoun: "loans",
    groupShowManageLink: true,
    embedded: false,
    defaultDatePreset: "month",
    listInvalidate: "app:loans",
    hideGroupBadges: false,
    showAddToGroup: true,
  },
  investments: {
    documentTitle: "Investments",
    defaultPageTitle: "Investments",
    description: PAGE_DESCRIPTIONS.loans.investments,
    defaultEmptyMessage: "No investments yet",
    emptyIcon: PiggyBank,
    showDateRange: true,
    showLoanListSummary: true,
    showProfitSummary: false,
    showCommissionSummary: false,
    showAddCommission: true,
    showBulkActions: true,
    showGroupScopedInfo: true,
    groupScopeNoun: "investments",
    groupShowManageLink: false,
    embedded: false,
    defaultDatePreset: "month",
    listInvalidate: "app:loans",
    hideGroupBadges: false,
    showAddToGroup: true,
  },
  borrowed: {
    documentTitle: "Loans",
    defaultPageTitle: "Borrowed",
    description: PAGE_DESCRIPTIONS.loans.borrowed,
    defaultEmptyMessage: "No borrowed loans yet",
    emptyIcon: HandCoins,
    showDateRange: true,
    showLoanListSummary: true,
    showProfitSummary: false,
    showCommissionSummary: false,
    showAddCommission: true,
    showBulkActions: true,
    showGroupScopedInfo: true,
    groupScopeNoun: "borrowed loans",
    groupShowManageLink: false,
    embedded: false,
    defaultDatePreset: "month",
    listInvalidate: "app:loans",
    hideGroupBadges: false,
    showAddToGroup: true,
  },
  commissioned: {
    documentTitle: "Loans",
    defaultPageTitle: "Commissioned",
    description: PAGE_DESCRIPTIONS.loans.commissioned,
    defaultEmptyMessage: "No commissioned loans yet",
    emptyIcon: BadgePercent,
    showDateRange: true,
    showLoanListSummary: false,
    showProfitSummary: false,
    showCommissionSummary: true,
    showAddCommission: true,
    showBulkActions: true,
    showGroupScopedInfo: true,
    groupScopeNoun: "commissioned loans",
    groupShowManageLink: false,
    embedded: false,
    defaultDatePreset: "month",
    listInvalidate: "app:loans",
    hideGroupBadges: false,
    showAddToGroup: true,
  },
  witnessed: {
    documentTitle: "Loans",
    defaultPageTitle: "Witnessed",
    description: PAGE_DESCRIPTIONS.loans.witnessed,
    defaultEmptyMessage: "No witnessed loans yet",
    emptyIcon: Eye,
    showDateRange: true,
    showLoanListSummary: true,
    showProfitSummary: false,
    showCommissionSummary: false,
    showAddCommission: true,
    showBulkActions: true,
    showGroupScopedInfo: true,
    groupScopeNoun: "witnessed loans",
    groupShowManageLink: false,
    embedded: false,
    defaultDatePreset: "month",
    listInvalidate: "app:loans",
    hideGroupBadges: false,
    showAddToGroup: true,
  },
  group: {
    documentTitle: "Loans",
    defaultPageTitle: "Loans",
    description: PAGE_DESCRIPTIONS.loans.group,
    defaultEmptyMessage: "No loans in this group yet",
    emptyIcon: FileText,
    showDateRange: true,
    showLoanListSummary: true,
    showProfitSummary: false,
    showCommissionSummary: false,
    showAddCommission: false,
    showBulkActions: true,
    showGroupScopedInfo: false,
    groupScopeNoun: "loans",
    groupShowManageLink: false,
    embedded: true,
    defaultDatePreset: "all-time",
    listInvalidate: "app:groups",
    hideGroupBadges: true,
    showAddToGroup: false,
  },
};

/** URL `?scope=` and list-query keys that are not `LoanListPageScope`. */
const SCOPE_ALIASES: Record<string, LoanListPageScope> = {
  mine: "loans",
  investing: "investments",
  owned: "loans",
};

export function resolveLoanListPageScope(
  scope: string | null | undefined,
): LoanListPageScope {
  if (scope && Object.hasOwn(LOAN_LIST_PAGE_VARIANTS, scope)) {
    return scope as LoanListPageScope;
  }
  if (scope && Object.hasOwn(SCOPE_ALIASES, scope)) {
    return SCOPE_ALIASES[scope]!;
  }
  return "loans";
}

export function resolveLoanListPageVariant(
  scope: string | null | undefined,
): LoanListPageVariant {
  return LOAN_LIST_PAGE_VARIANTS[resolveLoanListPageScope(scope)];
}
