import { describe, expect, it } from "vitest";
import { buildTelegramLoanContext } from "./telegram-message-context";
import type { Investor, LoanWithInvestors } from "$lib/types";

const investor = (id: number, name: string): Investor => ({
  id,
  name,
  email: `${name}@example.com`,
  contactNumber: null,
  address: null,
  validIdUrl: null,
  eSignatureUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

function loan(overrides: Partial<LoanWithInvestors> = {}): LoanWithInvestors {
  return {
    id: 10,
    borrowerId: 1,
    loanName: "Lot A",
    type: "OR/CR",
    status: "Fully Funded",
    dueDate: new Date("2026-10-16T00:00:00.000Z"),
    freeLotSqm: null,
    notes: "Call <me>",
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    borrower: {
      id: 1,
      name: "Maria <Cruz>",
      contactNumber: "0917",
      email: "maria@example.com",
      address: "Hidden street",
      notes: null,
      validIdUrl: null,
      eSignatureUrl: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    loanInvestors: [
      {
        id: 1,
        loanId: 10,
        investorId: 1,
        amount: "50000",
        interestRate: "5",
        interestType: "rate",
        sentDate: new Date("2026-09-01T00:00:00.000Z"),
        isPaid: true,
        hasMultipleInterest: false,
        profitType: "rate",
        profitValue: "0",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        investor: investor(1, "Juan Reyes"),
      },
      {
        id: 2,
        loanId: 10,
        investorId: 2,
        amount: "1000",
        interestRate: "1000",
        interestType: "fixed",
        sentDate: new Date("2026-09-01T00:00:00.000Z"),
        isPaid: true,
        hasMultipleInterest: false,
        profitType: "rate",
        profitValue: "0",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        investor: investor(2, "Ana Lim"),
      },
    ],
    ...overrides,
  };
}

const base = {
  appUrl: "https://app.example",
  groupId: 3,
  groupName: "Agents",
  includeAmounts: true,
};

describe("buildTelegramLoanContext", () => {
  it("lists borrower, investors, and a percent rate", () => {
    const vars = buildTelegramLoanContext(loan(), base);
    expect(vars.borrower).toBe("Maria &lt;Cruz&gt;");
    expect(vars.investors).toContain("Juan Reyes: ₱50,000");
    expect(vars.investors).toContain("Ana Lim: ₱1,000");
    expect(vars.rates).toContain("Juan Reyes: 5%");
    expect(vars.notes).toBe("Call &lt;me&gt;");
    expect(vars.loan_link).toContain('href="https://app.example/loans/10"');
    expect(vars.borrower).not.toContain("0917");
  });

  it("uses No borrower when the loan has none", () => {
    const vars = buildTelegramLoanContext(
      loan({ borrower: null, borrowerId: null }),
      base,
    );
    expect(vars.borrower).toBe("No borrower");
  });

  it("sets lot size only for lot title loans", () => {
    expect(buildTelegramLoanContext(loan(), base).lot_size).toBe("");
    expect(
      buildTelegramLoanContext(
        loan({ type: "Lot Title", freeLotSqm: 120 }),
        base,
      ).lot_size,
    ).toBe("120 sqm");
  });

  it("hides peso amounts and fixed rates when amounts are off", () => {
    const vars = buildTelegramLoanContext(loan(), {
      ...base,
      includeAmounts: false,
    });
    expect(vars.principal).toBe("Hidden");
    expect(vars.investors).toContain("Juan Reyes");
    expect(vars.investors).not.toContain("₱");
    expect(vars.rates).toContain("Juan Reyes: 5%");
    expect(vars.rates).toContain("Ana Lim: Hidden");
  });

  it("builds a disbursement detail line", () => {
    const vars = buildTelegramLoanContext(loan(), {
      ...base,
      activityType: "disbursement",
      detail: {
        amount: 50000,
        date: "2026-10-01",
        investorName: "Ana Lim",
      },
    });
    expect(vars.action_detail).toBe("₱50,000 from Ana Lim on Oct 1, 2026");
  });
});
