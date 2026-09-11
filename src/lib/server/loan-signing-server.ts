import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loanSigningInvitations, loans } from "$lib/server/db/schema";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import { applyContractCustomization } from "$lib/loan-contract-customization";
import { buildLoanContractData } from "$lib/loan-contract-data";
import {
  applySigningSignatures,
  buildSavedPartySignaturesFromLoan,
  buildInvestorEmailMap,
  emailsMatch,
  resolveContractCustomization,
  resolveSigningPartyDisplayName,
  type SigningInvitationRecord,
  type SigningPartyRole,
} from "$lib/loan-signing";
import { getLoanAccessContext } from "$lib/server/access-control";

const SIGNING_LINK_EXPIRY_DAYS = 30;

/** @deprecated Legacy token links only. New invitations do not expire. */
export function generateSigningToken(): string {
  return randomBytes(32).toString("hex");
}

/** @deprecated Legacy token links only. */
export function getSigningExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SIGNING_LINK_EXPIRY_DAYS);
  return expiresAt;
}

export async function loadSigningInvitationByToken(token: string) {
  return db.query.loanSigningInvitations.findFirst({
    where: eq(loanSigningInvitations.token, token),
    with: {
      loan: {
        with: {
          borrower: true,
          loanInvestors: {
            with: {
              investor: true,
              interestPeriods: true,
              receivedPayments: true,
            },
          },
        },
      },
      contract: true,
    },
  });
}

export async function loadLoanForSigning(loanId: number) {
  return db.query.loans.findFirst({
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
      signingInvitations: true,
    },
  });
}

export function pickSigningInvitationForUser(input: {
  invitations: SigningInvitationRecord[];
  signingPartyRoles: SigningPartyRole[];
  sessionEmail: string | null | undefined;
  preferredRole?: SigningPartyRole | null;
}): SigningInvitationRecord | null {
  const { invitations, signingPartyRoles, sessionEmail, preferredRole } = input;
  const allowed = invitations.filter((invitation) => {
    if (!signingPartyRoles.includes(invitation.partyRole)) return false;
    if (!invitation.partyEmail) return false;
    return !!sessionEmail && emailsMatch(sessionEmail, invitation.partyEmail);
  });

  if (allowed.length === 0) return null;
  if (preferredRole) {
    const preferred = allowed.find((item) => item.partyRole === preferredRole);
    if (preferred) return preferred;
  }
  return allowed[0] ?? null;
}

export async function buildSigningPagePayload(
  invitation: NonNullable<
    Awaited<ReturnType<typeof loadSigningInvitationByToken>>
  >,
) {
  const loan = invitation.loan;
  const allInvitations = await db.query.loanSigningInvitations.findMany({
    where: eq(loanSigningInvitations.loanId, loan.id),
  });

  const storedCustomization = invitation.contract
    .customization as ContractCustomization;
  const customization = resolveContractCustomization(loan, storedCustomization);
  const baseData = buildLoanContractData(loan);
  const appliedData = applyContractCustomization(baseData, customization);
  const investorEmailById = buildInvestorEmailMap(loan);

  const merged = applySigningSignatures(
    appliedData,
    customization,
    allInvitations as SigningInvitationRecord[],
    investorEmailById,
    buildSavedPartySignaturesFromLoan(loan),
  );

  const expired = invitation.expiresAt
    ? new Date(invitation.expiresAt).getTime() < Date.now()
    : false;

  return {
    loanId: loan.id,
    partyRole: invitation.partyRole,
    partyName: resolveSigningPartyDisplayName(
      invitation.partyRole,
      invitation.partyName,
      merged.customization,
    ),
    partyEmail: invitation.partyEmail,
    signedAt: invitation.signedAt
      ? new Date(invitation.signedAt).toISOString()
      : null,
    signatureDataUrl: invitation.signatureDataUrl,
    contractData: merged.data,
    customization: merged.customization,
    expired,
  };
}

export async function resolveAuthenticatedSigningPayload(input: {
  loanId: number;
  userId: string;
  sessionEmail: string | null | undefined;
  preferredRole?: SigningPartyRole | null;
}) {
  const access = await getLoanAccessContext(input.loanId, input.userId);
  if (!access.canView) return { error: "not_found" as const };

  const loan = await loadLoanForSigning(input.loanId);
  if (!loan?.loanContract) return { error: "not_found" as const };

  const invitation = pickSigningInvitationForUser({
    invitations: loan.signingInvitations as SigningInvitationRecord[],
    signingPartyRoles: access.signingPartyRoles,
    sessionEmail: input.sessionEmail,
    preferredRole: input.preferredRole,
  });

  if (!invitation) {
    return { error: "no_slot" as const, access };
  }

  const fullInvitation = {
    ...invitation,
    loan,
    contract: loan.loanContract,
  };

  const payload = await buildSigningPagePayload(fullInvitation as never);
  return { payload, invitation, access };
}

/** True when a non-owner party has an unsigned, non-expired signing invitation. */
export async function resolveCanSignContract(input: {
  loanId: number;
  userId: string;
  sessionEmail: string | null | undefined;
}): Promise<boolean> {
  const result = await resolveAuthenticatedSigningPayload(input);
  if ("error" in result) return false;
  return !result.payload.signedAt && !result.payload.expired;
}
