import { test, expect } from "@playwright/test";
import {
  gotoApp,
  skipIfNoDatabase,
  waitForLoansTable,
  fetchJson,
} from "./helpers";

test.describe.configure({ mode: "serial", timeout: 90_000, retries: 1 });

test.beforeEach((_fixtures, testInfo) => {
  skipIfNoDatabase(testInfo);
});

async function expectFloatingSidebar(page: import("@playwright/test").Page) {
  const aside = page.locator("aside").first();
  await expect(aside).toBeVisible();
  const box = await aside.boundingBox();
  expect(box, "sidebar should be laid out").toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(12);
  expect(box!.x).toBeLessThan(24);
  expect(box!.y).toBeGreaterThanOrEqual(12);
  expect(box!.y).toBeLessThan(24);
  const radius = await aside.evaluate(
    (el) => getComputedStyle(el).borderTopLeftRadius,
  );
  expect(parseFloat(radius)).toBeGreaterThanOrEqual(24);
}

async function expectTitleBesideActions(
  container: import("@playwright/test").Locator,
  titleName: string,
  submitName: string,
) {
  const title = container
    .getByRole("heading", { name: titleName, exact: true })
    .first();
  const submit = container.getByRole("button", { name: submitName }).first();
  const cancel = container.getByRole("button", { name: "Cancel" }).first();
  await expect(title).toBeVisible();
  await expect(submit).toBeVisible();
  await expect(cancel).toBeVisible();

  const titleBox = await title.boundingBox();
  const submitBox = await submit.boundingBox();
  const cancelBox = await cancel.boundingBox();
  expect(titleBox && submitBox && cancelBox).toBeTruthy();
  expect(submitBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width);
  expect(Math.abs(submitBox!.y - titleBox!.y)).toBeLessThan(16);
  expect(cancelBox!.x).toBeLessThan(submitBox!.x);
}

test("dashboard chrome matches legacy desktop layout", async ({ page }) => {
  const response = await gotoApp(page, "/dashboard");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expectFloatingSidebar(page);

  const title = page.getByRole("heading", { name: "Dashboard", exact: true });
  const fontSize = await title.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  expect(fontSize).toBeGreaterThanOrEqual(28);

  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Overview of your lending performance and upcoming activity.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Total Principal", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Needs attention", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Trends & insights", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Distribution", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.03,
  });
});

test("loans list chrome matches legacy desktop layout", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);
  await waitForLoansTable(page);
  await expectFloatingSidebar(page);
  await expect(page.getByText("Manage all your loans")).toBeVisible();

  const newLoan = page.getByRole("button", { name: /new loan/i }).first();
  await expect(newLoan).toBeVisible();
  const newLoanBox = await newLoan.boundingBox();
  expect(newLoanBox?.height).toBeGreaterThanOrEqual(36);

  const viewButton = page.getByRole("button", { name: "View" }).first();
  if (await viewButton.isVisible()) {
    const viewBox = await viewButton.boundingBox();
    expect(viewBox, "loan row View should be laid out at 1440").toBeTruthy();
  }

  await expect(page).toHaveScreenshot("loans.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.03,
  });
});

test("create loan modal matches legacy form chrome", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);
  await waitForLoansTable(page);

  await page.getByRole("button", { name: /new loan/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Create Loan", exact: true }),
  ).toBeVisible({
    timeout: 20_000,
  });

  await expect(dialog.getByRole("button", { name: "Close" })).toHaveCount(0);
  await expectTitleBesideActions(dialog, "Create Loan", "Create Loan");
  await expect(dialog.getByText("Loan Details", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("Investors", { exact: true }).first(),
  ).toBeVisible();
  await expect(dialog.getByText("Summary", { exact: true })).toBeVisible();

  const dueDate = dialog.locator("#dueDate");
  await expect(dueDate).toBeVisible();
  const dueBox = await dueDate.boundingBox();
  expect(dueBox?.height).toBeGreaterThanOrEqual(40);
  expect(
    dueBox?.width,
    "create-loan fields should use the wide dialog column",
  ).toBeGreaterThan(360);

  const dialogBox = await dialog.boundingBox();
  expect(
    dialogBox?.width,
    "create-loan dialog should be max-w-4xl",
  ).toBeGreaterThan(700);

  const borrowerTrigger = dialog.locator("#borrowerId");
  await expect(borrowerTrigger).toBeVisible();
  const borrowerBox = await borrowerTrigger.boundingBox();
  expect(borrowerBox?.height).toBeGreaterThanOrEqual(40);
  expect(borrowerBox?.width).toBeGreaterThan(360);

  await expect(dialog).toHaveScreenshot("loan-create-modal.png", {
    maxDiffPixelRatio: 0.03,
  });
});

test("create loan page header keeps actions on the right", async ({ page }) => {
  const response = await gotoApp(page, "/loans/new");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Create Loan", exact: true }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expectTitleBesideActions(page, "Create Loan", "Create Loan");
  await expect(page.getByText("Loan Details", { exact: true })).toBeVisible();
  await expect(page.getByText("Summary", { exact: true })).toBeVisible();
});

test("investors, borrowings, and settings pages keep legacy titles", async ({
  page,
}) => {
  let response = await gotoApp(page, "/investors");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Investors", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Track investor portfolios and balances"),
  ).toBeVisible();
  await expectFloatingSidebar(page);
  await expect(page).toHaveScreenshot("investors.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.03,
  });

  response = await gotoApp(page, "/debts");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Borrowings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Track borrowings and projected interest costs"),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("debts.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.03,
  });

  response = await gotoApp(page, "/settings");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Data & maintenance")).toBeVisible();
  await expect(
    page.getByText("Maintenance tools and data exports for your workspace."),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("settings.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.03,
  });
});

test("remaining dashboard routes keep floating sidebar chrome", async ({
  page,
  request,
}) => {
  const extraListRoutes: Array<{ path: string; heading: string }> = [
    { path: "/investments", heading: "Investments" },
    { path: "/borrowed", heading: "Borrowed" },
    { path: "/witnessed", heading: "Witnessed" },
    { path: "/borrowers", heading: "Borrowers" },
    { path: "/witnesses", heading: "Witnesses" },
    { path: "/transactions", heading: "Transactions" },
    { path: "/debts/new", heading: "Create Borrowing" },
    { path: "/investors/new", heading: "Create Investor" },
    { path: "/borrowers/new", heading: "Create Borrower" },
    { path: "/witnesses/new", heading: "Create Witness" },
  ];

  for (const route of extraListRoutes) {
    const response = await gotoApp(page, route.path);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expectFloatingSidebar(page);
    await expect(page).toHaveScreenshot(
      `${route.path.replaceAll("/", "-").replace(/^-/, "")}.png`,
      { fullPage: true, maxDiffPixelRatio: 0.03 },
    );
  }

  const loans = await fetchJson<Array<{ id: number }>>(request, "/api/loans");
  const loanId = loans?.[0]?.id;
  if (loanId) {
    const response = await gotoApp(page, `/loans/${loanId}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expectFloatingSidebar(page);
    await expect(page).toHaveScreenshot("loan-detail.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  }

  const investors = await fetchJson<Array<{ id: number }>>(
    request,
    "/api/investors",
  );
  const investorId = investors?.[0]?.id;
  if (investorId) {
    const response = await gotoApp(page, `/investors/${investorId}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("tab", { name: /overview/i })).toBeVisible({
      timeout: 20_000,
    });
    await expectFloatingSidebar(page);
    await expect(page).toHaveScreenshot("investor-detail.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  }

  const debts = await fetchJson<Array<{ id: number }>>(request, "/api/debts");
  const debtId = debts?.[0]?.id;
  if (debtId) {
    const response = await gotoApp(page, `/debts/${debtId}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByText("Principal", { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expectFloatingSidebar(page);
    await expect(page).toHaveScreenshot("debt-detail.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  }
});
