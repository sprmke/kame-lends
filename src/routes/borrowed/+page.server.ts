import type { PageServerLoad } from "./$types";
import { getCachedLoansByScope } from "$lib/server/cached-data";
import { requireUserSession } from "$lib/server/request-auth";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  event.depends("app:loans");
  return {
    loans: getCachedLoansByScope(session.user.id, "borrowed", "list"),
    listScope: "borrowed" as const,
    pageTitle: "Borrowed",
    emptyMessage: "No borrowed loans yet",
    canCreate: false,
    canManage: false,
  };
};
