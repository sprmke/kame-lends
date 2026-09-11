/**
 * Regenerates every Kame Lends logo asset from `src/lib/brand-mark.ts`.
 *
 *   bun run brand:assets
 *
 * Rasterizes with the Playwright Chromium already used for e2e (no extra deps).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  BRAND_FRONT_FLIPPER_PATH,
  BRAND_HEAD,
  BRAND_MARK_VIEWBOX,
  BRAND_MIRROR_TRANSFORM,
  BRAND_REAR_FLIPPER_PATH,
  BRAND_SHELL_PATH,
  BRAND_TAIL_PATH,
  brandScutes,
  type BrandMarkDetail,
} from "../../src/lib/brand-mark";
import { APP_DESCRIPTION, APP_NAME } from "../../src/lib/brand";

const STATIC_DIR = join(import.meta.dir, "../../static");
const BRAND_DIR = join(STATIC_DIR, "brand");

const COLORS = {
  light: "#FFBF73",
  primary: "#FB9F44",
  deep: "#E4702A",
  shadow: "#9A4312",
  canvas: "#FAF8F5",
  ink: "#2A1D12",
};

/** Mark group contents on the 100×100 grid. `id` keeps mask ids unique per SVG. */
function markBody(id: string, fill: string, detail: BrandMarkDetail): string {
  const { hexPoints, seamsPath, seam, limbGap } = brandScutes(detail);
  const h = BRAND_HEAD;
  return `<defs>
  <mask id="${id}-limbs" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
    <rect width="100" height="100" fill="#fff"/>
    <path d="${BRAND_SHELL_PATH}" fill="#000" stroke="#000" stroke-width="${limbGap}"/>
  </mask>
  <mask id="${id}-shell" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
    <rect width="100" height="100" fill="#fff"/>
    <g fill="none" stroke="#000" stroke-width="${seam}" stroke-linejoin="round" stroke-linecap="round">
      <polygon points="${hexPoints}"/>
      <path d="${seamsPath}"/>
    </g>
  </mask>
</defs>
<g fill="${fill}">
  <g mask="url(#${id}-limbs)">
    <ellipse cx="${h.cx}" cy="${h.cy}" rx="${h.rx}" ry="${h.ry}"/>
    <path d="${BRAND_FRONT_FLIPPER_PATH}"/>
    <path d="${BRAND_FRONT_FLIPPER_PATH}" transform="${BRAND_MIRROR_TRANSFORM}"/>
    <path d="${BRAND_REAR_FLIPPER_PATH}"/>
    <path d="${BRAND_REAR_FLIPPER_PATH}" transform="${BRAND_MIRROR_TRANSFORM}"/>
    <path d="${BRAND_TAIL_PATH}"/>
  </g>
  <path d="${BRAND_SHELL_PATH}" mask="url(#${id}-shell)"/>
</g>`;
}

type TileOptions = {
  /** Corner radius on the 512 canvas; 0 = full-bleed (iOS / maskable apply their own mask). */
  radius: number;
  /** Mark scale on the 512 canvas (mark grid is 100 units). */
  scale: number;
  detail: BrandMarkDetail;
  /** Glow, rim light, and drop shadow. Off for tiny favicons where they turn to mud. */
  depth: boolean;
};

function tileSvg(id: string, o: TileOptions): string {
  // Optical center of the mark sits at (50, 51) on its grid.
  const tx = +(256 - 50 * o.scale).toFixed(2);
  const ty = +(256 - 51 * o.scale).toFixed(2);
  const shape = (extra = "") =>
    o.radius > 0
      ? `<rect width="512" height="512" rx="${o.radius}" ${extra}/>`
      : `<rect width="512" height="512" ${extra}/>`;
  const fg = o.depth ? `url(#${id}-fg)` : "#FFFFFF";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${APP_NAME}">
<defs>
  <linearGradient id="${id}-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${COLORS.light}"/>
    <stop offset=".5" stop-color="${COLORS.primary}"/>
    <stop offset="1" stop-color="${COLORS.deep}"/>
  </linearGradient>${
    o.depth
      ? `
  <radialGradient id="${id}-glow" cx="150" cy="90" r="360" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity=".26"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="${id}-fg" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="1" stop-color="#FFF1E2"/>
  </linearGradient>
  <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="2.2" stdDeviation="2.2" flood-color="${COLORS.shadow}" flood-opacity=".32"/>
  </filter>`
      : ""
  }
</defs>
${shape(`fill="url(#${id}-bg)"`)}${
    o.depth
      ? `
${shape(`fill="url(#${id}-glow)"`)}${
          o.radius > 0
            ? `
<rect x="2.5" y="2.5" width="507" height="507" rx="${o.radius - 2.5}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="5"/>`
            : ""
        }`
      : ""
  }
<g transform="translate(${tx} ${ty}) scale(${o.scale})"${o.depth ? ` filter="url(#${id}-shadow)"` : ""}>
${markBody(id, fg, o.detail)}
</g>
</svg>
`;
}

/** Plain mark for light surfaces (docs, decks, partner material). */
function markSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}" role="img" aria-label="${APP_NAME}">
${markBody("km", COLORS.primary, "full")}
</svg>
`;
}

const ROUNDED = 115; // ≈22.5%, matches iOS/macOS icon rounding
const ICON: TileOptions = {
  radius: ROUNDED,
  scale: 3.4,
  detail: "full",
  depth: true,
};
const FAVICON: TileOptions = {
  radius: 112,
  scale: 4.3,
  detail: "compact",
  depth: false,
};
const APPLE: TileOptions = { ...ICON, radius: 0 };
const MASKABLE: TileOptions = { ...ICON, radius: 0, scale: 3.0 };

function ogHtml(iconSvg: string, markOnly: string): string {
  const icon = `data:image/svg+xml;utf8,${encodeURIComponent(iconSvg)}`;
  const mark = `data:image/svg+xml;utf8,${encodeURIComponent(markOnly)}`;
  const [primary, accent] = APP_NAME.split(" ");
  return `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600;700&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{position:relative;background:${COLORS.canvas};font-family:Figtree,system-ui,sans-serif;color:${COLORS.ink}}
  .glow{position:absolute;inset:0;background:
    radial-gradient(640px 520px at 1040px 110px, rgba(251,159,68,.30), transparent 70%),
    radial-gradient(520px 420px at 120px 640px, rgba(255,191,115,.22), transparent 70%)}
  .watermark{position:absolute;right:-90px;top:50px;width:620px;opacity:.10;transform:rotate(-14deg)}
  .content{position:absolute;left:96px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
  .icon{width:148px;height:148px;filter:drop-shadow(0 18px 30px rgba(154,67,18,.28))}
  h1{margin:44px 0 0;font-size:96px;font-weight:700;letter-spacing:-.035em;line-height:1}
  h1 span{color:${COLORS.deep}}
  p{margin:22px 0 0;font-size:34px;font-weight:500;color:rgba(42,29,18,.66);letter-spacing:-.01em;max-width:860px;line-height:1.25}
  .rule{position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,${COLORS.light},${COLORS.primary},${COLORS.deep})}
</style></head><body>
<div class="glow"></div>
<img class="watermark" src="${mark}" alt="">
<div class="content">
  <img class="icon" src="${icon}" alt="">
  <h1>${primary}${accent ? ` <span>${accent}</span>` : ""}</h1>
  <p>${APP_DESCRIPTION}</p>
</div>
<div class="rule"></div>
</body></html>`;
}

async function renderSvg(
  page: Page,
  svg: string,
  size: number,
): Promise<Buffer> {
  await page.setViewportSize({ width: size, height: size });
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block}</style><img src="${src}" width="${size}" height="${size}">`,
  );
  await page.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  return page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}

/** Packs PNG frames into a .ico container (PNG-in-ICO, supported by all current browsers). */
function toIco(frames: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map((f) => f.png)]);
}

async function main() {
  await mkdir(BRAND_DIR, { recursive: true });

  const iconSvg = tileSvg("ki", ICON);
  const faviconSvg = tileSvg("kf", FAVICON);
  const mark = markSvg();

  await writeFile(join(STATIC_DIR, "favicon.svg"), faviconSvg);
  await writeFile(join(BRAND_DIR, "kame-lends-icon.svg"), iconSvg);
  await writeFile(join(BRAND_DIR, "kame-lends-mark.svg"), mark);

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  const pngs: [string, string, number][] = [
    [join(STATIC_DIR, "icon-192.png"), iconSvg, 192],
    [join(STATIC_DIR, "icon-512.png"), iconSvg, 512],
    [join(STATIC_DIR, "icon-maskable-512.png"), tileSvg("km", MASKABLE), 512],
    [join(STATIC_DIR, "apple-touch-icon.png"), tileSvg("ka", APPLE), 180],
    [join(BRAND_DIR, "kame-lends-icon-1024.png"), iconSvg, 1024],
  ];
  for (const [path, svg, size] of pngs) {
    await writeFile(path, await renderSvg(page, svg, size));
  }

  const frames = [];
  for (const size of [16, 32, 48]) {
    frames.push({ size, png: await renderSvg(page, faviconSvg, size) });
  }
  await writeFile(join(STATIC_DIR, "favicon.ico"), toIco(frames));

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml(iconSvg, mark), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await writeFile(
    join(STATIC_DIR, "og-image.png"),
    await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }),
  );

  await browser.close();
  console.log("Brand assets written to static/ and static/brand/");
}

await main();
