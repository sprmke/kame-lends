import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoApp, skipIfNoDatabase } from "./helpers";

const routes = [
  { path: "/dashboard", name: "dashboard" },
  { path: "/loans", name: "loans" },
  { path: "/investors", name: "investors" },
  { path: "/settings", name: "settings" },
  { path: "/debts", name: "debts" },
  { path: "/groups", name: "groups" },
  { path: "/privacy", name: "privacy" },
  { path: "/terms", name: "terms" },
  { path: "/loans/new", name: "loan create" },
];

for (const route of routes) {
  test(`${route.name} has no serious accessibility violations`, async ({
    page,
  }, testInfo) => {
    skipIfNoDatabase(testInfo);
    await gotoApp(page, route.path);
    await page.waitForTimeout(1200);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      serious.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  });
}
