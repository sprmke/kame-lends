import { describe, expect, it } from "vitest";
import type { CalendarEventSent } from "$lib/components/common/calendar/types";
import type {
  InterestPeriod,
  InterestPeriodStatus,
  Investor,
  LoanWithInvestors,
} from "$lib/types";
import {
  buildLoanCalendarEvents,
  sentInvestorLinesForCard,
} from "./use-loan-calendar-events";

const investorA: Investor = {
  id: 1,
  name: "Arianna Perez",
  email: "arianna@example.com",
  contactNumber: null,
  address: null,
  validIdUrl: null,
  eSignatureUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const investorB: Investor = {
  ...investorA,
  id: 2,
  name: "Michael Manlulu",
  email: "michael@example.com",
};

function allocation(investor: Investor, amount: string, sentDate: string) {
  return {
    id: investor.id * 10,
    loanId: 119,
    investorId: investor.id,
    amount,
    interestRate: "10",
    interestType: "rate" as const,
    sentDate: new Date(`${sentDate}T00:00:00.000Z`),
    isPaid: true,
    hasMultipleInterest: false,
    profitType: "rate" as const,
    profitValue: "0",
    createdAt: new Date("2026-10-26T16:47:09.000Z"),
    updatedAt: new Date("2026-10-26T16:47:09.000Z"),
    investor,
  };
}

function toyotaVios(): LoanWithInvestors {
  return {
    id: 119,
    borrowerId: null,
    loanName: "Toyota Vios",
    type: "OR/CR",
    status: "Fully Funded",
    dueDate: new Date("2026-10-30T00:00:00.000Z"),
    freeLotSqm: null,
    notes: null,
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-10-26T16:47:09.000Z"),
    updatedAt: new Date("2026-10-26T16:47:09.000Z"),
    loanInvestors: [
      allocation(investorB, "300000", "2026-10-17"),
      allocation(investorA, "50000", "2026-10-16"),
    ],
  };
}

function sentOn(loans: LoanWithInvestors[], day: number): CalendarEventSent {
  const event = buildLoanCalendarEvents(loans).find(
    (item) => item.type === "sent" && item.date.getDate() === day,
  );
  if (!event || event.type !== "sent") {
    throw new Error(`missing sent event on day ${day}`);
  }
  return event;
}

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

function multiPeriodLoan(): LoanWithInvestors {
  const periods = (loanInvestorId: number, startId: number) => [
    interestPeriod(startId, loanInvestorId, "2026-09-27", "Overdue"),
    interestPeriod(startId + 1, loanInvestorId, "2026-10-11", "Overdue"),
    interestPeriod(startId + 2, loanInvestorId, "2026-10-25", "Overdue"),
    interestPeriod(startId + 3, loanInvestorId, "2026-11-09", "Overdue"),
  ];

  return {
    ...toyotaVios(),
    id: 139,
    loanName: "Agent Loan (Sep 13 - Nov 9)",
    status: "Overdue",
    dueDate: new Date("2026-11-09T00:00:00.000Z"),
    loanInvestors: [
      {
        ...allocation(investorB, "350000", "2026-09-13"),
        id: 630,
        hasMultipleInterest: true,
        interestPeriods: periods(630, 1272),
      },
      {
        ...allocation(investorA, "130000", "2026-09-13"),
        id: 631,
        hasMultipleInterest: true,
        interestPeriods: periods(631, 1276),
      },
    ],
  };
}

describe("sentInvestorLinesForCard", () => {
  it("keeps the calendar cell to the lenders who sent that day", () => {
    const event = sentOn([toyotaVios()], 16);
    expect(event.totalAmount).toBe(50000);
    expect(sentInvestorLinesForCard(event, false)).toEqual([
      { name: "Arianna Perez", amount: 50000 },
    ]);
  });

  it("lists every lender in the day modal and dates the other disbursement", () => {
    const event = sentOn([toyotaVios()], 16);
    expect(sentInvestorLinesForCard(event, true)).toEqual([
      { name: "Arianna Perez", amount: 50000, note: undefined },
      { name: "Michael Manlulu", amount: 300000, note: "Oct 17" },
    ]);
    expect(event.totalAmount).toBe(50000);
  });

  it("lists both lenders with no date when they sent on the same day", () => {
    const sameDay = toyotaVios();
    sameDay.loanInvestors = [
      allocation(investorB, "300000", "2026-10-16"),
      allocation(investorA, "50000", "2026-10-16"),
    ];
    const event = sentOn([sameDay], 16);
    expect(sentInvestorLinesForCard(event, true)).toEqual([
      { name: "Michael Manlulu", amount: 300000, note: undefined },
      { name: "Arianna Perez", amount: 50000, note: undefined },
    ]);
    expect(event.totalAmount).toBe(350000);
  });
});

describe("buildLoanCalendarEvents", () => {
  it("merges a multi-period loan's due into one row with the full uncollected interest", () => {
    const events = buildLoanCalendarEvents([multiPeriodLoan()]);
    const dueEvents = events.filter((event) => event.type === "due");

    expect(events.some((event) => event.type === "interest_due")).toBe(false);
    expect(dueEvents).toHaveLength(1);
    expect(dueEvents[0]).toMatchObject({
      totalPrincipal: 480000,
      totalInterest: 192000,
      totalAmount: 672000,
    });
  });

  it("keeps completed or upcoming interest as its own calendar event", () => {
    const loan = multiPeriodLoan();
    loan.loanInvestors[0]!.interestPeriods![0]!.status = "Completed";
    loan.loanInvestors[0]!.interestPeriods![1]!.status = "Pending";

    const events = buildLoanCalendarEvents([loan]);
    const interestEvents = events.filter(
      (event) => event.type === "interest_due",
    );
    const dueEvents = events.filter((event) => event.type === "due");

    expect(interestEvents).toHaveLength(2);
    expect(interestEvents.map((event) => event.totalAmount)).toEqual([
      35000, 35000,
    ]);
    expect(dueEvents).toHaveLength(1);
    expect(dueEvents[0]).toMatchObject({
      totalPrincipal: 480000,
      totalInterest: 122000,
      totalAmount: 602000,
    });
  });
});
