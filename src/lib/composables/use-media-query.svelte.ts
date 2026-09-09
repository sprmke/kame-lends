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
  /** Match the authenticated mobile shell (`lg` / 1024) so tablets get sheets too. */
  return createMediaQuery("(max-width: 1023px)", defaultMatches);
}

export function createIsMobileShell(defaultMatches = false) {
  return createMediaQuery("(max-width: 1023px)", defaultMatches);
}

/** One-shot check aligned with the mobile shell breakpoint (`lg` / 1024). */
export function isMobileShellViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 1023px)").matches
  );
}
