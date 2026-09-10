import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { loadSigningInvitationByToken } from "$lib/server/loan-signing-server";
import { requireUserSession } from "$lib/server/request-auth";

export const load: PageServerLoad = async (event) => {
  const invitation = await loadSigningInvitationByToken(event.params.token);
  if (!invitation?.loan) throw error(404, "Signing link not found");

  // Require login, then send the party to the authenticated signing page.
  requireUserSession(event);
  throw redirect(303, `/loans/${invitation.loan.id}/sign`);
};
