import { describe, expect, it } from "vitest";
import { buildAllocationsFromExistingLoan } from "$lib/components/loans/loan-form-allocations";
import type { LoanWithInvestors } from "$lib/types";

function minimalLoan(
  overrides: Partial<LoanWithInvestors> = {},
): LoanWithInvestors {
  return {
    id: 1,
    userId: "u1",
    borrowerId: 1,
    loanName: "Test",
    type: "Lot Title",
    status: "Active",
    dueDate: new Date("2026-12-01"),
    freeLotSqm: null,
    notes: null,
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date(),
    updatedAt: new Date(),
    borrower: {
      id: 1,
      name: "Borrower",
      email: null,
      contactNumber: null,
      address: null,
      validIdUrl: null,
      eSignatureUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    loanInvestors: [],
    loanWitnesses: [],
    signingInvitations: [],
    groupLoans: [],
    ...overrides,
  } as LoanWithInvestors;
}

describe("buildAllocationsFromExistingLoan", () => {
  it("assigns unique interest period keys when list payload omits period ids", () => {
    const loan = minimalLoan({
      loanInvestors: [
        {
          id: 10,
          loanId: 1,
          investorId: 1,
          amount: "100000",
          interestRate: "10",
          interestType: "rate",
          sentDate: new Date("2026-01-01"),
          isPaid: true,
          hasMultipleInterest: true,
          profitType: "rate",
          profitValue: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
          investor: {
            id: 1,
            name: "Investor",
            email: null,
            contactNumber: null,
            address: null,
            validIdUrl: null,
            eSignatureUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          interestPeriods: [
            {
              dueDate: new Date("2026-06-01"),
              interestRate: "10",
              interestType: "rate",
            },
            {
              dueDate: new Date("2026-12-01"),
              interestRate: "10",
              interestType: "rate",
            },
          ],
          receivedPayments: [],
        },
      ],
    });

    const allocations = buildAllocationsFromExistingLoan(loan);
    const periodIds = allocations[0]?.interestPeriods.map((p) => p.id) ?? [];
    expect(periodIds).toEqual(["period-li-10-0", "period-li-10-1"]);
    expect(new Set(periodIds).size).toBe(periodIds.length);
  });

  it("dedupes received payments by database id across disbursements", () => {
    const loan = minimalLoan({
      loanInvestors: [
        {
          id: 10,
          loanId: 1,
          investorId: 1,
          amount: "50000",
          interestRate: "10",
          interestType: "rate",
          sentDate: new Date("2026-01-01"),
          isPaid: true,
          hasMultipleInterest: false,
          profitType: "rate",
          profitValue: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
          investor: {
            id: 1,
            name: "Investor",
            email: null,
            contactNumber: null,
            address: null,
            validIdUrl: null,
            eSignatureUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          interestPeriods: [],
          receivedPayments: [
            {
              id: 99,
              loanInvestorId: 10,
              amount: "1000",
              receivedDate: new Date("2026-02-01"),
              interestPeriodId: null,
              receiptImageUrl: null,
              receiptExtractedData: null,
              receipts: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        {
          id: 11,
          loanId: 1,
          investorId: 1,
          amount: "50000",
          interestRate: "10",
          interestType: "rate",
          sentDate: new Date("2026-03-01"),
          isPaid: true,
          hasMultipleInterest: false,
          profitType: "rate",
          profitValue: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
          investor: {
            id: 1,
            name: "Investor",
            email: null,
            contactNumber: null,
            address: null,
            validIdUrl: null,
            eSignatureUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          interestPeriods: [],
          receivedPayments: [
            {
              id: 99,
              loanInvestorId: 11,
              amount: "1000",
              receivedDate: new Date("2026-02-01"),
              interestPeriodId: null,
              receiptImageUrl: null,
              receiptExtractedData: null,
              receipts: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ],
    });

    const allocations = buildAllocationsFromExistingLoan(loan);
    expect(allocations[0]?.receivedPayments).toHaveLength(1);
    expect(allocations[0]?.receivedPayments[0]?.id).toBe("99");
  });
});
