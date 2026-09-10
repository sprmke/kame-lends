import type { PageServerLoad } from "./$types";
import { requireUserSession } from "$lib/server/request-auth";
import { getNavCapabilities } from "$lib/server/access-control";
import { loadPartyActivityRoles } from "$lib/server/account-roles";
import { listPaymentMethodsForUser } from "$lib/server/payment-methods";
import {
  hasPartyUserCrmLinks,
  loadPartyUserIdentityDocuments,
} from "$lib/server/party-profile";
import { accountRolesFromCapabilities } from "$lib/account-roles";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const userId = session.user.id;
  const [navCapabilities, partyActivity, paymentMethods, hasPartyLinks] =
    await Promise.all([
      getNavCapabilities(userId),
      loadPartyActivityRoles(userId, session.user.email),
      listPaymentMethodsForUser(userId),
      hasPartyUserCrmLinks(userId),
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
    paymentMethods,
    hasPartyLinks,
    identityDocuments,
  };
};
