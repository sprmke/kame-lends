import { json, type RequestEvent } from "@sveltejs/kit";
import { getNavCapabilities } from "$lib/server/access-control";
import { requireUserSession } from "$lib/server/request-auth";

/** True when the user owns loan/CRM/debt rows (Settings maintenance, Owner role). */
export async function isWorkspaceAdmin(userId: string): Promise<boolean> {
  const caps = await getNavCapabilities(userId);
  return caps.isAdminWorkspace;
}

/** Requires a signed-in session (legacy name: formerly gated CRM pages). */
export async function requireWorkspaceAdminPage(
  event: RequestEvent,
  _fallbackHref?: string,
) {
  void _fallbackHref;
  return requireUserSession(event);
}

/** @deprecated All signed-in users may create owned records. */
export async function workspaceAdminForbidden(_userId: string) {
  return null as ReturnType<typeof json> | null;
}
