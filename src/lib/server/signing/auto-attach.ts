import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  borrowers,
  investors,
  loanInvestors,
  loanSigningInvitations,
  loans,
  users,
  witnesses,
} from "$lib/server/db/schema";
import { computeLoanAccessContext } from "$lib/loan-access-compute";
import {
  buildDefaultContractCustomizationFromLoan,
  parseStoredContractCustomization,
  type ContractCustomization,
} from "$lib/loan-contract-customization";
import { buildLoanContractData } from "$lib/loan-contract-data";
import { applyAutoAttachFlagsToCustomization } from "$lib/signing/auto-attach-customization";
import {
  emailsMatch,
  normalizeEmail,
  resolveSignerProfileSignatureFromLoan,
  type SigningInvitationRecord,
  type SigningPartyRole,
} from "$lib/loan-signing";
import { loadPartyUserIdentityDocuments } from "$lib/server/party-profile";
import {
  upsertLoanContractCustomization,
  syncSigningInvitationsForLoan,
} from "$lib/server/loan-contract-persistence";
import { isAutoAttachSignatureEnabled } from "$lib/server/signing/preferences";
import type { LoanWithInvestors } from "$lib/types";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

const loanWithSigningGraph = {
  borrower: true,
  loanContract: true,
  loanInvestors: {
    with: {
      investor: true,
      interestPeriods: true,
      receivedPayments: true,
    },
  },
  signingInvitations: {
    with: {
      witness: true,
    },
  },
} as const;

function todaySignedDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function collectPartyUserIdsFromLoan(loan: LoanWithInvestors): Set<string> {
  const ids = new Set<string>();
  if (loan.borrower?.borrowerUserId) {
    ids.add(loan.borrower.borrowerUserId);
  }
  for (const li of loan.loanInvestors ?? []) {
    const investorUserId = (
      li.investor as { investorUserId?: string | null } | undefined
    )?.investorUserId;
    if (investorUserId) ids.add(investorUserId);
  }
  for (const invitation of loan.signingInvitations ?? []) {
    const witnessUserId = (
      invitation as { witness?: { witnessUserId?: string | null } }
    ).witness?.witnessUserId;
    if (witnessUserId) ids.add(witnessUserId);
  }
  return ids;
}

type InvitationWithWitness = SigningInvitationRecord & {
  witness?: { witnessUserId?: string | null; email?: string | null } | null;
};

function invitationForRole(
  invitations: InvitationWithWitness[],
  role: SigningPartyRole,
  userId: string,
  sessionEmail: string | null,
  linkedInvestorId: number | null,
  loan: LoanWithInvestors,
): InvitationWithWitness | null {
  for (const invitation of invitations) {
    if (invitation.partyRole !== role) continue;

    if (role === "lender") {
      if (
        linkedInvestorId != null &&
        invitation.investorId === linkedInvestorId
      ) {
        return invitation;
      }
      if (sessionEmail && emailsMatch(sessionEmail, invitation.partyEmail)) {
        return invitation;
      }
      continue;
    }

    if (role === "borrower") {
      if (loan.borrower?.borrowerUserId === userId) return invitation;
      if (sessionEmail && emailsMatch(sessionEmail, loan.borrower?.email)) {
        return invitation;
      }
      continue;
    }

    if (role === "witness_1" || role === "witness_2") {
      if (invitation.witness?.witnessUserId === userId) return invitation;
      if (sessionEmail && emailsMatch(sessionEmail, invitation.partyEmail)) {
        return invitation;
      }
    }
  }
  return null;
}

function lenderEmailForAccess(
  loan: LoanWithInvestors,
  linkedInvestorId: number | null,
): string | null {
  if (linkedInvestorId == null) return null;
  const match = loan.loanInvestors?.find(
    (li) => li.investorId === linkedInvestorId,
  );
  return match?.investor?.email?.trim() || null;
}

async function resolveWitnessSignatureUrls(
  loan: LoanWithInvestors,
  roles: SigningPartyRole[],
): Promise<{ witness1: string | null; witness2: string | null }> {
  let witness1: string | null = null;
  let witness2: string | null = null;
  if (!roles.includes("witness_1") && !roles.includes("witness_2")) {
    return { witness1, witness2 };
  }
  const contract = loan.loanContract?.customization as
    ContractCustomization | undefined;
  if (roles.includes("witness_1")) {
    witness1 = contract?.witness1ESignatureUrl?.trim() || null;
    const invitation = loan.signingInvitations?.find(
      (row) => row.partyRole === "witness_1",
    );
    if (!witness1 && invitation?.witnessId) {
      const row = await db.query.witnesses.findFirst({
        where: eq(witnesses.id, invitation.witnessId),
        columns: { eSignatureUrl: true },
      });
      witness1 = row?.eSignatureUrl?.trim() || null;
    }
  }
  if (roles.includes("witness_2")) {
    witness2 = contract?.witness2ESignatureUrl?.trim() || null;
    const invitation = loan.signingInvitations?.find(
      (row) => row.partyRole === "witness_2",
    );
    if (!witness2 && invitation?.witnessId) {
      const row = await db.query.witnesses.findFirst({
        where: eq(witnesses.id, invitation.witnessId),
        columns: { eSignatureUrl: true },
      });
      witness2 = row?.eSignatureUrl?.trim() || null;
    }
  }
  return { witness1, witness2 };
}

export async function applyAutoAttachForUserOnLoan(
  loan: LoanWithInvestors,
  userId: string,
  sessionEmail: string | null,
): Promise<boolean> {
  if (!(await isAutoAttachSignatureEnabled(userId))) {
    return false;
  }

  const documents = await loadPartyUserIdentityDocuments(userId);
  const savedSignature = documents.eSignatureUrl?.trim();
  if (!savedSignature) return false;

  const access = computeLoanAccessContext(loan, userId, sessionEmail);
  if (access.signingPartyRoles.length === 0) return false;

  const invitations = (loan.signingInvitations ??
    []) as unknown as InvitationWithWitness[];
  const roles = [...access.signingPartyRoles];
  const signedDateIso = todaySignedDateIso();
  const witnessUrls = await resolveWitnessSignatureUrls(loan, roles);
  const lenderEmail = lenderEmailForAccess(loan, access.linkedInvestorId);

  const baseDefaults = buildDefaultContractCustomizationFromLoan(
    buildLoanContractData(loan),
  );
  const stored = loan.loanContract?.customization;
  const current = stored
    ? parseStoredContractCustomization(stored, baseDefaults)
    : baseDefaults;

  const nextCustomization = applyAutoAttachFlagsToCustomization(
    current,
    roles,
    {
      lenderEmail,
      witness1SignatureUrl: witnessUrls.witness1 ?? savedSignature,
      witness2SignatureUrl: witnessUrls.witness2 ?? savedSignature,
      signedDateIso,
    },
  );

  await upsertLoanContractCustomization(loan, nextCustomization);
  await syncSigningInvitationsForLoan(loan);

  const now = new Date();
  for (const role of roles) {
    const invitation = invitationForRole(
      invitations,
      role,
      userId,
      sessionEmail,
      access.linkedInvestorId,
      loan,
    );
    if (!invitation || invitation.signedAt != null) continue;

    let witnessSignatureUrl: string | null = null;
    if (role === "witness_1" || role === "witness_2") {
      witnessSignatureUrl =
        role === "witness_1" ? witnessUrls.witness1 : witnessUrls.witness2;
    }

    const signatureDataUrl =
      resolveSignerProfileSignatureFromLoan(
        loan,
        invitation,
        witnessSignatureUrl,
      )?.trim() || savedSignature;

    if (!signatureDataUrl) continue;

    await db
      .update(loanSigningInvitations)
      .set({
        signatureDataUrl,
        signedAt: now,
        consentedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(loanSigningInvitations.id, invitation.id),
          isNull(loanSigningInvitations.signedAt),
        ),
      );
  }

  return true;
}

export async function applyAutoAttachSignatureToLoan(
  loanId: number,
): Promise<void> {
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    with: loanWithSigningGraph,
  });
  if (!loan?.loanContract) return;

  const typed = loan as LoanWithInvestors;
  const partyUserIds = collectPartyUserIdsFromLoan(typed);
  if (partyUserIds.size === 0) return;

  const partyUsers = await db.query.users.findMany({
    where: inArray(users.id, [...partyUserIds]),
    columns: { id: true, email: true },
  });

  let changed = false;
  for (const partyUser of partyUsers) {
    const applied = await applyAutoAttachForUserOnLoan(
      typed,
      partyUser.id,
      partyUser.email,
    );
    if (applied) changed = true;
  }

  if (changed) {
    invalidateLoanData();
  }
}

export async function findLoanIdsForPartyUser(
  userId: string,
  email: string | null,
): Promise<number[]> {
  const normalizedEmail = normalizeEmail(email);
  const ids = new Set<number>();

  const borrowerLoans = await db
    .select({ id: loans.id })
    .from(loans)
    .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .where(eq(borrowers.borrowerUserId, userId));
  for (const row of borrowerLoans) ids.add(row.id);

  const investorLoans = await db
    .select({ id: loans.id })
    .from(loans)
    .innerJoin(loanInvestors, eq(loans.id, loanInvestors.loanId))
    .innerJoin(investors, eq(loanInvestors.investorId, investors.id))
    .where(eq(investors.investorUserId, userId));
  for (const row of investorLoans) ids.add(row.id);

  const witnessLoans = await db
    .select({ loanId: loanSigningInvitations.loanId })
    .from(loanSigningInvitations)
    .innerJoin(witnesses, eq(loanSigningInvitations.witnessId, witnesses.id))
    .where(eq(witnesses.witnessUserId, userId));
  for (const row of witnessLoans) ids.add(row.loanId);

  if (normalizedEmail) {
    const emailBorrowerLoans = await db
      .select({ id: loans.id })
      .from(loans)
      .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
      .where(eq(borrowers.email, normalizedEmail));
    for (const row of emailBorrowerLoans) ids.add(row.id);

    const emailInvestorLoans = await db
      .select({ id: loans.id })
      .from(loans)
      .innerJoin(loanInvestors, eq(loans.id, loanInvestors.loanId))
      .innerJoin(investors, eq(loanInvestors.investorId, investors.id))
      .where(eq(investors.email, normalizedEmail));
    for (const row of emailInvestorLoans) ids.add(row.id);

    const emailInvitationLoans = await db
      .select({ loanId: loanSigningInvitations.loanId })
      .from(loanSigningInvitations)
      .where(eq(loanSigningInvitations.partyEmail, normalizedEmail));
    for (const row of emailInvitationLoans) ids.add(row.loanId);
  }

  return [...ids];
}

export async function applyAutoAttachForUserOnAllLoans(input: {
  userId: string;
  email: string | null;
}): Promise<void> {
  const loanIds = await findLoanIdsForPartyUser(input.userId, input.email);
  for (const loanId of loanIds) {
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: loanWithSigningGraph,
    });
    if (!loan?.loanContract) continue;
    await applyAutoAttachForUserOnLoan(
      loan as LoanWithInvestors,
      input.userId,
      input.email,
    );
  }
  invalidateLoanData();
}
