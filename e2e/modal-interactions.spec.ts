import { test, expect } from "@playwright/test";
import {
  fetchJson,
  gotoApp,
  skipIfNoDatabase,
  waitForLoansTable,
} from "./helpers";

test.describe.configure({ mode: "serial", timeout: 90_000, retries: 1 });

test.beforeEach(({ page: _page }, testInfo) => {
  skipIfNoDatabase(testInfo);
});

test("loan quick-view modal shows summary and actions", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);

  const hasLoans = await waitForLoansTable(page);
  test.skip(!hasLoans, "No loans in database");

  await page
    .locator("table")
    .getByRole("button", { name: "View" })
    .first()
    .click();
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

  await page.getByRole("button", { name: /new loan/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Create Loan" }),
  ).toBeVisible({
    timeout: 20_000,
  });

  await dialog.getByRole("button", { name: "Cancel" }).first().click();
  await expect(dialog).not.toBeVisible();
});

test("borrowing quick-view modal opens", async ({ page, request }) => {
  const debts = await fetchJson<Array<{ id: number }>>(request, "/api/debts");
  test.skip(!debts?.length, "No borrowings in database");

  const response = await gotoApp(page, "/debts");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Borrowings", exact: true }),
  ).toBeVisible();

  await page.locator("table tbody tr").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByText("Principal", { exact: true }).first(),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Actions" })).toBeVisible();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).not.toBeVisible();
});

test("loan fund payment dialog opens from quick-view", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);

  const hasLoans = await waitForLoansTable(page);
  test.skip(!hasLoans, "No loans in database");

  await page
    .locator("table")
    .getByRole("button", { name: "View" })
    .first()
    .click();
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
  const moreActions = page
    .getByRole("button", { name: "More actions" })
    .first();
  await expect(moreActions).toBeVisible({ timeout: 20_000 });
  await moreActions.click();
  await page.getByRole("menuitem", { name: "Contract Details" }).click();

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

  const firstRow = page.locator("table tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 20_000 });
  await firstRow.click();

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

  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  const rowCount = await rows.count();
  test.skip(rowCount < 2, "Need at least two loans in the table");

  async function openContractDetailsForRow(index: number) {
    const row = rows.nth(index);
    await row.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Contract Details" }).click();
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
