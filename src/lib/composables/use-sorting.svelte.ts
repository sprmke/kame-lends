export type SortDirection = "asc" | "desc";

export function createSorting<T, K extends keyof T>(
  items: T[],
  defaultField: K,
  defaultDirection: SortDirection = "asc",
  sortFn?: (items: T[], field: K, direction: SortDirection) => T[],
) {
  let sortField = $state<K>(defaultField);
  let sortDirection = $state<SortDirection>(defaultDirection);

  function handleSort(field: K) {
    if (sortField === field) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDirection = "asc";
    }
  }

  const sortedItems = $derived.by(() => {
    if (sortFn) return sortFn(items, sortField, sortDirection);
    return [...items].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  });

  return {
    get sortField() {
      return sortField;
    },
    get sortDirection() {
      return sortDirection;
    },
    get sortedItems() {
      return sortedItems;
    },
    handleSort,
  };
}
