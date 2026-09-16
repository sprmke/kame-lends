import { describe, expect, it } from "vitest";
import {
  isDateInSyncScope,
  manilaTodayKey,
  planDailySummaryDateKeys,
  planLoanCalendarEvents,
  planLoansForSync,
} from "./calendar-sync-plan";
import type { Investor, LoanWithInvestors } from "./types";

const investor: Investor = {
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

function loan(overrides: Partial<LoanWithInvestors> = {}): LoanWithInvestors {
  return {
    id: 10,
    borrowerId: null,
    loanName: "Agent Loan (Sept 1-14)",
    type: "Agent",
    status: "Fully Funded",
    dueDate: new Date("2026-09-14T00:00:00.000Z"),
    freeLotSqm: null,
    notes: null,
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    loanInvestors: [
      {
        id: 100,
        loanId: 10,
        investorId: 1,
        amount: "100000",
        interestRate: "10",
        interestType: "rate",
        sentDate: new Date("2026-09-01T00:00:00.000Z"),
        isPaid: true,
        hasMultipleInterest: false,
        profitType: "rate",
        profitValue: "0",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        investor,
      },
    ],
    ...overrides,
  };
}

describe("isDateInSyncScope", () => {
  it("includes every date when scope is all", () => {
    expect(isDateInSyncScope("2020-01-01", "all", "2026-09-14")).toBe(true);
  });

  it("includes every date for open loans", () => {
    expect(isDateInSyncScope("2020-01-01", "open", "2026-09-14")).toBe(true);
  });

  it("includes today and later for upcoming", () => {
    expect(isDateInSyncScope("2026-09-14", "upcoming", "2026-09-14")).toBe(
      true,
    );
    expect(isDateInSyncScope("2026-09-15", "upcoming", "2026-09-14")).toBe(
      true,
    );
    expect(isDateInSyncScope("2026-09-13", "upcoming", "2026-09-14")).toBe(
      false,
    );
  });
});

describe("planLoanCalendarEvents", () => {
  it("plans sent and due events for a single-period loan", () => {
    const events = planLoanCalendarEvents(loan(), "all", "2026-09-14");
    expect(events).toEqual([
      { type: "sent", dateKey: "2026-09-01" },
      { type: "due", dateKey: "2026-09-14" },
    ]);
  });

  it("plans one due event for a loan with several investors", () => {
    const investorB = { ...investor, id: 2, name: "Bob" };
    const investorC = { ...investor, id: 3, name: "Cam" };
    const multi = loan({
      loanInvestors: [
        loan().loanInvestors[0],
        {
          ...loan().loanInvestors[0],
          id: 101,
          investorId: 2,
          investor: investorB,
        },
        {
          ...loan().loanInvestors[0],
          id: 102,
          investorId: 3,
          investor: investorC,
        },
      ],
    });
    expect(planLoanCalendarEvents(multi, "all", "2026-09-14")).toEqual([
      { type: "sent", dateKey: "2026-09-01" },
      { type: "due", dateKey: "2026-09-14" },
    ]);
  });

  it("drops past sent dates in upcoming scope", () => {
    const events = planLoanCalendarEvents(loan(), "upcoming", "2026-09-14");
    expect(events).toEqual([{ type: "due", dateKey: "2026-09-14" }]);
  });

  it("returns nothing when every date is in the past", () => {
    const events = planLoanCalendarEvents(loan(), "upcoming", "2026-09-15");
    expect(events).toEqual([]);
  });

  it("keeps last-period due and skips past interest dates", () => {
    const multi = loan({
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
      loanInvestors: [
        {
          id: 100,
          loanId: 10,
          investorId: 1,
          amount: "100000",
          interestRate: "10",
          interestType: "rate",
          sentDate: new Date("2026-08-01T00:00:00.000Z"),
          isPaid: true,
          hasMultipleInterest: true,
          profitType: "rate",
          profitValue: "0",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          investor,
          interestPeriods: [
            {
              id: 1,
              loanInvestorId: 100,
              dueDate: new Date("2026-09-01T00:00:00.000Z"),
              interestRate: "5",
              interestType: "rate",
              status: "Completed",
              createdAt: new Date("2026-08-01T00:00:00.000Z"),
              updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            },
            {
              id: 2,
              loanInvestorId: 100,
              dueDate: new Date("2026-10-01T00:00:00.000Z"),
              interestRate: "5",
              interestType: "rate",
              status: "Pending",
              createdAt: new Date("2026-08-01T00:00:00.000Z"),
              updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            },
          ],
        },
      ],
    });

    const events = planLoanCalendarEvents(multi, "upcoming", "2026-09-14");
    expect(events).toEqual([{ type: "due", dateKey: "2026-10-01" }]);
  });
});

describe("planLoansForSync", () => {
  it("counts only in-scope events and unique dates", () => {
    const plans = planLoansForSync([loan()], "upcoming", "2026-09-14");
    expect(plans[0]).toMatchObject({
      loanId: 10,
      eventCount: 1,
      dates: ["2026-09-14"],
    });
  });

  it("skips completed loans for open scope and keeps their past dates for all", () => {
    const done = loan({
      id: 12,
      loanName: "Finished",
      status: "Completed",
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
      loanInvestors: [
        {
          ...loan().loanInvestors[0],
          loanId: 12,
          sentDate: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
    });
    const openPlans = planLoansForSync([loan(), done], "open", "2026-09-14");
    expect(openPlans.map((plan) => plan.loanId)).toEqual([10]);
    const allPlans = planLoansForSync([loan(), done], "all", "2026-09-14");
    expect(allPlans.map((plan) => plan.loanId)).toEqual([10, 12]);
  });
});

describe("planDailySummaryDateKeys", () => {
  it("unions in-scope dates across loans", () => {
    const other = loan({
      id: 11,
      loanName: "Second",
      dueDate: new Date("2026-09-20T00:00:00.000Z"),
      loanInvestors: [
        {
          ...loan().loanInvestors[0],
          loanId: 11,
          sentDate: new Date("2026-09-20T00:00:00.000Z"),
        },
      ],
    });
    expect(
      planDailySummaryDateKeys([loan(), other], "upcoming", "2026-09-14"),
    ).toEqual(["2026-09-14", "2026-09-20"]);
  });
});

describe("manilaTodayKey", () => {
  it("returns YYYY-MM-DD", () => {
    expect(manilaTodayKey(new Date("2026-09-14T16:00:00.000Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
