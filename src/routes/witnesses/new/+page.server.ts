import type { PageServerLoad } from "./$types";
import { requireWorkspaceAdminPage } from "$lib/server/workspace-admin";

export const load: PageServerLoad = async (event) => {
  await requireWorkspaceAdminPage(event, "/witnesses");
  return {};
};
