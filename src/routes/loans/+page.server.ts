import type { PageServerLoad } from "./$types";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { witnesses } from "$lib/server/db/schema";
import { ensureLoanListDateRange } from "$lib/loan-list-date-range-server";
import { getCachedLoansByScope } from "$lib/server/cached-data";
import { requireWorkspaceAdminPage } from "$lib/server/workspace-admin";
import { resolveLoanScopeTab } from "$lib/loans/loan-list-scope-nav";
import { LOAN_LIST_PAGE_VARIANTS } from "$lib/components/loans/loan-list-page-config";
import {
  computeBorrowerProfitStats,
  computeWitnessProfitStats,
  type WitnessLoanAllocation,
} from "$lib/loan-list-summary";
import type { LoanWithInvestors } from "$lib/types";

export const load: PageServerLoad = async (event) => {
  ensureLoanListDateRange(event.url);
  const session = await requireWorkspaceAdminPage(event, "/dashboard");
  event.depends("app:loans");

  const tab = resolveLoanScopeTab(event.url.searchParams.get("scope"));
  const variant = LOAN_LIST_PAGE_VARIANTS[tab.pageScope];
  const isMine = tab.param === "mine";

  const loans = getCachedLoansByScope(session.user.id, tab.listScope, "list");

  let profitStats:
    | ReturnType<typeof computeBorrowerProfitStats>
    | ReturnType<typeof computeWitnessProfitStats>
    | Promise<ReturnType<typeof computeBorrowerProfitStats>>
    | Promise<ReturnType<typeof computeWitnessProfitStats>>
    | undefined;

  if (tab.listScope === "borrowed") {
    profitStats = loans.then((value) =>
      computeBorrowerProfitStats(value as LoanWithInvestors[]),
    );
  } else if (tab.listScope === "witnessed") {
    profitStats = loans.then(async (value) => {
      const myWitnessRecords = await db.query.witnesses.findMany({
        where: eq(witnesses.witnessUserId, session.user.id),
        columns: { id: true },
      });
      const myWitnessIds = new Set(myWitnessRecords.map((w) => w.id));
      const allocations: WitnessLoanAllocation[] = (
        value as LoanWithInvestors[]
      ).flatMap((loan) =>
        (loan.loanWitnesses ?? [])
          .filter((lw) => myWitnessIds.has(lw.witnessId))
          .map((lw) => ({ ...lw, loan })),
      );
      return computeWitnessProfitStats(allocations);
    });
  }

  return {
    loans,
    profitStats,
    listScope: tab.listScope,
    pageScope: tab.pageScope,
    loanScopeParam: tab.param,
    pageTitle: "Loans",
    emptyMessage: variant.defaultEmptyMessage,
    canCreate: isMine,
    canManage: isMine,
    showScopeTabs: true,
  };
};
