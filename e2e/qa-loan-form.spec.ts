import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { e2ePaymentReceipt, gotoApp, skipIfNoDatabase } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const receiptFile = path.join(__dirname, "fixtures/receipts/receipt-1.png");

test.describe.configure({ mode: "serial", timeout: 120_000, retries: 1 });

test.beforeEach(({ page: _page }, testInfo) => {
  skipIfNoDatabase(testInfo);
});

async function firstParty(
  request: import("@playwright/test").APIRequestContext,
) {
  const investors = (await request
    .get("/api/investors?simple=true")
    .then((r) => r.json())) as Array<{ id: number; name: string }>;
  const borrowers = (await request
    .get("/api/borrowers?simple=true")
    .then((r) => r.json())) as Array<{ id: number; name: string }>;
  expect(investors.length).toBeGreaterThan(0);
  expect(borrowers.length).toBeGreaterThan(0);
  return {
    investorId: investors[0].id,
    borrowerId: borrowers[0].id,
    borrowerName: borrowers[0].name,
  };
}

test("loan template saves after editing its numeric term", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  await gotoApp(page, "/settings");
  await page.waitForTimeout(1200);

  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Loan templates" })
    .first();
  await card.getByRole("button", { name: "Add" }).click();
  const dialog = page.getByRole("dialog").last();
  await dialog.locator("#template-name").fill(`E2E Template ${stamp}`);
  await dialog.locator("#template-loan-name").fill("E2E template loan");
  await dialog.locator("#template-term").fill("30");

  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/loan-templates") &&
      res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save" }).last().click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const template = (await response.json()) as { id: number; termDays: number };
  expect(template.termDays).toBe(30);
  await request.delete(`/api/loan-templates/${template.id}`);
});

test("multi-interest loan saves without a separate transaction rate and sorts periods on edit", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const { investorId, borrowerName } = await firstParty(request);
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({
      json: { enabled: false, features: { receipt_extraction: false } },
    }),
  );
  let upload = 0;
  await page.route("**/api/storage/upload", (route) => {
    upload += 1;
    return route.fulfill({
      json: { storageRef: `storage:e2e/multi-form-${upload}.png` },
    });
  });

  await gotoApp(page, `/loans/new?investorId=${investorId}`);
  await page.waitForTimeout(1200);
  await page.locator("#borrowerId").click();
  await page.getByRole("button", { name: borrowerName }).last().click();
  await page.locator("#loanName").fill(`E2E Multi Form ${stamp}`);
  await page.locator("#dueDate").fill("2027-03-31");
  await page.locator('input[id^="principal-"]').first().fill("60000");
  await page.locator('input[id^="sent-date-"]').first().fill("2026-11-21");
  await page.getByRole("tab", { name: /Multiple Interest/i }).click();
  await page.waitForTimeout(500);
  const rates = page.getByLabel(/Interest rate for period \d+/);
  for (let index = 0; index < (await rates.count()); index += 1) {
    await rates.nth(index).fill("2");
  }
  await page
    .locator('#investors-section input[id$="-receipt-file"]')
    .first()
    .setInputFiles(receiptFile);
  await page.waitForTimeout(700);

  const createPromise = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/loans") && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Loan" }).last().click();
  const create = await createPromise;
  expect(create.status()).toBe(201);
  const loan = (await create.json()) as { id: number };

  try {
    await gotoApp(page, `/loans/${loan.id}`);
    await page.waitForTimeout(1200);
    if (await page.getByRole("dialog").count()) {
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: /^Edit$/i }).click();
    await page.waitForTimeout(1500);
    const dates = await page
      .locator("#investors-section")
      .first()
      .locator('input[id^="period-date"]')
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
    expect(dates).toEqual([...dates].sort());
  } finally {
    await request.delete(`/api/loans/${loan.id}`);
  }
});

test("duplicate keeps the saved contract title", async ({ page, request }) => {
  const stamp = Date.now();
  const { investorId, borrowerId } = await firstParty(request);
  const create = await request.post("/api/loans", {
    data: {
      loanData: {
        borrowerId,
        loanName: `E2E Duplicate ${stamp}`,
        type: "Agent",
        dueDate: "2027-03-31",
      },
      investorData: [
        {
          investorId,
          amount: 10000,
          interestRate: 10,
          interestType: "rate",
          sentDate: "2026-11-21",
          isPaid: true,
          receipts: [e2ePaymentReceipt],
        },
      ],
      contractCustomization: { contractTitle: "E2E Custom Contract" },
    },
  });
  const loan = (await create.json()) as { id: number };
  try {
    await gotoApp(page, `/loans/${loan.id}`);
    await page.waitForTimeout(1200);
    if (await page.getByRole("dialog").count()) {
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: /Duplicate/i }).click();
    await expect(page).toHaveURL(/duplicate=/);
    await page.waitForTimeout(1000);
    await expect(page.locator("#contractTitle")).toHaveValue(
      "E2E Custom Contract",
    );
  } finally {
    await request.delete(`/api/loans/${loan.id}`);
  }
});
