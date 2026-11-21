import { test, expect } from "@playwright/test";
import { gotoApp, skipIfNoDatabase } from "./helpers";

/**
 * WebKit smoke (TEST-11).
 *
 * A second engine catches Safari-only layout and runtime failures. Axe is not
 * run here: the settings page is too heavy for WebKit's axe pass in CI.
 */
test.beforeEach(({ page: _page }, testInfo) => {
  skipIfNoDatabase(testInfo);
});

const routes = [
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/loans", heading: "Loans" },
  { path: "/loans/new", heading: "Create Loan" },
  { path: "/investors", heading: "Investors" },
];

for (const route of routes) {
  test(`${route.path} renders in WebKit`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await gotoApp(page, route.path);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  });
}
