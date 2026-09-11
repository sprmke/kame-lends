import type { PageServerLoad } from "./$types";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { witnesses } from "$lib/server/db/schema";
import { getCachedLoansByScope } from "$lib/server/cached-data";
import { requireUserSession } from "$lib/server/request-auth";
import {
  computeWitnessProfitStats,
  type WitnessLoanAllocation,
} from "$lib/loan-list-summary";
import type { LoanWithInvestors } from "$lib/types";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  event.depends("app:loans");
  const loans = getCachedLoansByScope(session.user.id, "witnessed", "list");

  const profitStats = loans.then(async (value) => {
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

  return {
    loans,
    profitStats,
    listScope: "witnessed" as const,
    pageTitle: "Witnessed",
    emptyMessage: "No witnessed loans yet",
    canCreate: false,
    canManage: false,
  };
};
