import { eq, and } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loanContracts, loanSigningInvitations } from "$lib/server/db/schema";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import { buildDefaultContractCustomizationFromLoan } from "$lib/loan-contract-customization";
import { buildLoanContractData } from "$lib/loan-contract-data";
import {
  buildSigningInvitationsForLoan,
  getWitnessInvitationPartyName,
  normalizeEmail,
} from "$lib/loan-signing";
import type { SigningPartyRole } from "$lib/loan-signing";
import type { LoanWithInvestors } from "$lib/types";

function signingInvitationKey(
  partyRole: SigningPartyRole,
  investorId?: number | null,
): string {
  if (partyRole === "lender") {
    return `lender:${investorId ?? "unknown"}`;
  }
  return partyRole;
}

export async function saveLoanContractAndInvitations(
  loan: LoanWithInvestors,
  customizationInput?: ContractCustomization | null,
) {
  const contractData = buildLoanContractData(loan);
  const defaults = buildDefaultContractCustomizationFromLoan(contractData);
  const customization = customizationInput
    ? ({ ...defaults, ...customizationInput } as ContractCustomization)
    : defaults;

  const [contract] = await db
    .insert(loanContracts)
    .values({
      loanId: loan.id,
      customization,
    })
    .returning();

  const invitations = await insertSigningInvitations(
    loan,
    contract.id,
    customization,
  );

  return { contract, invitations };
}

async function insertSigningInvitations(
  loan: LoanWithInvestors,
  contractId: number,
  customization: ContractCustomization,
) {
  const invitationInputs = buildSigningInvitationsForLoan(
    loan,
    contractId,
    customization,
  );

  if (invitationInputs.length === 0) {
    return [];
  }

  return db
    .insert(loanSigningInvitations)
    .values(
      invitationInputs.map((input) => ({
        loanId: input.loanId,
        contractId: input.contractId,
        token: null,
        partyRole: input.partyRole,
        investorId: input.investorId ?? null,
        witnessId: input.witnessId ?? null,
        partyName: input.partyName,
        partyEmail: input.partyEmail ?? null,
        expiresAt: null,
      })),
    )
    .returning();
}

async function insertSigningInvitationInputs(
  inputs: ReturnType<typeof buildSigningInvitationsForLoan>,
) {
  if (inputs.length === 0) {
    return [];
  }

  return db
    .insert(loanSigningInvitations)
    .values(
      inputs.map((input) => ({
        loanId: input.loanId,
        contractId: input.contractId,
        token: null,
        partyRole: input.partyRole,
        investorId: input.investorId ?? null,
        witnessId: input.witnessId ?? null,
        partyName: input.partyName,
        partyEmail: input.partyEmail ?? null,
        expiresAt: null,
      })),
    )
    .returning();
}

async function syncSigningInvitationBorrowerAndLenders(
  loan: LoanWithInvestors,
) {
  if (loan.borrower) {
    const existingBorrower = await db.query.loanSigningInvitations.findFirst({
      where: and(
        eq(loanSigningInvitations.loanId, loan.id),
        eq(loanSigningInvitations.partyRole, "borrower"),
      ),
    });

    if (existingBorrower) {
      const emailChanged =
        normalizeEmail(existingBorrower.partyEmail) !==
        normalizeEmail(loan.borrower.email);

      await db
        .update(loanSigningInvitations)
        .set({
          partyName: loan.borrower.name,
          partyEmail: loan.borrower.email,
          ...(emailChanged
            ? {
                signatureDataUrl: null,
                signedAt: null,
                consentedAt: null,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(loanSigningInvitations.id, existingBorrower.id));
    }
  }

  const seenInvestorIds = new Set<number>();
  for (const li of loan.loanInvestors) {
    if (seenInvestorIds.has(li.investorId)) continue;
    seenInvestorIds.add(li.investorId);

    const existingLender = await db.query.loanSigningInvitations.findFirst({
      where: and(
        eq(loanSigningInvitations.loanId, loan.id),
        eq(loanSigningInvitations.partyRole, "lender"),
        eq(loanSigningInvitations.investorId, li.investorId),
      ),
    });

    if (!existingLender) continue;

    const emailChanged =
      normalizeEmail(existingLender.partyEmail) !==
      normalizeEmail(li.investor.email);

    await db
      .update(loanSigningInvitations)
      .set({
        partyName: li.investor.name,
        partyEmail: li.investor.email,
        ...(emailChanged
          ? {
              signatureDataUrl: null,
              signedAt: null,
              consentedAt: null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(loanSigningInvitations.id, existingLender.id));
  }
}

async function syncSigningInvitationWitnesses(
  loanId: number,
  customization: ContractCustomization,
) {
  const witnessRoles = ["witness_1", "witness_2"] as const;

  for (const partyRole of witnessRoles) {
    const isFirst = partyRole === "witness_1";
    await db
      .update(loanSigningInvitations)
      .set({
        partyName: getWitnessInvitationPartyName(partyRole, customization),
        partyEmail:
          (isFirst
            ? customization.witness1Email
            : customization.witness2Email
          )?.trim() || null,
        witnessId: isFirst
          ? customization.witness1Id
          : customization.witness2Id,
      })
      .where(
        and(
          eq(loanSigningInvitations.loanId, loanId),
          eq(loanSigningInvitations.partyRole, partyRole),
        ),
      );
  }
}

export async function upsertLoanContractCustomization(
  loan: LoanWithInvestors,
  customization: ContractCustomization,
) {
  const existing = await db.query.loanContracts.findFirst({
    where: eq(loanContracts.loanId, loan.id),
  });

  if (existing) {
    const [updated] = await db
      .update(loanContracts)
      .set({
        customization,
        updatedAt: new Date(),
      })
      .where(eq(loanContracts.id, existing.id))
      .returning();
    await syncSigningInvitationWitnesses(loan.id, customization);
    return updated;
  }

  const [created] = await db
    .insert(loanContracts)
    .values({
      loanId: loan.id,
      customization,
    })
    .returning();

  await syncSigningInvitationWitnesses(loan.id, customization);
  return created;
}

export async function syncSigningInvitationsForLoan(loan: LoanWithInvestors) {
  const contract = await db.query.loanContracts.findFirst({
    where: eq(loanContracts.loanId, loan.id),
  });

  if (!contract) {
    const result = await saveLoanContractAndInvitations(loan, null);
    return result.invitations;
  }

  const customization = contract.customization as ContractCustomization;
  const existing = await db.query.loanSigningInvitations.findMany({
    where: eq(loanSigningInvitations.loanId, loan.id),
  });

  const existingKeys = new Set(
    existing.map((invitation) =>
      signingInvitationKey(invitation.partyRole, invitation.investorId),
    ),
  );

  const expected = buildSigningInvitationsForLoan(
    loan,
    contract.id,
    customization,
  );

  const missing = expected.filter(
    (input) =>
      !existingKeys.has(
        signingInvitationKey(input.partyRole, input.investorId ?? null),
      ),
  );

  if (missing.length > 0) {
    const inserted = await insertSigningInvitationInputs(missing);
    existing.push(...inserted);
  }

  await syncSigningInvitationBorrowerAndLenders(loan);
  await syncSigningInvitationWitnesses(loan.id, customization);
  return existing;
}

export async function ensureLoanSigningSetup(loan: LoanWithInvestors) {
  return syncSigningInvitationsForLoan(loan);
}
