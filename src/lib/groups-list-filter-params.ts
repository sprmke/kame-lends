import { filterEnum, filterString } from "$lib/list-filter-bindings";
import {
  compactListFilterValues,
  type ListFilterValues,
} from "$lib/list-filter-persistence";

export const GROUPS_LIST_FILTER_KEYS = ["q", "sort"] as const;

export type GroupListSortMode = "attention" | "name" | "updated";

const SORT_VALUES: GroupListSortMode[] = ["attention", "name", "updated"];

export function parseGroupsListFilterValues(values: ListFilterValues) {
  return {
    searchQuery: filterString(values, "q", ""),
    sortMode: filterEnum(values, "sort", "attention", SORT_VALUES),
  };
}

export function snapshotGroupsListFilters(state: {
  searchQuery: string;
  sortMode: GroupListSortMode;
}): ListFilterValues {
  return compactListFilterValues({
    q: state.searchQuery,
    sort: state.sortMode === "attention" ? "" : state.sortMode,
  });
}
