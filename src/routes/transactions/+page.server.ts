import type { PageServerLoad } from "./$types";
import { getCachedTransactions } from "$lib/server/cached-data";
import { requireWorkspaceAdminPage } from "$lib/server/workspace-admin";

export const load: PageServerLoad = async (event) => {
  const session = await requireWorkspaceAdminPage(event, "/dashboard");
  event.depends("app:transactions");
  const { navCapabilities } = await event.parent();
  return {
    items: getCachedTransactions(session.user.id, null),
    canCreate: navCapabilities.isAdminWorkspace,
    canManage: navCapabilities.isAdminWorkspace,
  };
};
