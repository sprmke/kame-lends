import {
  filterBooleanParam,
  filterString,
  filterStringArray,
} from "$lib/list-filter-bindings";
import {
  compactListFilterValues,
  type ListFilterValues,
} from "$lib/list-filter-persistence";
import type { ViewMode } from "$lib/composables/use-responsive-view-mode.svelte";

export const DEBTS_LIST_FILTER_KEYS = [
  "q",
  "view",
  "repaid",
  "interval",
  "investor",
  "minAmount",
  "maxAmount",
] as const;

export type DebtsListFilterSnapshot = {
  searchQuery: string;
  view: ViewMode | null;
  showPastDebts: boolean;
  intervalFilter: string[];
  selectedInvestors: string[];
  minAmount: string;
  maxAmount: string;
};

const VIEW_MODES = new Set<ViewMode>([
  "table",
  "cards",
  "calendar",
  "timeline",
]);

export function parseDebtsListFilterValues(
  values: ListFilterValues,
): DebtsListFilterSnapshot {
  const viewRaw = filterString(values, "view", "");
  const view = VIEW_MODES.has(viewRaw as ViewMode)
    ? (viewRaw as ViewMode)
    : null;
  return {
    searchQuery: filterString(values, "q", ""),
    view,
    showPastDebts: filterBooleanParam(values, "repaid"),
    intervalFilter: filterStringArray(values, "interval"),
    selectedInvestors: filterStringArray(values, "investor"),
    minAmount: filterString(values, "minAmount"),
    maxAmount: filterString(values, "maxAmount"),
  };
}

export function snapshotDebtsListFilters(
  state: DebtsListFilterSnapshot,
): ListFilterValues {
  return compactListFilterValues({
    q: state.searchQuery,
    view: state.view ?? "",
    repaid: state.showPastDebts ? "show" : "",
    interval: state.intervalFilter,
    investor: state.selectedInvestors,
    minAmount: state.minAmount,
    maxAmount: state.maxAmount,
  });
}
