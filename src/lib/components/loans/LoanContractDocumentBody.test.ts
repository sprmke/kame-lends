import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import LoanContractDocumentBody from "./LoanContractDocumentBody.svelte";
import type { LoanContractData } from "$lib/loan-contract-data";

const data: LoanContractData = {
  contractNumber: "PT-1-2026",
  agreementDate: "2026-11-21",
  borrowerName: "Borrower",
  borrowerAddress: null,
  borrowerContact: null,
  borrowerEmail: "borrower@example.com",
  borrowerValidIdUrl: null,
  borrowerESignatureUrl: null,
  loanTitleLabel: "Test Loan",
  loanType: "Agent",
  contractTitle: "Loan Agreement",
  collateralDescription: "None",
  freeLotSqm: null,
  dateBorrowed: "2026-11-21",
  dueDate: "2027-01-31",
  principalAmount: 10000,
  totalInterest: 1000,
  totalAmountDue: 11000,
  lenders: [
    {
      name: "Lender",
      contactNumber: null,
      email: "lender@example.com",
      address: null,
      validIdUrl: null,
      eSignatureUrl: null,
      principalAmount: 10000,
      interestDescription: "10%",
    },
  ],
  notes: null,
};

describe("LoanContractDocumentBody", () => {
  it("renders the same contract sections used by the PDF", () => {
    const { body } = render(LoanContractDocumentBody, { props: { data } });
    expect(body).toContain("Parties");
    expect(body).toContain("Lender Allocation");
    expect(body).toContain("Terms and Conditions");
    expect(body).toContain("Signature");
  });
});
