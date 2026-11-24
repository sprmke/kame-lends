import { error } from "@sveltejs/kit";
import { SHOW_TRANSACTIONS_UI } from "$lib/feature-flags";
import type { PageServerLoad } from "./$types";
import { getCachedTransactions } from "$lib/server/cached-data";
import { requireWorkspaceAdminPage } from "$lib/server/workspace-admin";

export const load: PageServerLoad = async (event) => {
  if (!SHOW_TRANSACTIONS_UI) throw error(404, "Not found");
  const session = await requireWorkspaceAdminPage(event, "/dashboard");
  event.depends("app:transactions");
  const { navCapabilities } = await event.parent();
  return {
    items: getCachedTransactions(session.user.id, null),
    canCreate: true,
    canManage: true,
  };
};
