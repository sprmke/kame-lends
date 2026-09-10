import { test, expect } from "@playwright/test";
import { fetchJson, gotoApp, skipIfNoDatabase } from "./helpers";

test.describe.configure({ mode: "serial", timeout: 60_000, retries: 1 });

test.beforeEach(({}, testInfo) => {
  skipIfNoDatabase(testInfo);
});

test("dashboard renders", async ({ page }) => {
  const response = await gotoApp(page, "/dashboard");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});

test("loans list renders with table columns", async ({ page }) => {
  const response = await gotoApp(page, "/loans");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Loans", exact: true }),
  ).toBeVisible();

  const emptyState = page.getByText("No loans found");
  const interestHeader = page.getByRole("button", { name: /^interest$/i });
  await expect(emptyState.or(interestHeader)).toBeVisible({ timeout: 20_000 });

  if (await emptyState.isVisible()) {
    await expect(
      page.getByRole("link", { name: /create your first loan/i }),
    ).toBeVisible();
    return;
  }

  await expect(interestHeader).toBeVisible();
  await expect(page.getByRole("button", { name: /^amount$/i })).toBeVisible();
});

test("loan create form renders", async ({ page }) => {
  const response = await gotoApp(page, "/loans/new");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Create Loan" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: /borrower/i })).toBeVisible();
});

test("investors list renders", async ({ page }) => {
  const response = await gotoApp(page, "/investors");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Investors", exact: true }),
  ).toBeVisible();
});

test("borrowers list renders", async ({ page }) => {
  const response = await gotoApp(page, "/borrowers");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Borrowers", exact: true }),
  ).toBeVisible();
});

test("witnesses list renders", async ({ page }) => {
  const response = await gotoApp(page, "/witnesses");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Witnesses", exact: true }),
  ).toBeVisible();
});

test("witness detail renders", async ({ page, request }) => {
  const witnesses = await fetchJson<Array<{ id: number }>>(
    request,
    "/api/witnesses?simple=true",
  );
  const witnessId = witnesses?.[0]?.id ?? null;
  test.skip(!witnessId, "No witnesses in database");

  const response = await gotoApp(page, `/witnesses/${witnessId}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("investor detail renders", async ({ page, request }) => {
  const investors = await fetchJson<Array<{ id: number }>>(
    request,
    "/api/investors",
  );
  const investorId = investors?.[0]?.id ?? null;
  test.skip(!investorId, "No investors in database");

  const response = await gotoApp(page, `/investors/${investorId}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("tab", { name: /overview/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("tab", { name: /loans/i })).toBeVisible();
});

test("borrowings list renders", async ({ page }) => {
  const response = await gotoApp(page, "/debts");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Borrowings", exact: true }),
  ).toBeVisible();
});

test("borrowing create form renders", async ({ page }) => {
  const response = await gotoApp(page, "/debts/new");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Create Borrowing" }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText("Select Investors", { exact: true }),
  ).toBeVisible();
});

test("settings renders", async ({ page }) => {
  const response = await gotoApp(page, "/settings");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Data & maintenance")).toBeVisible();
});

test("loan detail page renders", async ({ page, request }) => {
  const loans = await fetchJson<Array<{ id: number }>>(request, "/api/loans");
  const loanId = loans?.[0]?.id ?? null;
  test.skip(!loanId, "No loans in database");

  const response = await gotoApp(page, `/loans/${loanId}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("borrower detail renders", async ({ page, request }) => {
  const borrowers = await fetchJson<Array<{ id: number }>>(
    request,
    "/api/borrowers?simple=true",
  );
  const borrowerId = borrowers?.[0]?.id ?? null;
  test.skip(!borrowerId, "No borrowers in database");

  const response = await gotoApp(page, `/borrowers/${borrowerId}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("borrowing detail page renders", async ({ page, request }) => {
  const debts = await fetchJson<Array<{ id: number }>>(request, "/api/debts");
  const debtId = debts?.[0]?.id ?? null;
  test.skip(!debtId, "No borrowings in database");

  const response = await gotoApp(page, `/debts/${debtId}`);
  expect(response?.status()).toBe(200);
  await expect(
    page.getByText("Principal", { exact: true }).first(),
  ).toBeVisible({
    timeout: 20_000,
  });
});
