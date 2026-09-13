import { json, redirect, type RequestEvent } from "@sveltejs/kit";
import { getNavCapabilities } from "$lib/server/access-control";
import { requireUserSession } from "$lib/server/request-auth";

type PageLoadEvent = RequestEvent & {
  parent: () => Promise<{ navCapabilities?: { isAdminWorkspace: boolean } }>;
};

export async function isWorkspaceAdmin(userId: string): Promise<boolean> {
  const caps = await getNavCapabilities(userId);
  return caps.isAdminWorkspace;
}

/** Redirect non-admins away from create/edit pages. */
export async function requireWorkspaceAdminPage(
  event: PageLoadEvent,
  fallbackHref: string,
) {
  const session = requireUserSession(event);
  const parent = await event.parent();
  const fromLayout = parent.navCapabilities?.isAdminWorkspace;
  if (fromLayout === false) {
    throw redirect(303, fallbackHref);
  }
  if (fromLayout === true) return session;
  if (!(await isWorkspaceAdmin(session.user.id))) {
    throw redirect(303, fallbackHref);
  }
  return session;
}

export async function workspaceAdminForbidden(userId: string) {
  if (await isWorkspaceAdmin(userId)) return null;
  return json({ error: "Forbidden" }, { status: 403 });
}
