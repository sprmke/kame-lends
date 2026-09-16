import type { PageServerLoad } from "./$types";
import { eq } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { getCachedGroupsForUser } from "$lib/server/cached-data";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { stripDataImageUrls } from "$lib/json-safe-images";
import {
  buildWizardContactOptions,
  mapGroupToListCard,
  mapOwnedLoanToWizardRow,
} from "$lib/groups/group-list-map";
import { requireUserSession } from "$lib/server/request-auth";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";
import { readGoogleServiceAccountCredentials } from "$lib/server/google-calendar-config";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  event.depends("app:groups");

  const userId = session.user.id;
  const isAdmin = await isWorkspaceAdmin(userId);

  // Workspace admin sees every group; everyone else sees groups they created or are shared into.
  const items = getCachedGroupsForUser(userId, isAdmin).then((groups) =>
    groups.map((group) => mapGroupToListCard(group, userId)),
  );

  return {
    items,
    currentUserId: userId,
    canCreate: true,
    createCalendarAvailable: readGoogleServiceAccountCredentials(env) !== null,
    wizard: loadWizardData(userId, isAdmin),
  };
};

async function loadWizardData(userId: string, isAdmin: boolean) {
  const [ownedLoans, groups] = await Promise.all([
    db.query.loans.findMany({
      where: eq(loans.userId, userId),
      with: {
        borrower: { columns: { id: true, name: true } },
        loanInvestors: {
          columns: { amount: true, isPaid: true, investorId: true },
          with: { investor: { columns: { id: true, name: true } } },
        },
        groupLoans: { columns: { groupId: true } },
      },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
    getCachedGroupsForUser(userId, isAdmin),
  ]);

  const groupMeta = new Map(
    groups.map((group) => [
      group.id,
      { id: group.id, name: group.name, color: group.color ?? "orange" },
    ]),
  );

  const stripped = stripDataImageUrls(ownedLoans);

  return {
    ownedLoans: stripped.map((loan) =>
      mapOwnedLoanToWizardRow(loan, groupMeta),
    ),
    usedColorKeys: groups
      .map((group) => group.color)
      .filter((color): color is string => Boolean(color)),
    existingNames: groups.map((group) => group.name),
    contactOptions: buildWizardContactOptions(stripped),
  };
}
