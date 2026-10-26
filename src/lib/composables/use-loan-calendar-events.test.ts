import { describe, expect, it } from "vitest";
import type { CalendarEventSent } from "$lib/components/common/calendar/types";
import type { Investor, LoanWithInvestors } from "$lib/types";
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
