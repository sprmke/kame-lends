export type FilterState = Record<string, string | string[] | number | boolean>;

export function createFilters<T>(
  items: T[],
  filterFn: (item: T, filters: FilterState) => boolean,
) {
  let filters = $state<FilterState>({});

  const filteredItems = $derived(
    items.filter((item) => filterFn(item, filters)),
  );

  function setFilter(key: string, value: string | string[] | number | boolean) {
    filters = { ...filters, [key]: value };
  }

  function clearFilter(key: string) {
    const next = { ...filters };
    delete next[key];
    filters = next;
  }

  function clearAllFilters() {
    filters = {};
  }

  const hasActiveFilters = $derived(Object.keys(filters).length > 0);

  return {
    get filters() {
      return filters;
    },
    get filteredItems() {
      return filteredItems;
    },
    setFilter,
    clearFilter,
    clearAllFilters,
    get hasActiveFilters() {
      return hasActiveFilters;
    },
  };
}
