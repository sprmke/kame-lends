import type { PageServerLoad } from "./$types";
import { eq } from "drizzle-orm";
import { requireUserSession } from "$lib/server/request-auth";
import { getNavCapabilities } from "$lib/server/access-control";
import { loadPartyActivityRoles } from "$lib/server/account-roles";
import { listPaymentMethodsForUser } from "$lib/server/payment-methods";
import {
  hasPartyUserCrmLinks,
  loadPartyUserIdentityDocuments,
} from "$lib/server/party-profile";
import { accountRolesFromCapabilities } from "$lib/account-roles";
import { isWorkspaceOwnerEmail } from "$lib/server/workspace-owner";
import { getUserPushPreferences } from "$lib/server/push/preferences";
import { db } from "$lib/server/db";
import { borrowers, investors, loanGroups } from "$lib/server/db/schema";
import { listLoanTemplatesForUser } from "$lib/server/loan-templates";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const userId = session.user.id;
  const [
    navCapabilities,
    partyActivity,
    paymentMethods,
    hasPartyLinks,
    pushPreferences,
    loanTemplates,
    borrowerRows,
    investorRows,
    groupRows,
  ] = await Promise.all([
    getNavCapabilities(userId),
    loadPartyActivityRoles(userId, session.user.email),
    listPaymentMethodsForUser(userId),
    hasPartyUserCrmLinks(userId),
    getUserPushPreferences(userId),
    listLoanTemplatesForUser(userId),
    db.query.borrowers.findMany({
      where: eq(borrowers.userId, userId),
      columns: { id: true, name: true },
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
    db.query.investors.findMany({
      where: eq(investors.userId, userId),
      columns: { id: true, name: true },
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
    db.query.loanGroups.findMany({
      where: eq(loanGroups.creatorUserId, userId),
      columns: { id: true, name: true, color: true },
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
  ]);
  const identityDocuments = hasPartyLinks
    ? await loadPartyUserIdentityDocuments(userId)
    : { validIdUrl: null, eSignatureUrl: null };
  return {
    user: session.user,
    accountRoles: accountRolesFromCapabilities(
      {
        isAdminWorkspace: navCapabilities.isAdminWorkspace,
        hasInvestments: partyActivity.hasInvestments,
        hasBorrowed: partyActivity.hasBorrowed,
        hasWitnessed: partyActivity.hasWitnessed,
      },
      session.user.role,
    ),
    isAdminWorkspace: navCapabilities.isAdminWorkspace,
    isPlatformOwner: isWorkspaceOwnerEmail(session.user.email),
    paymentMethods,
    hasPartyLinks,
    identityDocuments,
    pushPreferences,
    loanTemplates,
    templateBorrowers: borrowerRows,
    templateInvestors: investorRows,
    templateGroups: groupRows,
  };
};
