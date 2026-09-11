import { describe, expect, it } from "vitest";
import { buildDefaultContractCustomizationFromLoan } from "./loan-contract-customization";
import { buildLoanContractData } from "./loan-contract-data";
import {
  applySigningSignatures,
  resolvePartySignature,
  type SigningInvitationRecord,
} from "./loan-signing";
import type { LoanWithInvestors } from "./types";

const savedBorrowerSig = "data:image/png;base64,SAVED_BORROWER";
const manualBorrowerSig = "data:image/png;base64,MANUAL_BORROWER";
const savedLenderSig = "data:image/png;base64,SAVED_LENDER";
const manualLenderSig = "data:image/png;base64,MANUAL_LENDER";

function buildFixtureLoan(): LoanWithInvestors {
  return {
    id: 1,
    userId: "owner",
    loanName: "Test loan",
    type: "Agent",
    dueDate: new Date("2026-12-31"),
    freeLotSqm: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    borrowerId: 1,
    borrower: {
      id: 1,
      name: "Borrower",
      email: "borrower@example.com",
      contactNumber: null,
      address: null,
      validIdUrl: null,
      eSignatureUrl: savedBorrowerSig,
      borrowerUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    loanInvestors: [
      {
        id: 1,
        loanId: 1,
        investorId: 1,
        amount: "1000",
        interestRate: "5",
        interestType: "rate",
        sentDate: new Date("2026-01-01"),
        isPaid: false,
        hasMultipleInterest: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        investor: {
          id: 1,
          name: "Lender",
          email: "lender@example.com",
          contactNumber: null,
          address: null,
          validIdUrl: null,
          eSignatureUrl: savedLenderSig,
          investorUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
  };
}

function buildInvitation(
  overrides: Partial<SigningInvitationRecord> &
    Pick<SigningInvitationRecord, "partyRole">,
): SigningInvitationRecord {
  return {
    id: 1,
    token: null,
    partyName: "Party",
    partyEmail: null,
    signatureDataUrl: null,
    signedAt: null,
    consentedAt: null,
    expiresAt: null,
    investorId: null,
    ...overrides,
  };
}

describe("resolvePartySignature", () => {
  it("prefers manual signature over saved profile signature", () => {
    expect(
      resolvePartySignature(manualBorrowerSig, savedBorrowerSig, true),
    ).toBe(manualBorrowerSig);
  });

  it("uses saved profile signature only when admin opted in", () => {
    expect(resolvePartySignature(null, savedBorrowerSig, true)).toBe(
      savedBorrowerSig,
    );
    expect(resolvePartySignature(null, savedBorrowerSig, false)).toBeNull();
  });
});

describe("applySigningSignatures", () => {
  it("does not show saved signatures unless admin opted in", () => {
    const loan = buildFixtureLoan();
    const baseData = buildLoanContractData(loan);
    const customization = buildDefaultContractCustomizationFromLoan(baseData);
    const investorEmailById = new Map([[1, "lender@example.com"]]);

    const merged = applySigningSignatures(
      baseData,
      customization,
      [],
      investorEmailById,
      {
        borrower: savedBorrowerSig,
        lenders: new Map([["lender@example.com", savedLenderSig]]),
      },
    );

    expect(merged.data.borrowerESignatureUrl).toBeNull();
    expect(merged.data.lenders[0]?.eSignatureUrl).toBeNull();
  });

  it("shows manual contract signatures even when saved signatures are disabled", () => {
    const loan = buildFixtureLoan();
    const baseData = buildLoanContractData(loan);
    const customization = buildDefaultContractCustomizationFromLoan(baseData);
    const investorEmailById = new Map([[1, "lender@example.com"]]);
    const invitations = [
      buildInvitation({
        partyRole: "borrower",
        signatureDataUrl: manualBorrowerSig,
      }),
      buildInvitation({
        id: 2,
        partyRole: "lender",
        investorId: 1,
        signatureDataUrl: manualLenderSig,
      }),
    ];

    const merged = applySigningSignatures(
      baseData,
      customization,
      invitations,
      investorEmailById,
      {
        borrower: savedBorrowerSig,
        lenders: new Map([["lender@example.com", savedLenderSig]]),
      },
    );

    expect(merged.data.borrowerESignatureUrl).toBe(manualBorrowerSig);
    expect(merged.data.lenders[0]?.eSignatureUrl).toBe(manualLenderSig);
  });

  it("shows saved signatures when admin opted in and no manual signature exists", () => {
    const loan = buildFixtureLoan();
    const baseData = buildLoanContractData(loan);
    const customization = {
      ...buildDefaultContractCustomizationFromLoan(baseData),
      includeBorrowerSignature: true,
      lenderSignaturesIncluded: { "lender@example.com": true },
    };
    const investorEmailById = new Map([[1, "lender@example.com"]]);

    const merged = applySigningSignatures(
      baseData,
      customization,
      [],
      investorEmailById,
      {
        borrower: savedBorrowerSig,
        lenders: new Map([["lender@example.com", savedLenderSig]]),
      },
    );

    expect(merged.data.borrowerESignatureUrl).toBe(savedBorrowerSig);
    expect(merged.data.lenders[0]?.eSignatureUrl).toBe(savedLenderSig);
  });
});
