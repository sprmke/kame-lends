import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { assertLoanAdmin } from "$lib/server/route-auth";
import { parseIdParam } from "$lib/server/route-params";
import { recordMoneyAudit } from "$lib/server/money-audit";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { syncLoanStatusFromInterestPeriods } from "$lib/server/loan-interest-period-sync";

/** Restore a soft-deleted loan (D-8). */
export const POST: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = parseIdParam(params.id);
    if (loanId === null) {
      return json({ error: "Invalid loan id" }, { status: 400 });
    }

    const authError = await assertLoanAdmin(loanId, userId);
    if (authError) return authError;

    const loan = await db.query.loans.findFirst({
      where: and(eq(loans.id, loanId), isNotNull(loans.deletedAt)),
      columns: { id: true, loanName: true, deletedAt: true },
    });
    if (!loan) {
      return json({ error: "Loan is not deleted" }, { status: 404 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(loans)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(loans.id, loanId));
      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "loan",
        entityId: loanId,
        loanId,
        action: "restore",
        before: { deletedAt: loan.deletedAt },
        after: { deletedAt: null },
      });
    });

    await syncLoanStatusFromInterestPeriods(loanId);
    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error restoring loan:", error);
    return json({ error: "Failed to restore loan" }, { status: 500 });
  }
};
