import { describe, expect, it } from "vitest";
import {
  collectDailySummaryDays,
  getAffectedDatesFromLoan,
} from "./calendar-summaries";
import type {
  InterestPeriod,
  InterestPeriodStatus,
  Investor,
  LoanWithInvestors,
} from "./types";

const investorA: Investor = {
  id: 1,
  name: "Ada",
  email: "ada@example.com",
  contactNumber: null,
  address: null,
  validIdUrl: null,
  eSignatureUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const investorB: Investor = { ...investorA, id: 2, name: "Bob" };

function interestPeriod(
  id: number,
  loanInvestorId: number,
  dueDate: string,
  status: InterestPeriodStatus,
): InterestPeriod {
  return {
    id,
    loanInvestorId,
    dueDate: new Date(`${dueDate}T00:00:00.000Z`),
    interestRate: "10",
    interestType: "rate",
    status,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };
}

function allocation(
  id: number,
  investor: Investor,
  amount: string,
  interestPeriods: InterestPeriod[],
) {
  return {
    id,
    loanId: 139,
    investorId: investor.id,
    amount,
    interestRate: "10",
    interestType: "rate" as const,
    sentDate: new Date("2026-09-13T00:00:00.000Z"),
    isPaid: true,
    hasMultipleInterest: true,
    profitType: "rate" as const,
    profitValue: "0",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    interestPeriods,
    investor,
  };
}

function reportedLoan(): LoanWithInvestors {
  const periods = (loanInvestorId: number, startId: number) => [
    interestPeriod(startId, loanInvestorId, "2026-09-27", "Overdue"),
    interestPeriod(startId + 1, loanInvestorId, "2026-10-11", "Overdue"),
    interestPeriod(startId + 2, loanInvestorId, "2026-10-25", "Overdue"),
    interestPeriod(startId + 3, loanInvestorId, "2026-11-09", "Overdue"),
  ];

  return {
    id: 139,
    borrowerId: null,
    loanName: "Agent Loan (Sep 13 - Nov 9)",
    type: "Agent",
    status: "Overdue",
    dueDate: new Date("2026-11-09T00:00:00.000Z"),
    freeLotSqm: null,
    notes: null,
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-09-13T00:00:00.000Z"),
    updatedAt: new Date("2026-09-13T00:00:00.000Z"),
    loanInvestors: [
      allocation(630, investorA, "350000", periods(630, 1272)),
      allocation(631, investorB, "130000", periods(631, 1276)),
    ],
  };
}

describe("collectDailySummaryDays", () => {
  it("uses the same loan due amount as the grid and the timeline", () => {
    const loan = reportedLoan();
    const days = collectDailySummaryDays([loan]);

    expect(days.get("2026-09-13")?.out.amount).toBe(480000);
    expect(days.get("2026-11-09")?.in.amount).toBe(672000);
    expect(days.get("2026-11-09")?.loanAmounts.get(loan.id)).toEqual({
      amount: 672000,
      isOut: false,
    });
    expect(days.has("2026-09-27")).toBe(false);
  });
});

describe("getAffectedDatesFromLoan", () => {
  it("includes every date that could hold a stale summary", () => {
    const dates = getAffectedDatesFromLoan(reportedLoan()).map((date) =>
      date.toISOString().slice(0, 10),
    );

    expect(dates.sort()).toEqual([
      "2026-09-13",
      "2026-09-27",
      "2026-10-11",
      "2026-10-25",
      "2026-11-09",
    ]);
  });
});
