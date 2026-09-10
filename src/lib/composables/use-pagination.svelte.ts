export function createPagination<T>(items: T[], itemsPerPage = 10) {
  let currentPage = $state(1);

  const totalPages = $derived(
    Math.max(1, Math.ceil(items.length / itemsPerPage)),
  );
  const startIndex = $derived((currentPage - 1) * itemsPerPage);
  const endIndex = $derived(startIndex + itemsPerPage);
  const paginatedItems = $derived(items.slice(startIndex, endIndex));

  function goToPage(page: number) {
    currentPage = Math.max(1, Math.min(page, totalPages));
  }

  function resetPage() {
    currentPage = 1;
  }

  return {
    get currentPage() {
      return currentPage;
    },
    get totalPages() {
      return totalPages;
    },
    get startIndex() {
      return startIndex;
    },
    get endIndex() {
      return endIndex;
    },
    get paginatedItems() {
      return paginatedItems;
    },
    goToPage,
    resetPage,
  };
}
