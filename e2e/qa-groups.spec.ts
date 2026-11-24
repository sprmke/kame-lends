import { test, expect } from "@playwright/test";
import { gotoApp, skipIfNoDatabase } from "./helpers";

test.describe.configure({ mode: "serial", timeout: 120_000, retries: 1 });

test.beforeEach(({ page: _page }, testInfo) => {
  skipIfNoDatabase(testInfo);
});

test("group Add loans exposes Review and Add to group", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const loans = (await request
    .get("/api/loans")
    .then((r) => r.json())) as Array<{ id: number }>;
  expect(loans.length).toBeGreaterThan(0);

  const create = await request.post("/api/groups", {
    data: {
      name: `E2E Add Loans ${stamp}`,
      description: "Add loans sheet regression",
      color: "orange",
      loanIds: [],
      rules: [],
    },
  });
  expect(create.ok(), await create.text()).toBeTruthy();
  const group = (await create.json()) as { id: number };

  try {
    await gotoApp(page, `/groups/${group.id}?tab=loans`);
    await page.waitForTimeout(1200);
    const addLoans = page.getByRole("button", { name: /Add loans/i });
    const sheet = page.getByRole("dialog").last();
    const review = sheet.getByRole("button", { name: "Review" });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (await sheet.isVisible().catch(() => false)) break;
      await addLoans.click();
      await page.waitForTimeout(500);
    }
    await expect(review).toBeVisible({ timeout: 20_000 });

    const loanChecks = sheet.getByRole("checkbox");
    await expect(loanChecks.first()).toBeVisible({ timeout: 20_000 });
    const selectedCount = sheet.getByText(/\d+ selected/);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await loanChecks.nth(1).click();
      await page.waitForTimeout(300);
      const count = (await selectedCount.textContent())?.trim() ?? "";
      if (!count.startsWith("0 ")) break;
    }
    await expect(selectedCount).not.toHaveText(/^0 selected/);

    await review.click();
    const add = sheet.getByRole("button", { name: /Add to group/i });
    await expect(add).toBeVisible({ timeout: 20_000 });

    const addResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/groups/${group.id}/loans`) &&
        res.request().method() === "POST",
    );
    await add.click();
    expect((await addResponse).status()).toBe(201);
  } finally {
    await request.delete(`/api/groups/${group.id}`);
  }
});
