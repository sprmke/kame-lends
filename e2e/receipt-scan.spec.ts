import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import { fetchJson, gotoApp, skipIfNoDatabase } from "./helpers";

/**
 * Receipts first: uploading receipts creates the transaction / payment rows
 * (receipts attached, fields prefilled). AI, status, and storage are mocked so
 * the test never calls a model, never writes to R2, and never saves payments.
 */
test.describe.configure({ mode: "serial", timeout: 120_000, retries: 1 });

// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
  skipIfNoDatabase(testInfo);
});

type LoanListItem = {
  id: number;
  loanInvestors: Array<{ investor: { id: number; name: string } }>;
};

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/receipts",
);

/** Distinct solid-color PNGs (content does not matter — the AI is mocked). */
function receiptFiles(count: number) {
  return Array.from({ length: count }, (_, i) =>
    path.join(FIXTURES, `receipt-${(i % 4) + 1}.png`),
  );
}

function reading(
  amount: number,
  date: string,
  reference: string,
  senderName: string | null,
  receiverName: string | null = null,
) {
  const transaction = {
    amount,
    currency: "PHP",
    date,
    time: null,
    status: "successful",
    referenceNumber: reference,
    senderName,
    senderBank: "GCash",
    receiverName,
    receiverBank: null,
    fee: null,
  };
  return {
    schemaVersion: 2,
    verdict: "valid",
    confidence: 0.92,
    summary: `GCash transfer ${reference}`,
    senderName,
    senderBank: "GCash",
    receiverName,
    receiverBank: null,
    amount,
    transactionDate: date,
    referenceNumber: reference,
    provider: "gemini",
    transactions: [transaction],
  };
}

type Reading = ReturnType<typeof reading> & {
  warnings?: Array<Record<string, unknown>>;
};

async function mockAi(page: Page, enabled: boolean, readings: Reading[] = []) {
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({
      json: {
        enabled,
        features: { receipt_extraction: enabled },
        reason: enabled ? null : "disabled",
      },
    }),
  );
  let call = 0;
  await page.route("**/api/ai/receipt-extraction", (route) => {
    const { warnings = [], ...data } =
      readings[call % Math.max(1, readings.length)] ?? ({} as Reading);
    call += 1;
    return route.fulfill({
      json: {
        success: true,
        data,
        warnings,
        imageHash: `hash-${call}`,
      },
    });
  });
  let upload = 0;
  await page.route("**/api/storage/upload", (route) => {
    upload += 1;
    return route.fulfill({
      json: { storageRef: `storage:e2e/receipt-${upload}.jpg` },
    });
  });
}

async function findSingleLenderLoan(page: Page) {
  const loans = await fetchJson<LoanListItem[]>(page.request, "/api/loans");
  return (
    loans?.find(
      (loan) =>
        new Set(loan.loanInvestors.map((li) => li.investor.id)).size === 1,
    ) ?? null
  );
}

async function openQuickPayment(page: Page, loanId: number, item: string) {
  const response = await gotoApp(page, `/loans/${loanId}`);
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  const menuItem = page.getByRole("menuitem", { name: item });
  // The menu ignores clicks until the page hydrates.
  await expect(async () => {
    await page.getByRole("button", { name: "Actions" }).first().click();
    await expect(menuItem).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await menuItem.click();
  const dialog = page.getByRole("dialog", { name: item });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

/** The empty-state dropzone of a dialog or form section. */
function dropzoneInput(scope: Page | ReturnType<Page["locator"]>) {
  return scope
    .locator('input[type="file"][aria-label="Upload receipts"]')
    .first();
}

test("fund transfer: dialog starts with upload; 4 receipts become 2 transfers", async ({
  page,
}) => {
  const loan = await findSingleLenderLoan(page);
  test.skip(!loan, "Needs a loan with a single lender");
  const lender = loan!.loanInvestors[0].investor.name;

  await mockAi(page, true, [
    reading(1000, "2026-10-01", "R-1", lender),
    reading(500, "2026-10-01", "R-2", lender),
    reading(2000, "2026-10-03", "R-3", lender),
    reading(2000, "2026-10-03", "R-3", lender), // same transfer, second screenshot
  ]);

  const dialog = await openQuickPayment(page, loan!.id, "Fund Transfer");
  // Receipts first: no blank transfer row until receipts are uploaded.
  await expect(dialog.getByTestId("payment-entry")).toHaveCount(0);
  await expect(dialog.getByLabel("Amount")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Fund Transfer" }),
  ).toBeDisabled();

  await dropzoneInput(dialog).setInputFiles(receiptFiles(4));

  const rows = dialog.getByTestId("payment-entry");
  await expect(rows).toHaveCount(2, { timeout: 30_000 });
  await expect(rows.nth(0).getByLabel("Amount")).toHaveValue("1500");
  await expect(rows.nth(0).getByLabel("Sent date")).toHaveValue("2026-10-01");
  await expect(rows.nth(0).getByAltText(/^Receipt \d+$/)).toHaveCount(2);
  await expect(rows.nth(0).getByText("2 transfers merged.")).toBeVisible();
  await expect(rows.nth(1).getByLabel("Amount")).toHaveValue("2000");
  await expect(rows.nth(1).getByLabel("Sent date")).toHaveValue("2026-10-03");
  await expect(rows.nth(1).getByAltText(/^Receipt \d+$/)).toHaveCount(2);

  await rows.nth(1).getByLabel("Amount").fill("2100");
  await expect(
    dialog.getByRole("button", { name: "Fund Transfers (2)" }),
  ).toBeEnabled();

  // More receipts later append rows.
  await mockAi(page, true, [reading(700, "2026-10-09", "R-9", lender)]);
  await dialog
    .locator('input[type="file"][aria-label="Add receipts"]')
    .setInputFiles(receiptFiles(1));
  await expect(rows).toHaveCount(3, { timeout: 30_000 });
  await expect(rows.nth(2).getByLabel("Amount")).toHaveValue("700");
  await page.keyboard.press("Escape");
});

test("received payment: merge and remove rows from the ⋯ menu", async ({
  page,
}) => {
  const loan = await findSingleLenderLoan(page);
  test.skip(!loan, "Needs a loan with a single lender");
  const lender = loan!.loanInvestors[0].investor.name;

  await mockAi(page, true, [
    reading(3000, "2026-10-05", "P-1", "Borrower", lender),
    reading(4000, "2026-10-09", "P-2", "Borrower", lender),
    reading(500, "2026-10-12", "P-3", "Borrower", lender),
  ]);

  const dialog = await openQuickPayment(page, loan!.id, "Add Received Payment");
  await dropzoneInput(dialog).setInputFiles(receiptFiles(3));

  const rows = dialog.getByTestId("payment-entry");
  await expect(rows).toHaveCount(3, { timeout: 30_000 });
  await expect(rows.nth(0).getByLabel("Received date")).toHaveValue(
    "2026-10-05",
  );

  await page.getByRole("button", { name: "Payment 2 actions" }).click();
  await page.getByRole("menuitem", { name: "Merge with previous" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByLabel("Amount")).toHaveValue("7000");
  await expect(rows.nth(0).getByAltText(/^Receipt \d+$/)).toHaveCount(2);

  await page.getByRole("button", { name: "Payment 1 actions" }).click();
  await page.getByRole("menuitem", { name: "Split receipts" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1).getByLabel("Amount")).toHaveValue("4000");

  await page.getByRole("button", { name: "Payment 3 actions" }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(rows).toHaveCount(2);
  await page.keyboard.press("Escape");
});

test("receipts already on this loan are skipped", async ({ page }) => {
  const loan = await findSingleLenderLoan(page);
  test.skip(!loan, "Needs a loan with a single lender");
  const lender = loan!.loanInvestors[0].investor.name;

  await mockAi(page, true, [
    {
      ...reading(900, "2026-09-01", "OLD-1", lender),
      warnings: [
        {
          code: "already_recorded",
          loanId: loan!.id,
          detail: "This loan",
          referenceNumber: "OLD-1",
        },
      ],
    },
    reading(1200, "2026-10-02", "NEW-1", lender),
  ]);

  const dialog = await openQuickPayment(page, loan!.id, "Fund Transfer");
  await dropzoneInput(dialog).setInputFiles(receiptFiles(2));
  const rows = dialog.getByTestId("payment-entry");
  await expect(rows).toHaveCount(1, { timeout: 30_000 });
  await expect(rows.nth(0).getByLabel("Amount")).toHaveValue("1200");
  await expect(
    page.getByText("1 transfer already on this loan was skipped."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});

test("AI off: each receipt becomes a row to fill in by hand", async ({
  page,
}) => {
  const loan = await findSingleLenderLoan(page);
  test.skip(!loan, "Needs a loan with a single lender");

  await mockAi(page, false);
  const dialog = await openQuickPayment(page, loan!.id, "Fund Transfer");
  await dropzoneInput(dialog).setInputFiles(receiptFiles(2));

  const rows = dialog.getByTestId("payment-entry");
  await expect(rows).toHaveCount(2, { timeout: 30_000 });
  await expect(rows.nth(0).getByLabel("Amount")).toHaveValue("");
  await expect(rows.nth(0).getByAltText(/^Receipt \d+$/)).toHaveCount(1);
  await expect(dialog.getByTestId("scan-row-notes")).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("row upload with two transfers offers Split into 2", async ({ page }) => {
  const loan = await findSingleLenderLoan(page);
  test.skip(!loan, "Needs a loan with a single lender");
  const lender = loan!.loanInvestors[0].investor.name;

  await mockAi(page, true, [reading(1100, "2026-10-01", "S-1", lender)]);
  const dialog = await openQuickPayment(page, loan!.id, "Fund Transfer");
  await dropzoneInput(dialog).setInputFiles(receiptFiles(1));
  const rows = dialog.getByTestId("payment-entry");
  await expect(rows).toHaveCount(1, { timeout: 30_000 });

  // Add two more screenshots to that row: different dates → offer a split.
  await mockAi(page, true, [
    reading(1100, "2026-10-01", "S-1", lender),
    reading(2200, "2026-10-04", "S-2", lender),
  ]);
  await rows
    .nth(0)
    .locator('input[id$="-receipt-file"]')
    .setInputFiles(receiptFiles(2));
  await expect(
    dialog.getByText("These look like 2 separate transfers."),
  ).toBeVisible({
    timeout: 30_000,
  });
  await dialog.getByRole("button", { name: "Split into 2" }).click();

  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByLabel("Amount")).toHaveValue("1100");
  await expect(rows.nth(1).getByLabel("Amount")).toHaveValue("2200");
  await expect(rows.nth(1).getByLabel("Sent date")).toHaveValue("2026-10-04");
  await page.keyboard.press("Escape");
});

test("edit loan: Add receipts appends principal transactions", async ({
  page,
}) => {
  const loan = await findSingleLenderLoan(page);
  test.skip(!loan, "Needs a loan with a single lender");
  const lender = loan!.loanInvestors[0].investor.name;

  await mockAi(page, true, [
    reading(7000, "2026-09-01", "L-1", lender),
    reading(8000, "2026-09-15", "L-2", lender),
  ]);

  const response = await gotoApp(page, `/loans/${loan!.id}`);
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  const edit = page.getByRole("menuitem", { name: "Edit" });
  await expect(async () => {
    await page.getByRole("button", { name: "Actions" }).first().click();
    await expect(edit).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await edit.click();

  const transactions = page.getByTestId("principal-transaction");
  await expect(transactions.first()).toBeVisible({ timeout: 30_000 });
  const before = await transactions.count();

  await page
    .locator('input[type="file"][aria-label="Add receipts"]')
    .first()
    .setInputFiles(receiptFiles(2));
  await expect(transactions).toHaveCount(before + 2, { timeout: 30_000 });
  const principals = page.locator('input[id^="principal-"]');
  await expect(principals.nth(before)).toHaveValue("7000");
  await expect(principals.nth(before + 1)).toHaveValue("8000");
  await expect(
    transactions.nth(before).getByAltText(/^Receipt \d+$/),
  ).toHaveCount(1);
});

test("edit loan: Received tab creates received payments from receipts", async ({
  page,
}) => {
  const loan = await findSingleLenderLoan(page);
  test.skip(!loan, "Needs a loan with a single lender");
  const lender = loan!.loanInvestors[0].investor.name;

  await mockAi(page, true, [
    reading(600, "2026-10-20", "RP-1", "Borrower", lender),
    reading(400, "2026-10-20", "RP-2", "Borrower", lender),
  ]);
  const response = await gotoApp(page, `/loans/${loan!.id}`);
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  const edit = page.getByRole("menuitem", { name: "Edit" });
  await expect(async () => {
    await page.getByRole("button", { name: "Actions" }).first().click();
    await expect(edit).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await edit.click();

  await page.getByRole("tab", { name: "Received Payments" }).first().click();
  const payments = page.getByTestId("received-payment");
  const before = await payments.count();
  const input =
    before === 0
      ? page.locator('input[type="file"][aria-label="Upload receipts"]').first()
      : page.locator('input[type="file"][aria-label="Add receipts"]').last();
  await input.setInputFiles(receiptFiles(2));

  // Same date → one payment with both receipts.
  await expect(payments).toHaveCount(before + 1, { timeout: 30_000 });
  const added = payments.nth(before);
  await expect(added.getByLabel("Amount")).toHaveValue("1000");
  await expect(added.getByLabel("Received Date")).toHaveValue("2026-10-20");
  await expect(added.getByAltText(/^Receipt \d+$/)).toHaveCount(2);
});

test("create loan: receipts add the matched investor, transactions and borrower", async ({
  page,
}) => {
  const investors = await fetchJson<Array<{ id: number; name: string }>>(
    page.request,
    "/api/investors?simple=true",
  );
  const borrowers = await fetchJson<Array<{ id: number; name: string }>>(
    page.request,
    "/api/borrowers?simple=true",
  );
  test.skip(
    !investors?.length || !borrowers?.length,
    "Needs an investor and a borrower",
  );
  const investor = investors![0];
  const borrower = borrowers![0];

  await mockAi(page, true, [
    reading(12000, "2026-10-02", "N-1", investor.name, borrower.name),
    reading(3000, "2026-10-06", "N-2", investor.name, borrower.name),
  ]);

  const response = await gotoApp(page, "/loans/new");
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");

  await dropzoneInput(page.locator("#investors-section")).setInputFiles(
    receiptFiles(2),
  );

  const transactions = page.getByTestId("principal-transaction");
  await expect(transactions).toHaveCount(2, { timeout: 30_000 });
  await expect(
    page
      .locator("#investors-section")
      .getByText(investor.name, { exact: true })
      .first(),
  ).toBeVisible();
  const principals = page.locator('input[id^="principal-"]');
  await expect(principals.nth(0)).toHaveValue("12000");
  await expect(principals.nth(1)).toHaveValue("3000");
  await expect(page.locator("#borrowerId")).toContainText(borrower.name);

  // Save the loan end to end, then clean up.
  const stamp = Date.now();
  await page.locator("#loanName").fill(`E2E Receipt Loan ${stamp}`);
  await page
    .locator("#dueDate")
    .fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const created = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/loans") && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Loan" }).last().click();
  const createdRes = await created;
  expect(createdRes.status(), await createdRes.text()).toBe(201);
  await expect(page).toHaveURL(/\/loans\/\d+/, { timeout: 30_000 });
  const loanId = Number(page.url().match(/\/loans\/(\d+)/)![1]);

  type Detail = {
    loanInvestors: Array<{
      amount: string;
      sentDate: string;
      receipts?: Array<{
        extractedData: { referenceNumber: string | null } | null;
      }>;
    }>;
  };
  const detail = await fetchJson<Detail>(page.request, `/api/loans/${loanId}`);
  expect(
    detail?.loanInvestors.map((li) => Number(li.amount)).sort((a, b) => a - b),
  ).toEqual([3000, 12000]);
  expect(
    detail?.loanInvestors.every((li) => (li.receipts?.length ?? 0) === 1),
  ).toBe(true);

  const deleted = await page.request.delete(`/api/loans/${loanId}`);
  expect(deleted.ok()).toBe(true);
});

test("new investor card starts with the upload dropzone", async ({ page }) => {
  const investors = await fetchJson<Array<{ id: number; name: string }>>(
    page.request,
    "/api/investors?simple=true",
  );
  test.skip(!investors?.length, "Needs an investor");

  await mockAi(page, true, [reading(5000, "2026-10-03", "C-1", null)]);
  const response = await gotoApp(
    page,
    `/loans/new?investorId=${investors![0].id}`,
  );
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");

  const section = page.locator("#investors-section");
  await expect(section.getByTestId("principal-transaction")).toHaveCount(0);
  await dropzoneInput(section).setInputFiles(receiptFiles(1));
  await expect(section.getByTestId("principal-transaction")).toHaveCount(1, {
    timeout: 30_000,
  });
  await expect(page.locator('input[id^="principal-"]').first()).toHaveValue(
    "5000",
  );
});

test("fund transfer saves receipts and the AI reading on the disbursement", async ({
  page,
}) => {
  const loan = await findSingleLenderLoan(page);
  test.skip(!loan, "Needs a loan with a single lender");
  const lender = loan!.loanInvestors[0].investor.name;
  const amount = 1234 + (Date.now() % 1000) / 100; // unique, findable

  await mockAi(page, true, [
    reading(amount, "2026-10-11", `SAVE-${amount}`, lender),
    reading(0.01, "2026-10-11", `SAVE2-${amount}`, lender),
  ]);
  const dialog = await openQuickPayment(page, loan!.id, "Fund Transfer");
  await dropzoneInput(dialog).setInputFiles(receiptFiles(2));
  const rows = dialog.getByTestId("payment-entry");
  // Same date + same lender → one disbursement with both receipts.
  await expect(rows).toHaveCount(1, { timeout: 30_000 });
  await rows.nth(0).getByLabel("Amount").fill(String(amount));

  const saved = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/loans/${loan!.id}/payments`) &&
      res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Fund Transfer" }).click();
  expect((await saved).status()).toBe(201);
  await expect(dialog).not.toBeVisible();

  type Detail = {
    loanInvestors: Array<{
      amount: string;
      receipts?: Array<{
        imageUrl: string;
        extractedData: {
          schemaVersion?: number;
          referenceNumber: string | null;
        } | null;
      }>;
    }>;
  };
  const detail = await fetchJson<Detail>(
    page.request,
    `/api/loans/${loan!.id}`,
  );
  const row = detail?.loanInvestors.find(
    (li) => Number(li.amount).toFixed(2) === amount.toFixed(2),
  );
  expect(row).toBeDefined();
  expect(row!.receipts).toHaveLength(2);
  expect(
    row!
      .receipts!.map((receipt) => receipt.extractedData?.referenceNumber)
      .sort(),
  ).toEqual([`SAVE-${amount}`, `SAVE2-${amount}`].sort());
  expect(
    row!.receipts!.every(
      (receipt) => receipt.extractedData?.schemaVersion === 2,
    ),
  ).toBe(true);
});

test("AI endpoints: auth, validation, and graceful no-key response (unmocked)", async ({
  page,
  playwright,
}) => {
  const status = await page.request.get("/api/ai/status");
  expect(status.ok()).toBe(true);
  const body = await status.json();
  expect(body).toHaveProperty("features.receipt_extraction");
  expect(JSON.stringify(body)).not.toMatch(/key|AIza/i);

  const bad = await page.request.post("/api/ai/receipt-extraction", {
    data: { imageDataUrl: "data:text/plain;base64,AAAA" },
  });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).success).toBe(false);

  const badPurpose = await page.request.post("/api/ai/receipt-extraction", {
    data: {
      imageDataUrl: "data:image/png;base64,AAAA",
      context: { purpose: "hack" },
    },
  });
  expect(badPurpose.status()).toBe(400);

  const png = (await import("node:fs"))
    .readFileSync(receiptFiles(1)[0])
    .toString("base64");
  const scan = await page.request.post("/api/ai/receipt-extraction", {
    data: {
      imageDataUrl: `data:image/png;base64,${png}`,
      context: { purpose: "fund_transfer" },
    },
  });
  expect(scan.status()).toBe(200);
  const result = await scan.json();
  if (!body.features.receipt_extraction) {
    expect(result).toMatchObject({ success: false, code: "not_configured" });
  } else {
    expect(typeof result.success).toBe("boolean");
  }

  const anonymous = await playwright.request.newContext({
    baseURL:
      page.url() === "about:blank"
        ? "http://localhost:4174"
        : new URL(page.url()).origin,
    storageState: { cookies: [], origins: [] },
  });
  const unauthorized = await anonymous.get("/api/ai/status");
  expect(unauthorized.status()).toBe(401);
  await anonymous.dispose();
});
