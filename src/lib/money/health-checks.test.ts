import { describe, expect, it } from "vitest";
import { HEALTH_CHECKS } from "./health-checks";

describe("money health definitions", () => {
  it("has unique ids and SQL for every check", () => {
    const ids = HEALTH_CHECKS.map((check) => check.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of HEALTH_CHECKS) {
      expect(check.title.trim().length).toBeGreaterThan(0);
      expect(check.sql.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not keep the status checks that disagreed with the ledger", () => {
    const ids = HEALTH_CHECKS.map((check) => check.id);
    expect(ids).not.toContain("completed-underpaid");
    expect(ids).not.toContain("pending-overpaid");
    expect(ids).not.toContain("completed-underpaid-loans");
    expect(ids).not.toContain("overdue-without-overdue-periods");
  });

  it("keeps the real anomaly checks", () => {
    const ids = HEALTH_CHECKS.map((check) => check.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "unlinked-payments",
        "receiptless-created-payments",
        "missing-interest-periods",
        "zero-capital-fixed",
        "duplicate-period-dates",
        "periods-on-removed-allocations",
        "payments-on-removed-allocations",
        "completed-with-balance",
        "debts-orphan-periods",
      ]),
    );
  });
});
