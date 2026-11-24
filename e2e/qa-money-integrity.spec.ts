import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { e2ePaymentReceipt, gotoApp, skipIfNoDatabase } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const receiptFile = path.join(__dirname, "fixtures/receipts/receipt-1.png");

test.describe.configure({ mode: "serial", timeout: 180_000, retries: 1 });

test.beforeEach(({ page: _page }, testInfo) => {
  skipIfNoDatabase(testInfo);
});

test("single-interest payment updates totals without reload, then edits and deletes", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const investors = (await request
    .get("/api/investors?simple=true")
    .then((r) => r.json())) as Array<{ id: number }>;
  const borrowers = (await request
    .get("/api/borrowers?simple=true")
    .then((r) => r.json())) as Array<{ id: number }>;
  expect(investors.length).toBeGreaterThan(0);
  expect(borrowers.length).toBeGreaterThan(0);
  const create = await request.post("/api/loans", {
    data: {
      loanData: {
        borrowerId: borrowers[0].id,
        loanName: `E2E Money Integrity ${stamp}`,
        type: "Agent",
        dueDate: "2027-01-31",
      },
      investorData: [
        {
          investorId: investors[0].id,
          amount: 50000,
          interestRate: 10,
          interestType: "rate",
          sentDate: "2026-11-21",
          isPaid: true,
          receipts: [e2ePaymentReceipt],
        },
      ],
    },
  });
  expect(create.ok(), await create.text()).toBeTruthy();
  const loan = (await create.json()) as { id: number };

  await page.route("**/api/ai/status", (route) =>
    route.fulfill({
      json: {
        enabled: false,
        features: { receipt_extraction: false },
        reason: "disabled",
      },
    }),
  );
  let upload = 0;
  await page.route("**/api/storage/upload", (route) => {
    upload += 1;
    return route.fulfill({
      json: { storageRef: `storage:e2e/money-integrity-${upload}.png` },
    });
  });

  try {
    const response = await gotoApp(page, `/loans/${loan.id}`);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("button", { name: "Record payment" }),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog").last();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await dialog.locator('input[id$="-amount"]').fill("55000");
    await dialog.locator('input[id$="-date"]').fill("2026-12-01");
    await dialog
      .locator('input[id$="-receipt-file"]')
      .setInputFiles(receiptFile);

    const payResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/loans/${loan.id}/received-payments`) &&
        res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /Add Received Payment/i }).click();
    expect((await payResponse).status()).toBe(201);

    await expect(
      page
        .locator(".dashboard-metric-cell", { hasText: "Total Received" })
        .getByText("₱55,000.00"),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page
        .locator(".dashboard-metric-cell", { hasText: "Status" })
        .getByText("Completed"),
    ).toBeVisible();

    const editPayment = page.getByRole("button", { name: "Edit payment" });
    await expect(editPayment).toBeVisible({ timeout: 20_000 });
    await editPayment.click();
    const edit = page.getByRole("dialog").last();
    await expect(edit).toBeVisible({ timeout: 20_000 });
    await edit.locator('input[id$="-amount"]').fill("50000");
    const editResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/received-payments/") &&
        res.request().method() === "PATCH",
    );
    await edit.getByRole("button", { name: "Save" }).click();
    expect((await editResponse).status()).toBe(200);

    await expect(
      page
        .locator(".dashboard-metric-cell", { hasText: "Total Received" })
        .getByText("₱50,000.00"),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page
        .locator(".dashboard-metric-cell", { hasText: "Total Balance" })
        .getByText("₱5,000.00"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Remove payment" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    const deleteResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/received-payments/") &&
        res.request().method() === "DELETE",
    );
    await confirm.getByRole("button", { name: "Delete" }).click();
    expect((await deleteResponse).status()).toBe(200);

    await expect(
      page
        .locator(".dashboard-metric-cell", { hasText: "Total Received" })
        .getByText("₱0.00"),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: "Record payment" }),
    ).toBeVisible();
  } finally {
    await request.delete(`/api/loans/${loan.id}`);
  }
});
