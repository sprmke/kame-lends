import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { Investor, LoanWithInvestors } from "$lib/types";
import LoansTable from "./LoansTable.svelte";

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
  name: "Other Lender",
  email: "other@example.com",
};

function allocation(investor: Investor, amount: string, interestRate: string) {
  return {
    id: investor.id * 10,
    loanId: 1,
    investorId: investor.id,
    amount,
    interestRate,
    interestType: "rate" as const,
    sentDate: new Date("2026-10-01T00:00:00.000Z"),
    isPaid: true,
    hasMultipleInterest: false,
    profitType: "rate" as const,
    profitValue: "0",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    investor,
  };
}

function loan(): LoanWithInvestors {
  return {
    id: 1,
    borrowerId: null,
    loanName: "Sample Loan",
    type: "OR/CR",
    status: "Fully Funded",
    dueDate: new Date("2026-10-30T00:00:00.000Z"),
    freeLotSqm: null,
    notes: null,
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    loanInvestors: [
      allocation(investorA, "100000", "10"),
      allocation(investorB, "50000", "20"),
    ],
  };
}

describe("loan list total amount", () => {
  it("shows principal plus interest in the table, scoped to one investor", () => {
    const full = render(LoansTable, { props: { loans: [loan()] } });
    expect(full.body).toContain("Total Amount");
    expect(full.body).not.toContain(">Principal<");
    expect(full.body).toContain("₱170,000.00");
    expect(full.body).not.toContain("₱150,000.00");

    const scoped = render(LoansTable, {
      props: { loans: [loan()], investorId: investorA.id },
    });
    expect(scoped.body).toContain("₱110,000.00");
    expect(scoped.body).toContain("10.00%");
    expect(scoped.body).not.toContain("₱170,000.00");
  });
});
