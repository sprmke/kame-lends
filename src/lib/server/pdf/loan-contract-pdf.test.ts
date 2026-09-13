import { describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { buildLoanContractData } from "$lib/loan-contract-data";
import {
  applyContractCustomization,
  buildDefaultContractCustomizationFromLoan,
} from "$lib/loan-contract-customization";
import {
  applySigningSignatures,
  buildInvestorEmailMap,
  buildSavedPartySignaturesFromLoan,
  type SigningInvitationRecord,
} from "$lib/loan-signing";
import { renderLoanContractPdfBuffer } from "./render";
import type { LoanContractData } from "$lib/loan-contract-data";
import type { LoanWithInvestors } from "$lib/types";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const WEBP =
  "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";
const CORRUPT_JPEG = "data:image/jpeg;base64,not-a-jpeg";

const dummyLoan = { id: 1, loanName: "Test" } as LoanWithInvestors;

function fixtureContractData(
  overrides: Partial<LoanContractData> = {},
): LoanContractData {
  return {
    contractNumber: "PT-1-2026",
    agreementDate: new Date("2026-01-01T00:00:00Z"),
    borrowerName: "Borrower",
    borrowerAddress: null,
    borrowerContact: null,
    borrowerEmail: "borrower@example.com",
    borrowerValidIdUrl: null,
    borrowerESignatureUrl: null,
    loanTitleLabel: "Test loan",
    loanType: "Agent",
    contractTitle: "Loan Agreement",
    collateralDescription: "None",
    freeLotSqm: null,
    dateBorrowed: new Date("2026-01-01T00:00:00Z"),
    dueDate: new Date("2026-01-08T00:00:00Z"),
    principalAmount: 1000,
    totalInterest: 50,
    totalAmountDue: 1050,
    lenders: [
      {
        name: "Lender",
        contactNumber: null,
        email: "lender@example.com",
        address: null,
        validIdUrl: null,
        eSignatureUrl: null,
        principalAmount: 1000,
        interestDescription: "5% of principal disbursed",
      },
    ],
    notes: null,
    ...overrides,
  };
}

describe("loan contract PDF", () => {
  it("renders a contract with no identity images", async () => {
    const data = fixtureContractData();
    const customization = buildDefaultContractCustomizationFromLoan(data);
    const buffer = await renderLoanContractPdfBuffer(
      dummyLoan,
      customization,
      data,
    );
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("renders when a party valid ID is a PNG data URL", async () => {
    const data = fixtureContractData({ borrowerValidIdUrl: TINY_PNG });
    const customization = buildDefaultContractCustomizationFromLoan(data);
    const buffer = await renderLoanContractPdfBuffer(
      dummyLoan,
      customization,
      data,
    );
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("skips WebP valid IDs instead of failing the PDF", async () => {
    const data = fixtureContractData({ borrowerValidIdUrl: WEBP });
    const customization = buildDefaultContractCustomizationFromLoan(data);
    const buffer = await renderLoanContractPdfBuffer(
      dummyLoan,
      customization,
      data,
    );
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("retries without images when a JPEG data URL is unreadable", async () => {
    const data = fixtureContractData({ borrowerValidIdUrl: CORRUPT_JPEG });
    const customization = buildDefaultContractCustomizationFromLoan(data);
    const buffer = await renderLoanContractPdfBuffer(
      dummyLoan,
      customization,
      data,
    );
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("renders a buffer for the latest local loan", async () => {
    const loan = await db.query.loans.findFirst({
      orderBy: [desc(loans.id)],
      with: {
        borrower: true,
        loanContract: true,
        signingInvitations: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    expect(loan).toBeTruthy();

    const baseData = buildLoanContractData(loan!);
    const storedCustomization = loan!.loanContract?.customization as
      | import("$lib/loan-contract-customization").ContractCustomization
      | undefined;
    const customization =
      storedCustomization ??
      buildDefaultContractCustomizationFromLoan(baseData);
    const appliedData = applyContractCustomization(baseData, customization);
    const investorEmailById = buildInvestorEmailMap(loan!);
    const merged = applySigningSignatures(
      appliedData,
      customization,
      (loan!.signingInvitations ?? []) as SigningInvitationRecord[],
      investorEmailById,
      buildSavedPartySignaturesFromLoan(loan!),
    );

    const buffer = await renderLoanContractPdfBuffer(
      loan!,
      merged.customization,
      merged.data,
    );

    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("renders a loan with stored e-signatures", async () => {
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, 56),
      with: {
        borrower: true,
        loanContract: true,
        signingInvitations: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    if (!loan) return;

    const baseData = buildLoanContractData(loan);
    const storedCustomization = loan.loanContract?.customization as
      | import("$lib/loan-contract-customization").ContractCustomization
      | undefined;
    const customization =
      storedCustomization ??
      buildDefaultContractCustomizationFromLoan(baseData);
    const appliedData = applyContractCustomization(baseData, customization);
    const investorEmailById = buildInvestorEmailMap(loan);
    const merged = applySigningSignatures(
      appliedData,
      customization,
      (loan.signingInvitations ?? []) as SigningInvitationRecord[],
      investorEmailById,
      buildSavedPartySignaturesFromLoan(loan),
    );

    const buffer = await renderLoanContractPdfBuffer(
      loan,
      merged.customization,
      merged.data,
    );

    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("renders loan 87 specifically", async () => {
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, 87),
      with: {
        borrower: true,
        loanContract: true,
        signingInvitations: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    expect(loan).toBeTruthy();

    const baseData = buildLoanContractData(loan!);
    const storedCustomization = loan!.loanContract?.customization as
      | import("$lib/loan-contract-customization").ContractCustomization
      | undefined;
    const customization =
      storedCustomization ??
      buildDefaultContractCustomizationFromLoan(baseData);
    const appliedData = applyContractCustomization(baseData, customization);
    const investorEmailById = buildInvestorEmailMap(loan!);
    const merged = applySigningSignatures(
      appliedData,
      customization,
      (loan!.signingInvitations ?? []) as SigningInvitationRecord[],
      investorEmailById,
      buildSavedPartySignaturesFromLoan(loan!),
    );

    const buffer = await renderLoanContractPdfBuffer(
      loan!,
      merged.customization,
      merged.data,
    );

    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
