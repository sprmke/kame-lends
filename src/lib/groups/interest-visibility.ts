import type { PartyRole } from "$lib/group-membership-diff";

export type GroupInterestVisibility = {
  showInterestToOwners: boolean;
  showInterestToInvestors: boolean;
  showInterestToBorrowers: boolean;
  showInterestToWitnesses: boolean;
};

/** Group creator always sees interest totals. A member is hidden when any of their roles is off. */
export function viewerCanSeeGroupInterest(input: {
  isCreator: boolean;
  roles: readonly string[];
  visibility: GroupInterestVisibility;
}): boolean {
  if (input.isCreator) return true;

  const allowed: Record<PartyRole, boolean> = {
    owner: input.visibility.showInterestToOwners,
    investor: input.visibility.showInterestToInvestors,
    borrower: input.visibility.showInterestToBorrowers,
    witness: input.visibility.showInterestToWitnesses,
  };

  for (const role of input.roles) {
    if (
      role === "owner" ||
      role === "investor" ||
      role === "borrower" ||
      role === "witness"
    ) {
      if (!allowed[role]) return false;
    }
  }
  return true;
}
