import { error } from "@sveltejs/kit";
import { SHOW_TRANSACTIONS_UI } from "$lib/feature-flags";
import type { PageServerLoad } from "./$types";
import { requireWorkspaceAdminPage } from "$lib/server/workspace-admin";

export const load: PageServerLoad = async (event) => {
  if (!SHOW_TRANSACTIONS_UI) throw error(404, "Not found");
  await requireWorkspaceAdminPage(event, "/transactions");
  return {};
};
