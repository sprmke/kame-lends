import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  loanGroupDefaultWitnesses,
  loanGroupLoans,
  loanSigningInvitations,
  loans,
  witnesses,
} from "$lib/server/db/schema";
import {
  applyDefaultWitnesses,
  type DefaultWitnessProfile,
} from "$lib/groups/default-witnesses";
import {
  areContractCustomizationsEqual,
  buildDefaultContractCustomizationFromLoan,
  parseStoredContractCustomization,
  type ContractCustomization,
} from "$lib/loan-contract-customization";
import { buildLoanContractData } from "$lib/loan-contract-data";
import type { LoanWithInvestors } from "$lib/types";
import {
  syncSigningInvitationsForLoan,
  upsertLoanContractCustomization,
} from "$lib/server/loan-contract-persistence";

export async function loadDefaultWitnessesForGroups(
  groupIds: number[],
): Promise<DefaultWitnessProfile[]> {
  if (groupIds.length === 0) return [];
  const rows = await db
    .select({
      id: witnesses.id,
      name: witnesses.name,
      email: witnesses.email,
      address: witnesses.address,
      validIdUrl: witnesses.validIdUrl,
      eSignatureUrl: witnesses.eSignatureUrl,
      autoSign: loanGroupDefaultWitnesses.autoSign,
    })
    .from(loanGroupDefaultWitnesses)
    .innerJoin(witnesses, eq(witnesses.id, loanGroupDefaultWitnesses.witnessId))
    .where(inArray(loanGroupDefaultWitnesses.groupId, groupIds))
    .orderBy(
      asc(loanGroupDefaultWitnesses.groupId),
      asc(loanGroupDefaultWitnesses.position),
    );
  return rows;
}

async function markAutoSignedWitnesses(
  loanId: number,
  customization: ContractCustomization,
) {
  if (!customization.includeWitnesses) return;
  const now = new Date();
  const slots: Array<{
    role: "witness_1" | "witness_2";
    included: boolean;
    url: string;
  }> = [
    {
      role: "witness_1",
      included: customization.witness1SignatureIncluded,
      url: customization.witness1ESignatureUrl,
    },
    {
      role: "witness_2",
      included:
        customization.includeSecondWitness &&
        customization.witness2SignatureIncluded,
      url: customization.witness2ESignatureUrl,
    },
  ];

  for (const slot of slots) {
    const url = slot.url.trim();
    if (!slot.included || !url) continue;
    await db
      .update(loanSigningInvitations)
      .set({
        signatureDataUrl: url,
        signedAt: now,
        consentedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(loanSigningInvitations.loanId, loanId),
          eq(loanSigningInvitations.partyRole, slot.role),
          isNull(loanSigningInvitations.signedAt),
        ),
      );
  }
}

/** Fill empty contract witness slots from the loan's current groups. */
export async function applyGroupDefaultWitnessesToLoan(loanId: number) {
  const links = await db
    .select({ groupId: loanGroupLoans.groupId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.loanId, loanId));
  if (links.length === 0) return;

  const defaults = await loadDefaultWitnessesForGroups(
    links.map((link) => link.groupId),
  );
  if (defaults.length === 0) return;

  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    with: {
      borrower: true,
      loanContract: true,
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

  const typed = loan as LoanWithInvestors & {
    loanContract: { customization: unknown } | null;
  };
  const baseDefaults = buildDefaultContractCustomizationFromLoan(
    buildLoanContractData(typed),
  );
  const base = typed.loanContract
    ? parseStoredContractCustomization(
        typed.loanContract.customization,
        baseDefaults,
      )
    : baseDefaults;
  const next = applyDefaultWitnesses(base, defaults);
  if (!areContractCustomizationsEqual(base, next)) {
    await upsertLoanContractCustomization(typed, next);
  }
  await syncSigningInvitationsForLoan(typed);
  await markAutoSignedWitnesses(loanId, next);
}
