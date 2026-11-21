import { test, expect } from "@playwright/test";
import {
  gotoApp,
  skipIfNoDatabase,
  waitForLoansTable,
  fetchJson,
} from "./helpers";

test.describe.configure({ mode: "serial", timeout: 90_000, retries: 1 });

// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
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

test("dashboard keeps the floating desktop layout", async ({ page }) => {
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
  expect(fontSize).toBeGreaterThanOrEqual(20);

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
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
});

test("loans list keeps the floating desktop layout", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);
  await waitForLoansTable(page);
  await expectFloatingSidebar(page);
  await expect(page.getByText("Loans you operate and can edit.")).toBeVisible();

  const newLoan = page.getByRole("button", { name: /new loan/i }).first();
  await expect(newLoan).toBeVisible();
  await expect
    .poll(async () => (await newLoan.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(36);

  const viewButton = page.getByRole("button", { name: "View" }).first();
  if (await viewButton.isVisible()) {
    const viewBox = await viewButton.boundingBox();
    expect(viewBox, "loan row View should be laid out at 1440").toBeTruthy();
  }
});

test("create loan modal keeps the form layout", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);
  await waitForLoansTable(page);
  await page.waitForLoadState("networkidle");
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
    dialog.getByRole("heading", { name: "Create Loan", exact: true }),
  ).toBeVisible({
    timeout: 20_000,
  });

  await expect(dialog.getByRole("button", { name: "Close" })).toHaveCount(0);
  // The form is lazy-loaded inside the dialog; wait for a real field before
  // measuring the header actions or the skeleton can win the race.
  await expect(dialog.locator("#dueDate")).toBeVisible({ timeout: 20_000 });
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

test("investors, bank loans, and settings pages keep their titles and layout", async ({
  page,
}) => {
  let response = await gotoApp(page, "/investors");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Investors", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Lender contacts and their loan activity."),
  ).toBeVisible();
  await expectFloatingSidebar(page);

  response = await gotoApp(page, "/debts");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Bank Loans", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Bank loans from your lender contacts, separate from loans you issue.",
    ),
  ).toBeVisible();

  response = await gotoApp(page, "/settings");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Data & maintenance")).toBeVisible();
  await expect(
    page.getByText("Account, payment methods, backups, and maintenance tools."),
  ).toBeVisible();
});

test("remaining dashboard routes keep the floating sidebar", async ({
  page,
  request,
}) => {
  const extraListRoutes: Array<{ path: string; heading: string }> = [
    { path: "/investments", heading: "Loans" },
    { path: "/borrowed", heading: "Loans" },
    { path: "/witnessed", heading: "Loans" },
    { path: "/borrowers", heading: "Borrowers" },
    { path: "/witnesses", heading: "Witnesses" },
    { path: "/debts/new", heading: "Create Bank Loan" },
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
  }

  // Detail snapshot uses a fixed loan so the image does not depend on which
  // row happens to be first in the developer or CI database.
  const visualInvestors = await fetchJson<Array<{ id: number }>>(
    request,
    "/api/investors?simple=true",
  );
  const visualBorrowers = await fetchJson<Array<{ id: number }>>(
    request,
    "/api/borrowers?simple=true",
  );
  if (visualInvestors?.[0] && visualBorrowers?.[0]) {
    const created = await request.post("/api/loans", {
      data: {
        loanData: {
          borrowerId: visualBorrowers[0].id,
          loanName: "Visual Parity Loan",
          type: "Agent",
          dueDate: "2027-12-31",
        },
        investorData: [
          {
            investorId: visualInvestors[0].id,
            amount: 50000,
            interestRate: 10,
            interestType: "rate",
            sentDate: "2026-11-21",
            isPaid: true,
            receipts: [
              {
                imageUrl: "data:image/png;base64,iVBORw0KGgo=",
                extractedData: null,
              },
            ],
          },
        ],
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const createdLoan = (await created.json()) as { id: number };
    try {
      const response = await gotoApp(page, `/loans/${createdLoan.id}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible(
        {
          timeout: 20_000,
        },
      );
      await expectFloatingSidebar(page);
    } finally {
      await request.delete(`/api/loans/${createdLoan.id}`);
    }
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
  }
});
