import type { WitnessSigningInvitation, WitnessWithLoans } from "$lib/types";

export function countWitnessedLoans(
  witness: Pick<WitnessWithLoans, "signingInvitations">,
): number {
  const invitations = witness.signingInvitations ?? [];
  return new Set(invitations.map((invitation) => invitation.loan.id)).size;
}

export function uniqueWitnessedLoans(
  invitations: WitnessSigningInvitation[] = [],
): WitnessSigningInvitation[] {
  const byLoanId = new Map<number, WitnessSigningInvitation>();
  for (const invitation of invitations) {
    if (!byLoanId.has(invitation.loan.id)) {
      byLoanId.set(invitation.loan.id, invitation);
    }
  }
  return [...byLoanId.values()];
}
