import { describe, expect, it } from "vitest";
import {
  calendarEventKey,
  draftLoanGoogleEvents,
  googleAllDayRange,
  isSummaryEventTitle,
  loanGoogleEventTitle,
  nextDateKey,
  totalSummaryTitle,
} from "./calendar-events";
import type { Investor, LoanWithInvestors } from "./types";

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
const investorC: Investor = { ...investorA, id: 3, name: "Cam" };

function allocation(
  loanId: number,
  investor: Investor,
  amount: string,
  sentDate: string,
) {
  return {
    id: investor.id * 10,
    loanId,
    investorId: investor.id,
    amount,
    interestRate: "10",
    interestType: "rate" as const,
    sentDate: new Date(`${sentDate}T00:00:00.000Z`),
    isPaid: true,
    hasMultipleInterest: false,
    profitType: "rate" as const,
    profitValue: "0",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    investor,
  };
}

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
    loanInvestors: [allocation(10, investorA, "100000", "2026-09-01")],
    ...overrides,
  };
}

describe("googleAllDayRange", () => {
  it("uses an exclusive next-day end so the event stays on the start date", () => {
    expect(googleAllDayRange("2026-09-14")).toEqual({
      start: { date: "2026-09-14" },
      end: { date: "2026-09-15" },
    });
  });

  it("crosses month and year boundaries without local timezone math", () => {
    expect(nextDateKey("2026-09-30")).toBe("2026-10-01");
    expect(nextDateKey("2026-12-31")).toBe("2027-01-01");
  });

  it("does not shift the calendar day when the host timezone is ahead of UTC", () => {
    const dateKey = "2026-09-07";
    const localMidnight = new Date(`${dateKey}T00:00:00`);
    const utcDay = localMidnight.getUTCDate();
    const localDay = Number(dateKey.slice(-2));
    if (utcDay !== localDay) {
      expect(googleAllDayRange(dateKey).start.date).toBe(dateKey);
      expect(googleAllDayRange(dateKey).start.date).not.toBe(
        `${localMidnight.getUTCFullYear()}-${String(localMidnight.getUTCMonth() + 1).padStart(2, "0")}-${String(utcDay).padStart(2, "0")}`,
      );
    } else {
      expect(googleAllDayRange(dateKey).start.date).toBe(dateKey);
    }
  });
});

describe("totalSummaryTitle", () => {
  it("uses Total Summary and keeps Daily Summary as a legacy match", () => {
    expect(totalSummaryTitle(946000)).toBe("Total Summary +₱946,000");
    expect(totalSummaryTitle(-79000)).toBe("Total Summary -₱79,000");
    expect(isSummaryEventTitle("Total Summary +₱946,000")).toBe(true);
    expect(isSummaryEventTitle("Daily Summary +₱946,000")).toBe(true);
    expect(isSummaryEventTitle("Agent: Agent Loan - Due Date")).toBe(false);
  });
});

describe("draftLoanGoogleEvents", () => {
  it("creates one sent event and one due event for a multi-investor loan", () => {
    const multi = loan({
      loanInvestors: [
        allocation(10, investorA, "60000", "2026-09-01"),
        allocation(10, investorB, "40000", "2026-09-01"),
        allocation(10, investorC, "20000", "2026-09-01"),
      ],
    });
    const drafts = draftLoanGoogleEvents(multi, "all", "2026-09-14");
    expect(drafts.map((draft) => draft.type)).toEqual(["sent", "due"]);
    expect(drafts[0]?.dateKey).toBe("2026-09-01");
    expect(drafts[1]?.dateKey).toBe("2026-09-14");
    expect(drafts[1]?.investors).toHaveLength(3);
    expect(drafts[1]?.totalAmount).toBe(132000);
    expect(
      loanGoogleEventTitle(
        "due",
        multi.loanName,
        multi.type,
        drafts[1]!.totalAmount,
      ),
    ).toBe("Agent: Agent Loan (Sept 1-14) - Due Date (+₱132,000)");
    expect(drafts[0]?.key).toBe(calendarEventKey("sent", "2026-09-01", 10));
    expect(drafts[1]?.key).toBe(calendarEventKey("due", "2026-09-14", 10));
  });

  it("does not invent a summary date that is missing loan events", () => {
    const drafts = draftLoanGoogleEvents(loan(), "all", "2026-09-14");
    expect(drafts.map((draft) => draft.dateKey).sort()).toEqual([
      "2026-09-01",
      "2026-09-14",
    ]);
    expect(drafts.some((draft) => draft.dateKey === "2026-09-13")).toBe(false);
  });
});
