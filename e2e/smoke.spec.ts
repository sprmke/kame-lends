import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Kame Lends/i);
});

test("sign-in page loads", async ({ page }) => {
  await page.goto("/signin");
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});
