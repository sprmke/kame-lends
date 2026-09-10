import { json, redirect } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getNavCapabilities } from "$lib/server/access-control";
import { requireUserSession } from "$lib/server/request-auth";

export async function isWorkspaceAdmin(userId: string): Promise<boolean> {
  const caps = await getNavCapabilities(userId);
  return caps.isAdminWorkspace;
}

/** Redirect non-admins away from create/edit pages. */
export async function requireWorkspaceAdminPage(
  event: RequestEvent,
  fallbackHref: string,
) {
  const session = requireUserSession(event);
  if (!(await isWorkspaceAdmin(session.user.id))) {
    throw redirect(303, fallbackHref);
  }
  return session;
}

export async function workspaceAdminForbidden(userId: string) {
  if (await isWorkspaceAdmin(userId)) return null;
  return json({ error: "Forbidden" }, { status: 403 });
}
