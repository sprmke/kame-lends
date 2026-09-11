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

describe("loan contract PDF", () => {
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
