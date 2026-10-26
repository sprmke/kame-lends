import { filterString, filterStringArray } from "$lib/list-filter-bindings";
import {
  compactListFilterValues,
  type ListFilterValues,
} from "$lib/list-filter-persistence";
import type { ViewMode } from "$lib/composables/use-responsive-view-mode.svelte";

export const LOAN_LIST_FILTER_KEYS = [
  "q",
  "view",
  "status",
  "type",
  "investor",
  "borrower",
  "witness",
  "minPrincipal",
  "maxPrincipal",
  "minAvgRate",
  "maxAvgRate",
  "minInterest",
  "maxInterest",
  "minTotalAmount",
  "maxTotalAmount",
] as const;

export type LoanListFilterSnapshot = {
  searchQuery: string;
  view: ViewMode | null;
  statusFilter: string[];
  typeFilter: string[];
  selectedInvestors: string[];
  selectedBorrowers: string[];
  selectedWitnesses: string[];
  minPrincipal: string;
  maxPrincipal: string;
  minAvgRate: string;
  maxAvgRate: string;
  minInterest: string;
  maxInterest: string;
  minTotalAmount: string;
  maxTotalAmount: string;
};

const VIEW_MODES = new Set<ViewMode>([
  "table",
  "cards",
  "calendar",
  "timeline",
]);

export function parseLoanListFilterValues(
  values: ListFilterValues,
): LoanListFilterSnapshot {
  const viewRaw = filterString(values, "view", "");
  const view = VIEW_MODES.has(viewRaw as ViewMode)
    ? (viewRaw as ViewMode)
    : null;
  return {
    searchQuery: filterString(values, "q", ""),
    view,
    statusFilter: filterStringArray(values, "status"),
    typeFilter: filterStringArray(values, "type"),
    selectedInvestors: filterStringArray(values, "investor"),
    selectedBorrowers: filterStringArray(values, "borrower"),
    selectedWitnesses: filterStringArray(values, "witness"),
    minPrincipal: filterString(values, "minPrincipal"),
    maxPrincipal: filterString(values, "maxPrincipal"),
    minAvgRate: filterString(values, "minAvgRate"),
    maxAvgRate: filterString(values, "maxAvgRate"),
    minInterest: filterString(values, "minInterest"),
    maxInterest: filterString(values, "maxInterest"),
    minTotalAmount: filterString(values, "minTotalAmount"),
    maxTotalAmount: filterString(values, "maxTotalAmount"),
  };
}

const ARRAY_FILTER_PARAMS = new Set<string>([
  "status",
  "type",
  "investor",
  "borrower",
  "witness",
]);

/** Build a full filter map from URL params; missing keys become empty. */
export function loanListFilterValuesFromUrl(
  partial: ListFilterValues,
): ListFilterValues {
  const full: ListFilterValues = {};
  for (const key of LOAN_LIST_FILTER_KEYS) {
    if (key in partial) {
      full[key] = partial[key]!;
    } else if (ARRAY_FILTER_PARAMS.has(key)) {
      full[key] = [];
    } else {
      full[key] = "";
    }
  }
  return full;
}

export function snapshotLoanListFilters(
  state: LoanListFilterSnapshot,
): ListFilterValues {
  return compactListFilterValues({
    q: state.searchQuery,
    view: state.view ?? "",
    status: state.statusFilter,
    type: state.typeFilter,
    investor: state.selectedInvestors,
    borrower: state.selectedBorrowers,
    witness: state.selectedWitnesses,
    minPrincipal: state.minPrincipal,
    maxPrincipal: state.maxPrincipal,
    minAvgRate: state.minAvgRate,
    maxAvgRate: state.maxAvgRate,
    minInterest: state.minInterest,
    maxInterest: state.maxInterest,
    minTotalAmount: state.minTotalAmount,
    maxTotalAmount: state.maxTotalAmount,
  });
}
