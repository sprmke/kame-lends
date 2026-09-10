import type { PageServerLoad } from "./$types";
import { ensureLoanListDateRange } from "$lib/loan-list-date-range-server";
import { getCachedLoansByScope } from "$lib/server/cached-data";
import { requireWorkspaceAdminPage } from "$lib/server/workspace-admin";

export const load: PageServerLoad = async (event) => {
  ensureLoanListDateRange(event.url);
  const session = await requireWorkspaceAdminPage(event, "/dashboard");
  event.depends("app:loans");
  const { navCapabilities } = await event.parent();
  return {
    loans: getCachedLoansByScope(session.user.id, "owned", "list"),
    listScope: "owned" as const,
    pageTitle: "Loans",
    emptyMessage: "No loans yet",
    canCreate: navCapabilities.isAdminWorkspace,
    canManage: navCapabilities.isAdminWorkspace,
  };
};
