import type { SigningPartyRole } from "$lib/loan-signing";

export type LoanMembership = "owner" | "investor" | "borrower" | "witness";

export type LoanAccessContext = {
  memberships: LoanMembership[];
  canView: boolean;
  canAdminEdit: boolean;
  editableInvestorIds: number[];
  signingPartyRoles: SigningPartyRole[];
  linkedInvestorId: number | null;
};
