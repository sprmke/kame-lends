import type { ApexOptions } from "apexcharts";

export const CHART_HEIGHT = 280;
export const PIE_SIZE = 240;
export const CHART_FONT = "Figtree, ui-sans-serif, system-ui, sans-serif";

export const CHART_PALETTE = {
  primary: "#fb9f44",
  teal: "#34b39a",
  coral: "#dc6b6b",
  violet: "#7c6dcb",
  gold: "#d4a535",
};

const CHART_PALETTE_DARK = {
  primary: "#fb9f44",
  teal: "#34b39a",
  coral: "#dc6b6b",
  violet: "#7c6dcb",
  gold: "#d4a535",
};

export const DONUT_RADIUS = 78;
export const DONUT_STROKE = 26;
export const DONUT_GAP = 8;
export const DONUT_PATH = `M ${PIE_SIZE / 2} ${PIE_SIZE / 2 - DONUT_RADIUS} a ${DONUT_RADIUS} ${DONUT_RADIUS} 0 1 1 0 ${DONUT_RADIUS * 2} a ${DONUT_RADIUS} ${DONUT_RADIUS} 0 1 1 0 ${-DONUT_RADIUS * 2}`;

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function chartAnimations(): NonNullable<
  NonNullable<ApexOptions["chart"]>["animations"]
> {
  if (prefersReducedMotion()) {
    return { enabled: false, speed: 0, animateGradually: { enabled: false } };
  }

  return {
    enabled: true,
    speed: 520,
    easing: "easeOutCubic",
    animateGradually: { enabled: true, delay: 70 },
    dynamicAnimation: { enabled: true, speed: 280 },
  };
}

export function isDarkTheme(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

export function chartPalette() {
  return isDarkTheme() ? CHART_PALETTE_DARK : CHART_PALETTE;
}

export function donutArcs(
  slices: { name: string; value: number; color: string }[],
  total: number,
  radius = DONUT_RADIUS,
  gap = DONUT_GAP,
) {
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const indexed = slices.map((slice, index) => ({ ...slice, index }));
  const start = indexed.reduce(
    (best, slice, i) => (slice.value > indexed[best].value ? i : best),
    0,
  );
  const ordered = [...indexed.slice(start), ...indexed.slice(0, start)];

  return ordered.map((slice) => {
    const raw = total > 0 ? (slice.value / total) * circumference : 0;
    const sliceGap = raw > gap * 2 ? gap : Math.min(gap * 0.4, raw * 0.12);
    const length = Math.max(0, raw - sliceGap);
    const arc = {
      ...slice,
      length,
      remainder: circumference - length,
      offset,
    };
    offset += raw;
    return arc;
  });
}

export function sliceColor(name: string, index = 0): string {
  const palette = chartPalette();
  const named: Record<string, string> = {
    "Lot Title": palette.primary,
    "OR/CR": palette.violet,
    Agent: palette.coral,
    "Fully Funded": palette.teal,
    "Partially Funded": palette.gold,
    Completed: palette.primary,
    Overdue: palette.coral,
  };
  const fallback = [
    palette.primary,
    palette.teal,
    palette.violet,
    palette.coral,
    palette.gold,
  ];
  return named[name] ?? fallback[index % fallback.length];
}

/** Resolve a CSS variable to a concrete color ApexCharts can paint in SVG. */
export function themeFill(cssVarName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.color = `var(${cssVarName})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || fallback;
}

export function barChartHeight(rows: number): number {
  return Math.max(200, Math.min(340, rows * 72 + 24));
}

export function truncateLabel(value: string, max = 18): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1))}…`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function tooltipCard(
  title: string,
  rows: { label: string; value: string; color: string }[],
): string {
  const items = rows
    .map(
      (row) =>
        `<div class="chart-tooltip-row"><span class="chart-tooltip-swatch" style="background:${row.color}"></span><span>${escapeHtml(row.label)}</span><span class="chart-tooltip-value">${escapeHtml(row.value)}</span></div>`,
    )
    .join("");

  return `<div class="chart-tooltip"><p class="chart-tooltip-title">${escapeHtml(title)}</p>${items}</div>`;
}

export function baseApexOptions(): ApexOptions {
  const muted = "var(--muted-foreground)";
  const border = "var(--border)";

  return {
    chart: {
      fontFamily: CHART_FONT,
      background: "transparent",
      foreColor: muted,
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      animations: chartAnimations(),
      parentHeightOffset: 0,
      redrawOnParentResize: true,
      redrawOnWindowResize: true,
      dropShadow: { enabled: false },
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: border,
      strokeDashArray: 4,
      padding: { top: 8, right: 8, left: 4, bottom: 0 },
    },
    legend: { show: false },
    states: {
      hover: { filter: { type: "none", value: 0 } },
      active: { filter: { type: "none", value: 0 } },
    },
    tooltip: {
      theme: isDarkTheme() ? "dark" : "light",
      style: { fontFamily: CHART_FONT, fontSize: "12px" },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: muted, fontSize: "11px", fontFamily: CHART_FONT },
      },
      crosshairs: { show: false },
    },
    yaxis: {
      reversed: false,
      labels: {
        style: { colors: muted, fontSize: "12px", fontFamily: CHART_FONT },
      },
    },
  };
}
