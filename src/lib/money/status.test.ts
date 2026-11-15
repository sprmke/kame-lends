import { describe, expect, it } from "vitest";
import { deriveLoanStatus } from "./status";

describe("deriveLoanStatus", () => {
  it("marks a loan Completed only when the balance is covered", () => {
    expect(
      deriveLoanStatus({
        balanceC: 0,
        overdueC: 500_000,
        hasUnpaidDisbursement: false,
      }),
    ).toBe("Completed");
  });

  it("puts overdue before funded", () => {
    expect(
      deriveLoanStatus({
        balanceC: 100,
        overdueC: 1,
        hasUnpaidDisbursement: true,
      }),
    ).toBe("Overdue");
  });

  it("reports partially funded when a disbursement is unpaid", () => {
    expect(
      deriveLoanStatus({
        balanceC: 100,
        overdueC: 0,
        hasUnpaidDisbursement: true,
      }),
    ).toBe("Partially Funded");
  });

  it("defaults to fully funded", () => {
    expect(
      deriveLoanStatus({
        balanceC: 100,
        overdueC: 0,
        hasUnpaidDisbursement: false,
      }),
    ).toBe("Fully Funded");
  });

  it("lets a manual Completed override win", () => {
    expect(
      deriveLoanStatus({
        balanceC: 100,
        overdueC: 100,
        hasUnpaidDisbursement: false,
        override: "Completed",
      }),
    ).toBe("Completed");
  });
});
