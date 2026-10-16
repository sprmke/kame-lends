import { describe, expect, it } from "vitest";
import type { Investor, LoanWithInvestors } from "$lib/types";
import { buildLoanTimeline } from "./loan-timeline";

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

function allocation(
  loanId: number,
  investor: Investor,
  amount: string,
  sentDate: string,
  isPaid = true,
) {
  return {
    id: investor.id * 10,
    loanId,
    investorId: investor.id,
    amount,
    interestRate: "10",
    interestType: "rate" as const,
    sentDate: new Date(`${sentDate}T00:00:00.000Z`),
    isPaid,
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
    loanName: "Agent Loan",
    type: "Agent",
    status: "Fully Funded",
    dueDate: new Date(2026, 8, 14),
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

describe("buildLoanTimeline", () => {
  it("groups money out and money in by day inside the selected range", () => {
    const timeline = buildLoanTimeline(
      [
        loan({
          loanInvestors: [
            allocation(10, investorA, "60000", "2026-09-01"),
            allocation(10, investorB, "40000", "2026-09-01"),
          ],
        }),
      ],
      { from: "2026-09-01", to: "2026-09-30", today: new Date(2026, 8, 14) },
    );

    expect(timeline.months.map((month) => month.key)).toEqual(["2026-09"]);
    const days = timeline.months[0]?.days ?? [];
    expect(days.map((day) => day.dateKey)).toEqual([
      "2026-09-01",
      "2026-09-14",
    ]);

    const sent = days[0]?.entries[0];
    expect(sent?.direction).toBe("out");
    expect(sent?.kind).toBe("sent");
    expect(sent?.amount).toBe(100000);
    expect(sent?.detail).toBe("Ada, Bob");

    const due = days[1]?.entries[0];
    expect(due?.direction).toBe("in");
    expect(due?.kind).toBe("due");
    expect(due?.amount).toBe(110000);
    expect(days[1]?.isToday).toBe(true);
    expect(timeline.outTotal).toBe(100000);
    expect(timeline.inTotal).toBe(110000);
    expect(timeline.anchorKey).toBe("2026-09-14");
  });

  it("drops events outside the date range and marks unpaid disbursements as scheduled", () => {
    const timeline = buildLoanTimeline(
      [
        loan({
          loanInvestors: [
            allocation(10, investorA, "20000", "2026-08-20", false),
            allocation(10, investorB, "30000", "2026-09-03", false),
          ],
        }),
      ],
      { from: "2026-09-01", to: "2026-09-30", today: new Date(2026, 7, 1) },
    );

    const days = timeline.months.flatMap((month) => month.days);
    expect(days.map((day) => day.dateKey)).toEqual([
      "2026-09-03",
      "2026-09-14",
    ]);
    expect(days[0]?.entries[0]?.kind).toBe("scheduled");
    expect(days[0]?.entries[0]?.direction).toBe("out");
    expect(days[0]?.entries[0]?.amount).toBe(30000);
    expect(days[1]?.entries[0]?.kind).toBe("due");
    expect(timeline.anchorKey).toBeNull();
  });

  it("inserts today when it falls in the range without activity", () => {
    const timeline = buildLoanTimeline([loan()], {
      from: "2026-09-01",
      to: "2026-09-30",
      today: new Date(2026, 8, 7),
    });

    const days = timeline.months.flatMap((month) => month.days);
    expect(days.map((day) => day.dateKey)).toEqual([
      "2026-09-01",
      "2026-09-07",
      "2026-09-14",
    ]);
    expect(days[1]?.entries).toEqual([]);
    expect(days[1]?.isToday).toBe(true);
    expect(timeline.anchorKey).toBe("2026-09-07");
  });

  it("does not append today after the last event on an open range", () => {
    const timeline = buildLoanTimeline([loan()], {
      today: new Date(2027, 0, 15),
    });

    const days = timeline.months.flatMap((month) => month.days);
    expect(days.map((day) => day.dateKey)).toEqual([
      "2026-09-01",
      "2026-09-14",
    ]);
    expect(timeline.anchorKey).toBeNull();
  });

  it("returns an empty timeline when nothing falls in the range", () => {
    const timeline = buildLoanTimeline([loan()], {
      from: "2026-01-01",
      to: "2026-01-31",
      today: new Date(2026, 0, 15),
    });

    expect(timeline.months).toEqual([]);
    expect(timeline.anchorKey).toBeNull();
  });
});
