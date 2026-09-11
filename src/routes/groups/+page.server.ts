import type { PageServerLoad } from "./$types";
import { getCachedGroupsForUser } from "$lib/server/cached-data";
import { requireUserSession } from "$lib/server/request-auth";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  event.depends("app:groups");

  const isAdmin = await isWorkspaceAdmin(session.user.id);
  return {
    items: getCachedGroupsForUser(session.user.id, isAdmin),
    currentUserId: session.user.id,
  };
};
