export function createMediaQuery(query: string, defaultMatches = false) {
  let matches = $state(defaultMatches);

  function init() {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    matches = mql.matches;
    const onChange = (event: MediaQueryListEvent) => {
      matches = event.matches;
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }

  return {
    get matches() {
      return matches;
    },
    init,
  };
}

export function createIsMobileOverlay(defaultMatches = false) {
  return createMediaQuery("(max-width: 767px)", defaultMatches);
}

export function createIsMobileShell(defaultMatches = false) {
  return createMediaQuery("(max-width: 1023px)", defaultMatches);
}
