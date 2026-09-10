import { describe, expect, it } from "vitest";
import {
  calculateInterest,
  calculateBorrowerStats,
  calculateInvestorStats,
  calculateTotalPrincipal,
  isOpenLoan,
} from "$lib/calculations";
import type { BorrowerWithLoans, InvestorWithLoans } from "$lib/types";

describe("calculations", () => {
  it("calculates simple interest", () => {
    const interest = calculateInterest(10000, 5, "rate");
    expect(interest).toBe(500);
  });

  it("sums loan principal from investors", () => {
    const total = calculateTotalPrincipal([
      { amount: "10000" },
      { amount: "5000" },
    ]);
    expect(total).toBe(15000);
  });

  it("treats completed loans as closed", () => {
    expect(isOpenLoan({ status: "Fully Funded" })).toBe(true);
    expect(isOpenLoan({ status: "Overdue" })).toBe(true);
    expect(isOpenLoan({ status: "Completed" })).toBe(false);
  });

  it("excludes completed loans from investor capital and interest", () => {
    const stats = calculateInvestorStats({
      loanInvestors: [
        {
          amount: "100000",
          interestRate: "10",
          interestType: "rate",
          hasMultipleInterest: false,
          investorId: 1,
          investor: { id: 1 },
          loan: { status: "Fully Funded" },
        },
        {
          amount: "250000",
          interestRate: "10",
          interestType: "rate",
          hasMultipleInterest: false,
          investorId: 1,
          investor: { id: 1 },
          loan: { status: "Completed" },
        },
      ],
      transactions: [],
    } as InvestorWithLoans);

    expect(stats.totalCapital).toBe(100000);
    expect(stats.totalInterest).toBe(10000);
    expect(stats.totalGain).toBe(110000);
    expect(stats.completedLoans).toBe(1);
    expect(stats.totalLoans).toBe(2);
  });

  it("aggregates borrower loan stats from linked loans", () => {
    const stats = calculateBorrowerStats({
      id: 1,
      name: "Precious Natividad",
      contactNumber: null,
      email: null,
      address: null,
      notes: null,
      validIdUrl: null,
      eSignatureUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      loans: [
        {
          id: 1,
          loanName: "Toyota Hilux",
          type: "OR/CR",
          status: "Fully Funded",
          dueDate: new Date(),
          loanInvestors: [
            {
              amount: "100000",
              interestRate: "10",
              interestType: "rate",
              investorId: 1,
            },
          ],
        },
        {
          id: 2,
          loanName: "Toyota Fortuner",
          type: "OR/CR",
          status: "Overdue",
          dueDate: new Date(),
          loanInvestors: [
            {
              amount: "50000",
              interestRate: "10",
              interestType: "rate",
              investorId: 1,
            },
          ],
        },
        {
          id: 3,
          loanName: "Closed loan",
          type: "OR/CR",
          status: "Completed",
          dueDate: new Date(),
          loanInvestors: [
            {
              amount: "250000",
              interestRate: "10",
              interestType: "rate",
              investorId: 1,
            },
          ],
        },
      ],
    } as BorrowerWithLoans);

    expect(stats.totalLoans).toBe(3);
    expect(stats.openLoans).toBe(2);
    expect(stats.overdueLoans).toBe(1);
    expect(stats.completedLoans).toBe(1);
    expect(stats.activePrincipal).toBe(150000);
    expect(stats.activeInterest).toBe(15000);
    expect(stats.activeTotal).toBe(165000);
    expect(stats.overdueAmount).toBe(55000);
  });
});
