import { filterEnum, filterString } from "$lib/list-filter-bindings";
import {
  compactListFilterValues,
  type ListFilterValues,
} from "$lib/list-filter-persistence";
import {
  LOAN_ACTIVITY_FILTER_OPTIONS,
  WITNESS_SIGNING_FILTER_OPTIONS,
  type LoanActivityFilter,
  type WitnessSigningFilter,
} from "$lib/list-filters";
import type { ViewMode } from "$lib/composables/use-responsive-view-mode.svelte";

export const WITNESS_LIST_FILTER_KEYS = [
  "q",
  "view",
  "activity",
  "signing",
] as const;

const VIEW_MODES = new Set<ViewMode>([
  "table",
  "cards",
  "calendar",
  "timeline",
]);

export function parseWitnessListFilterValues(values: ListFilterValues) {
  const viewRaw = filterString(values, "view", "");
  const view = VIEW_MODES.has(viewRaw as ViewMode)
    ? (viewRaw as ViewMode)
    : null;
  return {
    searchQuery: filterString(values, "q", ""),
    view,
    loanActivityFilter: filterEnum(
      values,
      "activity",
      "all",
      LOAN_ACTIVITY_FILTER_OPTIONS.map((o) => o.value),
    ) as LoanActivityFilter,
    signingFilter: filterEnum(
      values,
      "signing",
      "all",
      WITNESS_SIGNING_FILTER_OPTIONS.map((o) => o.value),
    ) as WitnessSigningFilter,
  };
}

export function snapshotWitnessListFilters(state: {
  searchQuery: string;
  view: ViewMode | null;
  loanActivityFilter: LoanActivityFilter;
  signingFilter: WitnessSigningFilter;
}): ListFilterValues {
  return compactListFilterValues({
    q: state.searchQuery,
    view: state.view ?? "",
    activity:
      state.loanActivityFilter === "all" ? "" : state.loanActivityFilter,
    signing: state.signingFilter === "all" ? "" : state.signingFilter,
  });
}
