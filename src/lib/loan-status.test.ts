import { describe, expect, it } from "vitest";
import {
  deriveLoanStatusFromPeriods,
  interestPeriodStatusFlags,
} from "./loan-status";

describe("interestPeriodStatusFlags", () => {
  it("ignores periods when multiple interest is off", () => {
    expect(
      interestPeriodStatusFlags([
        {
          hasMultipleInterest: false,
          interestPeriods: [{ status: "Overdue" }],
        },
      ]),
    ).toEqual({
      hasOverduePeriod: false,
      hasIncompletePeriod: false,
      hasAnyPendingPeriod: false,
      allPeriodsCompleted: false,
    });
  });

  it("reads statuses from multiple-interest periods", () => {
    expect(
      interestPeriodStatusFlags([
        {
          hasMultipleInterest: true,
          interestPeriods: [{ status: "Completed" }, { status: "Overdue" }],
        },
      ]),
    ).toEqual({
      hasOverduePeriod: true,
      hasIncompletePeriod: false,
      hasAnyPendingPeriod: false,
      allPeriodsCompleted: false,
    });
  });
});

describe("deriveLoanStatusFromPeriods", () => {
  it("marks a fully paid loan Completed even when a period is overdue", () => {
    expect(
      deriveLoanStatusFromPeriods({
        currentStatus: "Overdue",
        fullyReceived: true,
        hasOverduePeriod: true,
        hasIncompletePeriod: false,
        allPeriodsCompleted: false,
        allDisbursementsPaid: true,
      }),
    ).toBe("Completed");
  });

  it("keeps Overdue when the balance is still open", () => {
    expect(
      deriveLoanStatusFromPeriods({
        currentStatus: "Overdue",
        fullyReceived: false,
        hasOverduePeriod: true,
        hasIncompletePeriod: false,
        allPeriodsCompleted: false,
        allDisbursementsPaid: true,
      }),
    ).toBe("Overdue");
  });

  it("completes when every period is paid and disbursements are sent", () => {
    expect(
      deriveLoanStatusFromPeriods({
        currentStatus: "Fully Funded",
        fullyReceived: false,
        hasOverduePeriod: false,
        hasIncompletePeriod: false,
        allPeriodsCompleted: true,
        allDisbursementsPaid: true,
      }),
    ).toBe("Completed");
  });

  it("reverts Overdue to Fully Funded when periods are clear but unpaid", () => {
    expect(
      deriveLoanStatusFromPeriods({
        currentStatus: "Overdue",
        fullyReceived: false,
        hasOverduePeriod: false,
        hasIncompletePeriod: false,
        allPeriodsCompleted: false,
        allDisbursementsPaid: true,
      }),
    ).toBe("Fully Funded");
  });
});
