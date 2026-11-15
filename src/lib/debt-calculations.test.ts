import { describe, expect, it } from "vitest";
import {
  calculateAmortizedPayment,
  calculateDebtSummary,
  calculatePerPeriodInterest,
  generateInterestSchedule,
  isDebtTermEnded,
  isFullyPaidDebt,
  normalizeInterestRate,
} from "$lib/debt-calculations";

describe("debt-calculations", () => {
  it("normalizes interest rates without trailing zeros", () => {
    expect(normalizeInterestRate("5.500000")).toBe("5.5");
    expect(normalizeInterestRate(-1)).toBe("0");
  });

  it("calculates per-period interest from principal and rate", () => {
    expect(calculatePerPeriodInterest("10000", "5")).toBe(500);
  });

  it("calculates zero-interest amortized payment as equal principal slices", () => {
    expect(calculateAmortizedPayment("12000", "0", 12)).toBe(1000);
  });

  it("builds debt summary totals for monthly bank loan", () => {
    const summary = calculateDebtSummary({
      principal: "100000",
      interestRate: "2",
      interestInterval: "Monthly",
      debtDate: "2026-01-01",
      durationMonths: 12,
      additionalFees: [{ label: "Fee", amount: "1000" }],
    });

    expect(summary.schedule.length).toBeGreaterThan(0);
    expect(summary.totalInterestIncludingFees).toBeGreaterThan(0);
    expect(summary.totalRepayment).toBeGreaterThan(100000);
  });
});

describe("debt dates (DEBT-01/02/03)", () => {
  it("starts the first installment one interval after the debt date", () => {
    const schedule = generateInterestSchedule(
      "2026-01-15",
      100000,
      3,
      "Monthly",
      3,
    );
    expect(
      schedule.map((entry) => entry.date.toISOString().slice(0, 10)),
    ).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("clamps month-end dates instead of overflowing", () => {
    const schedule = generateInterestSchedule(
      "2026-01-31",
      100000,
      3,
      "Monthly",
      3,
    );
    expect(
      schedule.map((entry) => entry.date.toISOString().slice(0, 10)),
    ).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("separates term ended from paid", () => {
    const debt = { date: "2025-01-01", durationMonths: 1, amount: "100000" };
    expect(isDebtTermEnded(debt, new Date("2026-01-01"))).toBe(true);
    // No recorded payments, so the term ending does not make it paid.
    expect(
      isFullyPaidDebt({
        ...debt,
        interestRate: "3",
        interestInterval: "Monthly",
        interestPeriods: [],
      }),
    ).toBe(false);
  });
});
