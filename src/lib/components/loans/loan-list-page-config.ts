import { Eye, FileText, HandCoins, PiggyBank } from "lucide-svelte";
import type { IconComponent } from "$lib/types/icon";
import type { DatePreset } from "$lib/date/navigation";

export type LoanListPageScope =
  "loans" | "investments" | "borrowed" | "witnessed" | "group";

export type LoanListPageVariant = {
  documentTitle: string;
  defaultPageTitle: string;
  description: string;
  defaultEmptyMessage: string;
  emptyIcon: IconComponent;
  showDateRange: boolean;
  showLoanListSummary: boolean;
  showProfitSummary: boolean;
  showSyncCalendar: boolean;
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
    description: "Manage all your loans",
    defaultEmptyMessage: "No loans yet",
    emptyIcon: FileText,
    showDateRange: true,
    showLoanListSummary: true,
    showProfitSummary: false,
    showSyncCalendar: false,
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
    description: "Loans where you are an investor",
    defaultEmptyMessage: "No investments yet",
    emptyIcon: PiggyBank,
    showDateRange: true,
    showLoanListSummary: true,
    showProfitSummary: false,
    showSyncCalendar: true,
    showBulkActions: false,
    showGroupScopedInfo: true,
    groupScopeNoun: "investments",
    groupShowManageLink: false,
    embedded: false,
    defaultDatePreset: "month",
    listInvalidate: "app:loans",
    hideGroupBadges: false,
    showAddToGroup: false,
  },
  borrowed: {
    documentTitle: "Loans",
    defaultPageTitle: "Borrowed",
    description: "Loans where you are the borrower",
    defaultEmptyMessage: "No borrowed loans yet",
    emptyIcon: HandCoins,
    showDateRange: false,
    showLoanListSummary: false,
    showProfitSummary: true,
    showSyncCalendar: true,
    showBulkActions: false,
    showGroupScopedInfo: true,
    groupScopeNoun: "borrowed loans",
    groupShowManageLink: false,
    embedded: false,
    defaultDatePreset: "month",
    listInvalidate: "app:loans",
    hideGroupBadges: false,
    showAddToGroup: false,
  },
  witnessed: {
    documentTitle: "Loans",
    defaultPageTitle: "Witnessed",
    description: "Loans where you are a witness",
    defaultEmptyMessage: "No witnessed loans yet",
    emptyIcon: Eye,
    showDateRange: false,
    showLoanListSummary: false,
    showProfitSummary: true,
    showSyncCalendar: true,
    showBulkActions: false,
    showGroupScopedInfo: true,
    groupScopeNoun: "witnessed loans",
    groupShowManageLink: false,
    embedded: false,
    defaultDatePreset: "month",
    listInvalidate: "app:loans",
    hideGroupBadges: false,
    showAddToGroup: false,
  },
  group: {
    documentTitle: "Loans",
    defaultPageTitle: "Loans",
    description: "",
    defaultEmptyMessage: "No loans in this group yet",
    emptyIcon: FileText,
    showDateRange: true,
    showLoanListSummary: true,
    showProfitSummary: false,
    showSyncCalendar: false,
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
