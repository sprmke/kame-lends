/** True when the tab has a prior history entry (in-app navigation, not a fresh landing). */
export function hasBrowserBackHistory(): boolean {
  return typeof window !== "undefined" && window.history.length > 1;
}

export function createCanNavigateBack(defaultMatches = false) {
  let matches = $state(defaultMatches);

  function init() {
    if (typeof window === "undefined") return;
    matches = hasBrowserBackHistory();
  }

  return {
    get matches() {
      return matches;
    },
    init,
  };
}
