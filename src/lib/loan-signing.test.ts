import { describe, expect, it } from "vitest";
import { buildDefaultContractCustomizationFromLoan } from "./loan-contract-customization";
import { buildLoanContractData } from "./loan-contract-data";
import {
  applySigningSignatures,
  isSavedSignatureIncludedForParty,
  isSigningInvitationPending,
  loanHasPendingSigning,
  loanSigningDisplayStatus,
  loanSigningProgressFromInvitations,
  resolvePartySignature,
  resolveSignerProfileSignatureFromLoan,
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
    status: "Fully Funded",
    dueDate: new Date("2026-12-31"),
    freeLotSqm: null,
    notes: null,
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    borrowerId: 1,
    borrower: {
      id: 1,
      name: "Borrower",
      email: "borrower@example.com",
      contactNumber: null,
      address: null,
      notes: null,
      validIdUrl: null,
      eSignatureUrl: savedBorrowerSig,
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

describe("buildDefaultContractCustomizationFromLoan", () => {
  it("does not include witnesses until the owner opts in", () => {
    const loan = buildFixtureLoan();
    const customization = buildDefaultContractCustomizationFromLoan(
      buildLoanContractData(loan),
    );

    expect(customization.includeWitnesses).toBe(false);
    expect(customization.witness1Name).toBe("");
    expect(customization.witness1Id).toBeNull();
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

describe("resolveSignerProfileSignatureFromLoan", () => {
  it("returns profile signatures for borrower and lender slots", () => {
    const loan = buildFixtureLoan();
    loan.borrower!.eSignatureUrl = "storage:uploads/borrower/sig.png";
    loan.loanInvestors[0]!.investor!.eSignatureUrl =
      "storage:uploads/lender/sig.png";

    expect(
      resolveSignerProfileSignatureFromLoan(loan, {
        partyRole: "borrower",
        partyEmail: "borrower@example.com",
        investorId: null,
      }),
    ).toBe("storage:uploads/borrower/sig.png");
    expect(
      resolveSignerProfileSignatureFromLoan(loan, {
        partyRole: "lender",
        partyEmail: "lender@example.com",
        investorId: 1,
      }),
    ).toBe("storage:uploads/lender/sig.png");
  });

  it("returns witness profile signature when provided", () => {
    const loan = buildFixtureLoan();
    expect(
      resolveSignerProfileSignatureFromLoan(
        loan,
        {
          partyRole: "witness_1",
          partyEmail: "w@example.com",
          investorId: null,
        },
        "storage:uploads/witness/sig.png",
      ),
    ).toBe("storage:uploads/witness/sig.png");
  });
});

describe("isSavedSignatureIncludedForParty", () => {
  it("reads include flags from contract customization", () => {
    const customization = buildDefaultContractCustomizationFromLoan(
      buildLoanContractData(buildFixtureLoan()),
    );
    customization.includeBorrowerSignature = true;
    customization.lenderSignaturesIncluded = { "lender@example.com": true };
    customization.witness1SignatureIncluded = true;

    expect(
      isSavedSignatureIncludedForParty(
        customization,
        "borrower",
        "borrower@example.com",
      ),
    ).toBe(true);
    expect(
      isSavedSignatureIncludedForParty(
        customization,
        "lender",
        "lender@example.com",
      ),
    ).toBe(true);
    expect(
      isSavedSignatureIncludedForParty(
        customization,
        "witness_1",
        "w@example.com",
      ),
    ).toBe(true);
    expect(
      isSavedSignatureIncludedForParty(
        customization,
        "lender",
        "other@example.com",
      ),
    ).toBe(false);
  });
});

describe("loanHasPendingSigning", () => {
  it("is true when any invitation is unsigned and not expired", () => {
    expect(
      loanHasPendingSigning({
        signingInvitations: [
          { signedAt: new Date(), expiresAt: null },
          { signedAt: null, expiresAt: null },
        ],
      }),
    ).toBe(true);
  });

  it("is false when all invitations are signed or expired", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(
      loanHasPendingSigning({
        signingInvitations: [
          { signedAt: new Date(), expiresAt: null },
          { signedAt: null, expiresAt: past },
        ],
      }),
    ).toBe(false);
    expect(
      isSigningInvitationPending({ signedAt: null, expiresAt: past }),
    ).toBe(false);
  });

  it("returns signed only when the viewer's slot is signed", () => {
    const loan = {
      userId: "owner-1",
      borrower: { borrowerUserId: "borrower-1", email: "borrower@example.com" },
      loanInvestors: [
        {
          investorId: 9,
          investor: { investorUserId: "lender-1", email: "lender@example.com" },
        },
      ],
      signingInvitations: [
        {
          id: 1,
          partyRole: "borrower",
          partyEmail: "borrower@example.com",
          signedAt: null,
          expiresAt: null,
        },
        {
          id: 2,
          partyRole: "lender",
          partyEmail: "lender@example.com",
          signedAt: new Date(),
          expiresAt: null,
          investorId: 9,
        },
      ],
    };

    expect(
      loanSigningDisplayStatus(loan, "borrower-1", "borrower@example.com"),
    ).toBe("pending");
    expect(
      loanSigningDisplayStatus(loan, "lender-1", "lender@example.com"),
    ).toBe("signed");
    expect(loanSigningDisplayStatus(loan, "owner-1", "owner@example.com")).toBe(
      "none",
    );
  });
});

describe("loanSigningProgressFromInvitations", () => {
  it("counts signed invitations for loan detail summary", () => {
    expect(
      loanSigningProgressFromInvitations([
        { signedAt: new Date() },
        { signedAt: null },
        { signedAt: null },
      ]),
    ).toEqual({ signed: 1, total: 3 });
    expect(loanSigningProgressFromInvitations([])).toBeNull();
  });
});
