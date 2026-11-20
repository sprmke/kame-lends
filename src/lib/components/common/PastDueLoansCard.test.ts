import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { LoanWithInvestors } from "$lib/types";
import PastDueLoansCard from "./PastDueLoansCard.svelte";

function overdueLoan(): LoanWithInvestors {
  return {
    id: 1,
    borrowerId: null,
    loanName: "Overdue principal loan",
    type: "Agent",
    status: "Overdue",
    dueDate: new Date("2020-01-01T00:00:00.000Z"),
    freeLotSqm: null,
    notes: null,
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2019-12-01T00:00:00.000Z"),
    updatedAt: new Date("2019-12-01T00:00:00.000Z"),
    loanInvestors: [
      {
        id: 10,
        loanId: 1,
        investorId: 2,
        amount: "480000",
        interestRate: "0",
        interestType: "rate",
        sentDate: new Date("2019-12-01T00:00:00.000Z"),
        isPaid: true,
        hasMultipleInterest: false,
        profitType: "rate",
        profitValue: "0",
        createdAt: new Date("2019-12-01T00:00:00.000Z"),
        updatedAt: new Date("2019-12-01T00:00:00.000Z"),
        investor: {
          id: 2,
          name: "Arianna Perez",
          email: "arianna@example.com",
          contactNumber: null,
          address: null,
          validIdUrl: null,
          eSignatureUrl: null,
          createdAt: new Date("2019-12-01T00:00:00.000Z"),
          updatedAt: new Date("2019-12-01T00:00:00.000Z"),
        },
        interestPeriods: [],
        receivedPayments: [],
      },
    ],
  };
}

describe("PastDueLoansCard", () => {
  it("includes overdue principal when the loan has no interest periods", () => {
    const { body } = render(PastDueLoansCard, {
      props: { loans: [overdueLoan()] },
    });
    expect(body).toContain("₱480,000.00");
    expect(body).not.toContain("₱0.00");
  });
});
