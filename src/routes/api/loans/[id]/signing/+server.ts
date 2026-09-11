import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loans, loanSigningInvitations } from "$lib/server/db/schema";
import { ensureLoanSigningSetup } from "$lib/server/loan-contract-persistence";
import {
  getLoanAccessContext,
  hasLoanAdminAccess,
} from "$lib/server/access-control";
import {
  isSigningInvitationIncluded,
  resolveContractCustomization,
  resolveSigningPartyDisplayName,
  sortSigningInvitations,
  toSigningInvitationSummary,
  type SigningInvitationRecord,
} from "$lib/loan-signing";
import { pickSigningInvitationForUser } from "$lib/server/loan-signing-server";
import {
  buildDefaultContractCustomizationFromLoan,
  type ContractCustomization,
} from "$lib/loan-contract-customization";
import { buildLoanContractData } from "$lib/loan-contract-data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const loanId = Number(id);
    if (Number.isNaN(loanId)) {
      return json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const access = await getLoanAccessContext(loanId, session.user.id);
    if (!access.canView) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

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

    if (!loan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const invitations = (await hasLoanAdminAccess(loanId, session.user.id))
      ? await ensureLoanSigningSetup(loan)
      : await db.query.loanSigningInvitations.findMany({
          where: eq(loanSigningInvitations.loanId, loanId),
        });
    const contractData = buildLoanContractData(loan);
    const defaults = buildDefaultContractCustomizationFromLoan(contractData);
    const storedCustomization = loan.loanContract?.customization as
      ContractCustomization | undefined;
    const resolved = resolveContractCustomization(loan, storedCustomization);
    const customization: ContractCustomization = {
      ...defaults,
      ...resolved,
      lenderSignaturesIncluded: {
        ...defaults.lenderSignaturesIncluded,
        ...(resolved.lenderSignaturesIncluded ?? {}),
      },
      lenderDateSigned: {
        ...defaults.lenderDateSigned,
        ...resolved.lenderDateSigned,
      },
    };
    const activeInvitations = invitations.filter((invitation) =>
      isSigningInvitationIncluded(invitation, loan, customization),
    );
    const origin = process.env.PUBLIC_APP_URL;
    const summaries = sortSigningInvitations(activeInvitations).map(
      (invitation) =>
        toSigningInvitationSummary(
          {
            id: invitation.id,
            token: invitation.token,
            partyRole: invitation.partyRole,
            investorId: invitation.investorId,
            partyName: resolveSigningPartyDisplayName(
              invitation.partyRole,
              invitation.partyName,
              customization,
            ),
            partyEmail: invitation.partyEmail,
            signatureDataUrl: invitation.signatureDataUrl,
            signedAt: invitation.signedAt,
            consentedAt: invitation.consentedAt,
            expiresAt: invitation.expiresAt,
            loanId,
          },
          origin,
          loanId,
        ),
    );

    const viewerInvitation = pickSigningInvitationForUser({
      invitations: activeInvitations as SigningInvitationRecord[],
      signingPartyRoles: access.signingPartyRoles,
      sessionEmail: session.user.email,
    });

    return json({
      hasContract: Boolean(loan.loanContract),
      invitations: summaries,
      viewerInvitationId: viewerInvitation?.id ?? null,
    });
  } catch (error) {
    console.error("Error fetching signing invitations:", error);
    return json(
      { error: "Failed to fetch signing invitations" },
      { status: 500 },
    );
  }
};
