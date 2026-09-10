import type { PageServerLoad } from "./$types";
import { requireUserSession } from "$lib/server/request-auth";
import { getNavCapabilities } from "$lib/server/access-control";
import { listPaymentMethodsForUser } from "$lib/server/payment-methods";
import {
  hasPartyUserCrmLinks,
  loadPartyUserIdentityDocuments,
} from "$lib/server/party-profile";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const navCapabilities = await getNavCapabilities(session.user.id);
  const paymentMethods = await listPaymentMethodsForUser(session.user.id);
  const hasPartyLinks = await hasPartyUserCrmLinks(session.user.id);
  const identityDocuments = hasPartyLinks
    ? await loadPartyUserIdentityDocuments(session.user.id)
    : { validIdUrl: null, eSignatureUrl: null };
  return {
    user: session.user,
    isAdminWorkspace: navCapabilities.isAdminWorkspace,
    paymentMethods,
    hasPartyLinks,
    identityDocuments,
  };
};
