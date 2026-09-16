import {
  getCachedGroupsForUser,
  getCachedLoansByScope,
} from "$lib/server/cached-data";
import {
  buildWizardContactOptions,
  mapOwnedLoanToWizardRow,
} from "$lib/groups/group-list-map";

export async function loadGroupWizardData(userId: string) {
  const [ownedLoans, groups] = await Promise.all([
    getCachedLoansByScope(userId, "owned", "list"),
    getCachedGroupsForUser(userId),
  ]);

  const groupMeta = new Map(
    groups.map((group) => [
      group.id,
      { id: group.id, name: group.name, color: group.color ?? "orange" },
    ]),
  );

  return {
    ownedLoans: ownedLoans.map((loan) =>
      mapOwnedLoanToWizardRow(loan, groupMeta),
    ),
    usedColorKeys: groups
      .map((group) => group.color)
      .filter((color): color is string => Boolean(color)),
    existingNames: groups.map((group) => group.name),
    contactOptions: buildWizardContactOptions(ownedLoans),
  };
}

export async function loadAddableLoansForGroup(
  userId: string,
  inGroupLoanIds: Set<number>,
) {
  const [ownedLoans, groups] = await Promise.all([
    getCachedLoansByScope(userId, "owned", "list"),
    getCachedGroupsForUser(userId),
  ]);

  const groupMeta = new Map(
    groups.map((group) => [
      group.id,
      { id: group.id, name: group.name, color: group.color ?? "orange" },
    ]),
  );

  return ownedLoans
    .filter((loan) => !inGroupLoanIds.has(loan.id))
    .map((loan) => mapOwnedLoanToWizardRow(loan, groupMeta));
}
