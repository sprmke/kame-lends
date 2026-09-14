import type { SigningPartyRole } from "$lib/loan-signing";
import { emailsMatch } from "$lib/loan-signing";
import type { LoanAccessContext, LoanMembership } from "$lib/loan-access";

export type LoanAccessGraph = {
  id: number;
  userId: string;
  borrower?: {
    borrowerUserId?: string | null;
    email?: string | null;
  } | null;
  loanInvestors: Array<{
    investorId: number;
    investor?: {
      investorUserId?: string | null;
      email?: string | null;
    } | null;
  }>;
  signingInvitations?: Array<{
    partyRole: string;
    partyEmail?: string | null;
    investorId?: number | null;
    witness?: {
      witnessUserId?: string | null;
      email?: string | null;
    } | null;
  }>;
  loanWitnesses?: Array<{
    id: number;
    witness?: {
      witnessUserId?: string | null;
      email?: string | null;
    } | null;
  }>;
};

export const emptyLoanAccess: LoanAccessContext = {
  memberships: [],
  canView: false,
  canAdminEdit: false,
  editableInvestorIds: [],
  signingPartyRoles: [],
  linkedInvestorId: null,
  linkedLoanWitnessId: null,
};

/** Membership from an already-loaded loan graph. Avoids a second access query. */
export function computeLoanAccessContext(
  loan: LoanAccessGraph,
  userId: string,
  sessionEmail: string | null,
): LoanAccessContext {
  const memberships = new Set<LoanMembership>();
  const signingPartyRoles = new Set<SigningPartyRole>();
  let linkedInvestorId: number | null = null;
  let linkedLoanWitnessId: number | null = null;

  const emailMatchesParty = (partyEmail: string | null | undefined) =>
    !!sessionEmail && emailsMatch(sessionEmail, partyEmail);

  if (loan.userId === userId) {
    memberships.add("owner");
  }

  for (const li of loan.loanInvestors) {
    if (li.investor?.investorUserId === userId) {
      memberships.add("investor");
      linkedInvestorId = li.investorId;
      signingPartyRoles.add("lender");
    }
  }

  if (
    loan.borrower?.borrowerUserId === userId ||
    emailMatchesParty(loan.borrower?.email)
  ) {
    memberships.add("borrower");
    signingPartyRoles.add("borrower");
  }

  for (const invitation of loan.signingInvitations ?? []) {
    const witnessLinked = invitation.witness?.witnessUserId === userId;
    const emailLinked = emailMatchesParty(invitation.partyEmail);

    if (
      invitation.partyRole === "witness_1" ||
      invitation.partyRole === "witness_2"
    ) {
      if (witnessLinked || emailLinked) {
        memberships.add("witness");
        signingPartyRoles.add(invitation.partyRole);
      }
    }

    if (
      invitation.partyRole === "borrower" &&
      (loan.borrower?.borrowerUserId === userId || emailLinked)
    ) {
      memberships.add("borrower");
      signingPartyRoles.add("borrower");
    }

    if (invitation.partyRole === "lender") {
      const linkedByInvestor =
        !!invitation.investorId &&
        loan.loanInvestors.some(
          (li) =>
            li.investorId === invitation.investorId &&
            li.investor?.investorUserId === userId,
        );
      if (linkedByInvestor || emailLinked) {
        memberships.add("investor");
        signingPartyRoles.add("lender");
        if (invitation.investorId && linkedByInvestor) {
          linkedInvestorId = invitation.investorId;
        }
      }
    }
  }

  for (const lw of loan.loanWitnesses ?? []) {
    if (
      lw.witness?.witnessUserId === userId ||
      emailMatchesParty(lw.witness?.email)
    ) {
      memberships.add("witness");
      linkedLoanWitnessId = lw.id;
    }
  }

  const list = [...memberships];
  const canAdminEdit = memberships.has("owner");

  return {
    memberships: list,
    canView: list.length > 0,
    canAdminEdit,
    editableInvestorIds: canAdminEdit
      ? loan.loanInvestors.map((li) => li.investorId)
      : [],
    signingPartyRoles: [...signingPartyRoles],
    linkedInvestorId,
    linkedLoanWitnessId,
  };
}
