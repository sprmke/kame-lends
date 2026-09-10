import { describe, expect, it } from "vitest";
import {
  calculateAmortizedPayment,
  calculateDebtSummary,
  calculatePerPeriodInterest,
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

  it("builds debt summary totals for monthly borrowing", () => {
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
