/**
 * Capture PWA install-dialog screenshots from a preview build.
 *
 *   bun run build
 *   bun run preview --port 4174 &
 *   bun scripts/pwa/capture-screenshots.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { E2E_DEV_PORT } from "../dev/local-dev-port.mjs";

const STATIC_DIR = join(import.meta.dir, "../../static");
const SCREENSHOTS_DIR = join(STATIC_DIR, "screenshots");
const BASE_URL =
  process.env.PWA_SCREENSHOT_URL ?? `http://localhost:${E2E_DEV_PORT}`;

async function main() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  await writeFile(
    join(SCREENSHOTS_DIR, "narrow-dashboard.png"),
    await page.screenshot({ fullPage: false }),
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  await writeFile(
    join(SCREENSHOTS_DIR, "wide-dashboard.png"),
    await page.screenshot({ fullPage: false }),
  );

  await browser.close();
  console.log(`PWA screenshots written to ${SCREENSHOTS_DIR}`);
}

await main();
