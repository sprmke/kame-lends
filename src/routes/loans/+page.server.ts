import type { PageServerLoad } from "./$types";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { investors, witnesses } from "$lib/server/db/schema";
import { ensureLoanListDateRange } from "$lib/loan-list-date-range-server";
import { getCachedLoansByScope } from "$lib/server/cached-data";
import { requireWorkspaceAdminPage } from "$lib/server/workspace-admin";
import { resolveLoanScopeTab } from "$lib/loans/loan-list-scope-nav";
import { resolveLoanListPageVariant } from "$lib/components/loans/loan-list-page-config";

export const load: PageServerLoad = async (event) => {
  ensureLoanListDateRange(event.url);
  const session = await requireWorkspaceAdminPage(event, "/dashboard");
  event.depends("app:loans");

  const tab = resolveLoanScopeTab(event.url.searchParams.get("scope"));
  const variant = resolveLoanListPageVariant(tab.pageScope);
  const isMine = tab.param === "mine";

  const loans = getCachedLoansByScope(session.user.id, tab.listScope, "list");

  const [myInvestorRecords, myWitnessRecords] = await Promise.all([
    db.query.investors.findMany({
      where: eq(investors.investorUserId, session.user.id),
      columns: { id: true },
    }),
    db.query.witnesses.findMany({
      where: eq(witnesses.witnessUserId, session.user.id),
      columns: { id: true },
    }),
  ]);

  return {
    loans,
    userId: session.user.id,
    myInvestorIds: myInvestorRecords.map((row) => row.id),
    myWitnessIds: myWitnessRecords.map((row) => row.id),
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
