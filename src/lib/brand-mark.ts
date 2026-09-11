/**
 * Kame Lends turtle mark (kame 亀 = turtle), drawn top-down on a 100×100 grid.
 * Shared by `BrandMark.svelte` and `scripts/brand/generate-brand-assets.ts` so the
 * in-app mark and the exported icons never drift apart.
 */

export const BRAND_MARK_VIEWBOX = "0 0 100 100";

export const BRAND_SHELL_PATH =
  "M50 25C65.5 25 76 37 76 53C76 70 64.5 83.5 50 85C35.5 83.5 24 70 24 53C24 37 34.5 25 50 25Z";

export const BRAND_HEAD = { cx: 50, cy: 16.5, rx: 8.2, ry: 9.6 } as const;

/** Right-side flippers; mirror with `BRAND_MIRROR_TRANSFORM` for the left side. */
export const BRAND_FRONT_FLIPPER_PATH =
  "M63 36C72 27.5 86 26 94.5 33.5C97.5 36.5 96 41 91.5 41.5C84 42.5 76.5 45 70 50Z";
export const BRAND_REAR_FLIPPER_PATH =
  "M63 74C70.5 74.5 77.5 79 80.5 86C81.8 89.3 79 91.8 76 90.2C70.5 87.4 65 84 60.5 81Z";
export const BRAND_TAIL_PATH = "M45 83L48.7 93.2Q50 96 51.3 93.2L55 83Z";
export const BRAND_MIRROR_TRANSFORM = "matrix(-1 0 0 1 100 0)";

const SHELL_CENTER = { x: 50, y: 54 };

export type BrandMarkDetail = "full" | "compact";

/**
 * Scute pattern cut into the shell (a central hexagon plus six seams to the rim) and
 * the gap between shell and limbs. `compact` uses a larger hexagon and heavier cuts so
 * the pattern survives at 16–32px (favicon, in-app `BrandIcon`).
 */
export function brandScutes(detail: BrandMarkDetail = "full") {
  const compact = detail === "compact";
  const radius = compact ? 13 : 12;
  const seam = compact ? 5 : 3.4;
  /** Stroke width of the shell cutout that separates head and flippers. */
  const limbGap = compact ? 8 : 7;
  const vertex = (r: number, i: number) => {
    const angle = (i * Math.PI) / 3;
    const x = SHELL_CENTER.x + r * Math.cos(angle);
    const y = SHELL_CENTER.y - r * Math.sin(angle);
    return [+x.toFixed(2), +y.toFixed(2)] as const;
  };
  const indices = [0, 1, 2, 3, 4, 5];
  const hexPoints = indices.map((i) => vertex(radius, i).join(",")).join(" ");
  const seamsPath = indices
    .map((i) => {
      const [x1, y1] = vertex(radius, i);
      const [x2, y2] = vertex(40, i);
      return `M${x1} ${y1}L${x2} ${y2}`;
    })
    .join("");
  return { hexPoints, seamsPath, seam, limbGap };
}
