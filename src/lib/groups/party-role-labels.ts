import type { PartyRole } from "$lib/group-membership-diff";

export function partyRoleLabel(role: PartyRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "investor":
      return "Investor";
    case "borrower":
      return "Borrower";
    case "witness":
      return "Witness";
    default:
      return role;
  }
}

export function formatPartyRoles(roles: readonly PartyRole[]): string {
  const unique = [...new Set(roles)];
  return unique.map(partyRoleLabel).join(", ");
}
