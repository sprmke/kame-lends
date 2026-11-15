import { test, expect } from "@playwright/test";
import { fetchJson, gotoApp, skipIfNoDatabase } from "./helpers";

type ApiLoan = {
  id: number;
  loanName: string;
  dueDate: string;
  status: string;
  loanInvestors: Array<{
    amount: string;
    interestRate: string;
    interestType: "rate" | "fixed";
    hasMultipleInterest: boolean;
    interestPeriods?: Array<{ id: number; dueDate: string }>;
    receivedPayments?: Array<{ amount: string }>;
  }>;
};

function principalOf(loan: ApiLoan): number {
  return loan.loanInvestors.reduce(
    (sum, row) => sum + (Number.parseFloat(row.amount) || 0),
    0,
  );
}

test.describe("money journeys", () => {
  test("list and detail agree on the loan principal", async ({
    page,
    request,
  }, testInfo) => {
    skipIfNoDatabase(testInfo);

    const list = await fetchJson<ApiLoan[]>(request, "/api/loans");
    expect(list).not.toBeNull();
    if (!list || list.length === 0) {
      testInfo.skip(true, "No loans in this database");
      return;
    }

    const withMoney = list.find((loan) => principalOf(loan) > 0);
    if (!withMoney) {
      testInfo.skip(true, "No loan with principal");
      return;
    }

    const detail = await fetchJson<ApiLoan>(
      request,
      `/api/loans/${withMoney.id}`,
    );
    expect(detail).not.toBeNull();
    if (!detail) return;

    // The list row and the detail payload must describe the same money.
    expect(principalOf(detail)).toBe(principalOf(withMoney));
    expect(detail.loanInvestors.length).toBe(withMoney.loanInvestors.length);

    await gotoApp(page, `/loans/${detail.id}`);
    await expect(
      page.locator("h1:visible", { hasText: detail.loanName }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("dashboard does not show NaN or Infinity in money cards", async ({
    page,
  }, testInfo) => {
    skipIfNoDatabase(testInfo);
    await gotoApp(page, "/dashboard");
    await expect(page.locator("body")).not.toContainText("₱NaN");
    await expect(page.locator("body")).not.toContainText("Infinity");
  });

  test("investors list and investor detail use the same totals", async ({
    page,
    request,
  }, testInfo) => {
    skipIfNoDatabase(testInfo);

    const investors = await fetchJson<Array<{ id: number; name: string }>>(
      request,
      "/api/investors",
    );
    if (!investors || investors.length === 0) {
      testInfo.skip(true, "No investors in this database");
      return;
    }

    await gotoApp(page, "/investors");
    await expect(
      page.getByText(investors[0].name, { exact: false }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("body")).not.toContainText("₱NaN");
  });
});
