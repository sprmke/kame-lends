import type { PageServerLoad } from "./$types";
import { ensureLoanListDateRange } from "$lib/loan-list-date-range-server";
import { getCachedLoansByScope } from "$lib/server/cached-data";
import { requireUserSession } from "$lib/server/request-auth";

export const load: PageServerLoad = async (event) => {
  ensureLoanListDateRange(event.url);
  const session = requireUserSession(event);
  event.depends("app:loans");
  return {
    loans: getCachedLoansByScope(session.user.id, "investments", "list"),
    listScope: "investments" as const,
    pageTitle: "Investments",
    emptyMessage: "No investments yet",
    canCreate: false,
    canManage: false,
  };
};
