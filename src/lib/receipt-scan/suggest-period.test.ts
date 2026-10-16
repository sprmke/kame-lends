import { describe, expect, it } from "vitest";
import { suggestInterestPeriodId } from "./suggest-period";

const periods = [
  {
    id: 3,
    dueDate: "2026-12-01",
    interestRate: "5",
    interestType: "rate",
    status: "Pending",
  },
  {
    id: 2,
    dueDate: "2026-11-01",
    interestRate: "5",
    interestType: "rate",
    status: "Pending",
  },
  {
    id: 1,
    dueDate: "2026-10-01",
    interestRate: "5",
    interestType: "rate",
    status: "Completed",
  },
  {
    id: 4,
    dueDate: "2027-01-01",
    interestRate: "1234.5",
    interestType: "fixed",
    status: "Incomplete",
  },
];

describe("suggestInterestPeriodId", () => {
  it("picks the earliest unpaid period whose interest equals the amount", () => {
    expect(suggestInterestPeriodId(5000, periods, 100_000)).toBe("2");
    expect(suggestInterestPeriodId(5000.01, periods, 100_000)).toBe("2");
    expect(suggestInterestPeriodId(1234.5, periods, 100_000)).toBe("4");
  });

  it("falls back to the general balance", () => {
    expect(suggestInterestPeriodId(4000, periods, 100_000)).toBe("general");
    expect(suggestInterestPeriodId(null, periods, 100_000)).toBe("general");
    expect(suggestInterestPeriodId(5000, [], 100_000)).toBe("general");
  });
});
