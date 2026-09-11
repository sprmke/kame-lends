import type { PageServerLoad } from "./$types";
import { getCachedLoansByScope } from "$lib/server/cached-data";
import { requireUserSession } from "$lib/server/request-auth";
import { computeBorrowerProfitStats } from "$lib/loan-list-summary";
import type { LoanWithInvestors } from "$lib/types";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  event.depends("app:loans");
  const loans = getCachedLoansByScope(session.user.id, "borrowed", "list");
  return {
    loans,
    profitStats: loans.then((value) =>
      computeBorrowerProfitStats(value as LoanWithInvestors[]),
    ),
    listScope: "borrowed" as const,
    pageTitle: "Borrowed",
    emptyMessage: "No borrowed loans yet",
    canCreate: false,
    canManage: false,
  };
};
