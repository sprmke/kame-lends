import type { PageServerLoad } from "./$types";
import { getCachedInvestors } from "$lib/server/cached-data";
import { requireWorkspaceAdminPage } from "$lib/server/workspace-admin";

export const load: PageServerLoad = async (event) => {
  const session = await requireWorkspaceAdminPage(event, "/dashboard");
  event.depends("app:investors");
  const { navCapabilities } = await event.parent();
  return {
    items: getCachedInvestors(session.user.id, "list"),
    canCreate: navCapabilities.isAdminWorkspace,
    canManage: navCapabilities.isAdminWorkspace,
  };
};
