/** Tailwind grid classes for summary metric card rows (server + client safe). */
export function getSummaryMetricGridCols(count: number) {
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  if (count === 4) return "grid-cols-2 lg:grid-cols-4";
  if (count === 5) return "grid-cols-2 md:grid-cols-3 2xl:grid-cols-5";
  // 6+ metrics: 3-column rows (never 5–6 columns on one line)
  return "grid-cols-2 md:grid-cols-3";
}

/** Last visible card spans both columns below lg (grids that stay 2-col until lg). */
export const ODD_LAST_MOBILE_SPAN = "col-span-2 lg:col-span-1" as const;

/**
 * Put on a 2-col metric grid when every child is rendered (no `hidden` siblings).
 * Last child spans full width while the grid is still 2 columns. See dashboard.css.
 */
export const ODD_LAST_TWO_COL_GRID = "summary-2col-odd-last" as const; // span below lg
export const ODD_LAST_TWO_COL_GRID_UNTIL_MD =
  "summary-2col-odd-last-md" as const; // span below md

export function oddLastMobileSpanClass(gridClass: string) {
  if (/\bsm:grid-cols-(?:[3-9]|1[0-2])\b/.test(gridClass)) {
    return "col-span-2 sm:col-span-1";
  }
  if (/\bmd:grid-cols-(?:[3-9]|1[0-2])\b/.test(gridClass)) {
    return "col-span-2 md:col-span-1";
  }
  return ODD_LAST_MOBILE_SPAN;
}

export function summaryGridIsTwoColMobile(gridClass: string) {
  return /(?:^|\s)(?:[\w-]+:)*grid-cols-2(?:\s|$)/.test(gridClass);
}

export function getOddLastVisibleMobileSpan(args: {
  empty: boolean;
  isLastVisible: boolean;
  visibleCount: number;
  gridClass: string;
}) {
  if (args.empty || !args.isLastVisible || args.visibleCount % 2 !== 1) {
    return "";
  }
  if (!summaryGridIsTwoColMobile(args.gridClass)) return "";
  return oddLastMobileSpanClass(args.gridClass);
}

/** Max metrics on investor detail overview (2 capital + 2 debt + 3 interest + net + lot). */
export const INVESTOR_DETAIL_METRIC_COUNT = 9;

/** Investor detail always uses 3 columns on md+ regardless of metric count. */
export const INVESTOR_DETAIL_SUMMARY_GRID =
  "grid-cols-2 md:grid-cols-3" as const;

/** Borrower detail summary cards (balance, due, overdue, completed, lot). */
export const BORROWER_DETAIL_SUMMARY_GRID =
  "grid-cols-2 md:grid-cols-3" as const;
