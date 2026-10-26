import { filterEnum, filterString } from "$lib/list-filter-bindings";
import {
  compactListFilterValues,
  type ListFilterValues,
} from "$lib/list-filter-persistence";
import {
  PARTICIPANT_EXPOSURE_FILTER_OPTIONS,
  type ParticipantExposureFilter,
} from "$lib/list-filters";
import type { ViewMode } from "$lib/composables/use-responsive-view-mode.svelte";

export const PARTICIPANT_LIST_FILTER_KEYS = ["q", "view", "exposure"] as const;

const VIEW_MODES = new Set<ViewMode>([
  "table",
  "cards",
  "calendar",
  "timeline",
]);
const EXPOSURE_VALUES = PARTICIPANT_EXPOSURE_FILTER_OPTIONS.map((o) => o.value);

export function parseParticipantListFilterValues(values: ListFilterValues) {
  const viewRaw = filterString(values, "view", "");
  const view = VIEW_MODES.has(viewRaw as ViewMode)
    ? (viewRaw as ViewMode)
    : null;
  return {
    searchQuery: filterString(values, "q", ""),
    view,
    exposureFilter: filterEnum(
      values,
      "exposure",
      "all",
      EXPOSURE_VALUES,
    ) as ParticipantExposureFilter,
  };
}

export function snapshotParticipantListFilters(state: {
  searchQuery: string;
  view: ViewMode | null;
  exposureFilter: ParticipantExposureFilter;
}): ListFilterValues {
  return compactListFilterValues({
    q: state.searchQuery,
    view: state.view ?? "",
    exposure: state.exposureFilter === "all" ? "" : state.exposureFilter,
  });
}
