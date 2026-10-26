import { filterString, filterStringArray } from "$lib/list-filter-bindings";
import {
  compactListFilterValues,
  type ListFilterValues,
} from "$lib/list-filter-persistence";
import type { ViewMode } from "$lib/composables/use-responsive-view-mode.svelte";

export const TRANSACTIONS_LIST_FILTER_KEYS = [
  "q",
  "view",
  "direction",
  "investor",
] as const;

const VIEW_MODES = new Set<ViewMode>([
  "table",
  "cards",
  "calendar",
  "timeline",
]);

export function parseTransactionsListFilterValues(values: ListFilterValues) {
  const viewRaw = filterString(values, "view", "");
  const view = VIEW_MODES.has(viewRaw as ViewMode)
    ? (viewRaw as ViewMode)
    : null;
  return {
    searchQuery: filterString(values, "q", ""),
    view,
    directionFilter: filterStringArray(values, "direction"),
    selectedInvestors: filterStringArray(values, "investor"),
  };
}

export function snapshotTransactionsListFilters(state: {
  searchQuery: string;
  view: ViewMode | null;
  directionFilter: string[];
  selectedInvestors: string[];
}): ListFilterValues {
  return compactListFilterValues({
    q: state.searchQuery,
    view: state.view ?? "",
    direction: state.directionFilter,
    investor: state.selectedInvestors,
  });
}
