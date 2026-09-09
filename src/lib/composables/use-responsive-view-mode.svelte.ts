export type ViewMode = "cards" | "table" | "calendar";

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
    mobileBreakpoint = 768,
  } = options;

  let isReady = $state(false);
  let isMobile = $state(false);
  let viewMode = $state<ViewMode>(defaultDesktopMode);

  function setViewMode(mode: ViewMode) {
    if (isMobile && mode === "table") {
      viewMode = "cards";
    } else {
      viewMode = mode;
    }
  }

  function init() {
    if (typeof window === "undefined") return;
    const mobile = window.innerWidth < mobileBreakpoint;
    isMobile = mobile;
    if (mobile && viewMode === "table") {
      viewMode = defaultMobileMode;
    }
    isReady = true;

    const handleResize = () => {
      const nowMobile = window.innerWidth < mobileBreakpoint;
      isMobile = nowMobile;
      if (nowMobile && viewMode === "table") {
        viewMode = defaultMobileMode;
      }
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
