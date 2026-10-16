export type ViewMode = "cards" | "table" | "calendar" | "timeline";

export interface ResponsiveViewModeOptions {
  defaultDesktopMode?: ViewMode;
  defaultMobileMode?: ViewMode;
  mobileBreakpoint?: number;
}

export function createResponsiveViewMode(
  options: ResponsiveViewModeOptions = {},
) {
  const {
    defaultDesktopMode = "table",
    defaultMobileMode = "cards",
    mobileBreakpoint = 1024,
  } = options;

  let isReady = $state(false);
  let isMobile = $state(false);
  let viewMode = $state<ViewMode>(defaultDesktopMode);

  function coerceViewModeForMobileShell() {
    if (!isMobile) return;
    // Table and calendar are desktop-only in loan list UI; timeline replaces calendar on phone.
    if (viewMode === "table") {
      viewMode = defaultMobileMode;
    } else if (viewMode === "calendar") {
      viewMode = "timeline";
    }
  }

  function setViewMode(mode: ViewMode) {
    if (isMobile && mode === "table") {
      viewMode = defaultMobileMode;
    } else if (isMobile && mode === "calendar") {
      viewMode = "timeline";
    } else {
      viewMode = mode;
    }
  }

  function init() {
    if (typeof window === "undefined") return;
    const mobile = window.innerWidth < mobileBreakpoint;
    isMobile = mobile;
    coerceViewModeForMobileShell();
    isReady = true;

    const handleResize = () => {
      const nowMobile = window.innerWidth < mobileBreakpoint;
      isMobile = nowMobile;
      coerceViewModeForMobileShell();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }

  return {
    get viewMode() {
      return viewMode;
    },
    setViewMode,
    get isReady() {
      return isReady;
    },
    get isMobile() {
      return isMobile;
    },
    init,
  };
}
