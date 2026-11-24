import { test, expect } from "@playwright/test";
import {
  fetchJson,
  gotoApp,
  skipIfNoDatabase,
  waitForLoansTable,
} from "./helpers";

test.describe.configure({ mode: "serial", timeout: 90_000, retries: 1 });

async function clickFirstLoanRow(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  const row = page.locator("table tbody tr").first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  const dialog = page.getByRole("dialog").first();
  // Enter on the focused row opens quick view without landing on the signing
  // pill, which is a link to /loans/[id]/sign for the seeded dual-role user.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await row.focus();
    await page.keyboard.press("Enter");
    if (await dialog.isVisible().catch(() => false)) return;
    await page.waitForTimeout(500);
  }
  await expect(dialog).toBeVisible({ timeout: 10_000 });
}

test.beforeEach(({ page: _page }, testInfo) => {
  skipIfNoDatabase(testInfo);
});

test("loan quick-view modal shows summary and actions", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);

  const hasLoans = await waitForLoansTable(page);
  test.skip(!hasLoans, "No loans in database");

  await clickFirstLoanRow(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByText("Total Principal", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Total Interest", { exact: true }),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
  await page.keyboard.press("Escape");

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).not.toBeVisible();
});

test("loan create modal opens and closes", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);
  await waitForLoansTable(page);
  await page.waitForLoadState("networkidle");
  // The list restores saved date filters after mount; let that settle so the
  // New loan menu is not detached mid-click.
  await page.waitForTimeout(750);

  await page.getByRole("button", { name: /new loan/i }).click();
  // With templates the button opens a menu; without templates it opens the
  // form directly. Both are valid states in a shared test database.
  const blankLoan = page.getByRole("menuitem", { name: /blank loan/i });
  const dialog = page.getByRole("dialog");
  await expect
    .poll(
      async () => (await blankLoan.isVisible()) || (await dialog.isVisible()),
      {
        timeout: 15_000,
      },
    )
    .toBe(true);
  if (await blankLoan.isVisible()) await blankLoan.click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Create Loan" }),
  ).toBeVisible({
    timeout: 20_000,
  });

  await dialog.getByRole("button", { name: "Cancel" }).first().click();
  await expect(dialog).not.toBeVisible();
});

test("bank loan quick-view modal opens", async ({ page, request }) => {
  const debts = await fetchJson<Array<{ id: number }>>(request, "/api/debts");
  test.skip(!debts?.length, "No bank loans in database");

  const response = await gotoApp(page, "/debts");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Bank Loans", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(750);

  const firstRow = page.locator("table tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 20_000 });
  await firstRow.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByText("Principal", { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole("button", { name: "Actions" })).toBeVisible({
    timeout: 20_000,
  });

  // The bank-loan dialog's close button sits inside a scrollable shell that
  // Playwright's auto-scroll cannot settle; Escape is the standard close path.
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("loan fund payment dialog opens from quick-view", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);

  const hasLoans = await waitForLoansTable(page);
  test.skip(!hasLoans, "No loans in database");

  await clickFirstLoanRow(page);
  const loanDialog = page.getByRole("dialog");
  await expect(loanDialog).toBeVisible({ timeout: 15_000 });

  await loanDialog.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Fund Transfer" }).click();

  const paymentDialog = page.getByRole("dialog").last();
  await expect(paymentDialog.getByRole("heading")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("contract details modal paints editor instead of a stuck skeleton", async ({
  page,
}) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Loans", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(750);
  const moreActions = page
    .getByRole("button", { name: "More actions" })
    .first();
  await expect(moreActions).toBeVisible({ timeout: 20_000 });
  await moreActions.click();
  const contractDetailsItem = page.getByRole("menuitem", {
    name: "Contract Details",
  });
  await expect(contractDetailsItem).toBeVisible({ timeout: 10_000 });
  await contractDetailsItem.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByRole("heading", { name: "Contract details" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /download contract/i }),
  ).toBeVisible();
  await expect(dialog.getByText("Contract setup")).toBeVisible({
    timeout: 15_000,
  });
  await expect(dialog.getByText("Parties & signatures")).toBeVisible();
});

test("contract details from loan quick-view stacks without freezing", async ({
  page,
}) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);

  await clickFirstLoanRow(page);

  const loanDialog = page.getByRole("dialog").first();
  await expect(loanDialog).toBeVisible({ timeout: 15_000 });
  await loanDialog.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Contract Details" }).click();

  const contractDialog = page.getByRole("dialog").last();
  await expect(
    contractDialog.getByRole("heading", { name: "Contract details" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(contractDialog.getByText("Contract setup")).toBeVisible({
    timeout: 15_000,
  });
});

test("contract details opens for a second loan after closing the first", async ({
  page,
}) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");

  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  const rowCount = await rows.count();
  test.skip(rowCount < 2, "Need at least two loans in the table");

  async function openContractDetailsForRow(index: number) {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(750);
    const row = rows.nth(index);
    const trigger = row.getByRole("button", { name: "More actions" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const item = page.getByRole("menuitem", { name: "Contract Details" });
    await expect(item).toBeVisible({ timeout: 10_000 });
    await item.click();
  }

  await openContractDetailsForRow(0);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Contract details" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText("Contract setup")).toBeVisible({
    timeout: 15_000,
  });

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const body = document.body;
        return (
          body.style.overflow !== "hidden" &&
          body.style.pointerEvents !== "none"
        );
      });
    })
    .toBe(true);

  await openContractDetailsForRow(1);
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Contract details" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("dialog").getByText("Contract setup"),
  ).toBeVisible({
    timeout: 15_000,
  });
});
