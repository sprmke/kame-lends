import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loans, interestPeriods } from "$lib/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

/**
 * Checks owned loans and marks overdue interest periods / loan statuses.
 * Called from the dashboard (deferred) — updates rows in place; never deletes data.
 */
export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const periodIdsToMarkOverdue: number[] = [];
    const loanIdsToMarkOverdue: number[] = [];
    const loanIdsToMarkFullyFunded: number[] = [];

    const userLoans = await db.query.loans.findMany({
      where: eq(loans.userId, session.user.id),
      columns: {
        id: true,
        status: true,
        dueDate: true,
      },
      with: {
        loanInvestors: {
          columns: { hasMultipleInterest: true },
          with: {
            interestPeriods: {
              columns: { id: true, dueDate: true, status: true },
            },
          },
        },
      },
    });

    for (const loan of userLoans) {
      let hasOverduePeriod = false;
      let hasIncompletePeriod = false;
      let hasAnyPendingPeriod = false;

      for (const loanInvestor of loan.loanInvestors) {
        if (!loanInvestor.hasMultipleInterest) continue;

        for (const period of loanInvestor.interestPeriods) {
          const periodDueDate = new Date(period.dueDate);

          if (period.status === "Pending" && now > periodDueDate) {
            periodIdsToMarkOverdue.push(period.id);
            hasOverduePeriod = true;
          } else if (period.status === "Overdue") {
            hasOverduePeriod = true;
          } else if (period.status === "Incomplete") {
            hasIncompletePeriod = true;
          } else if (period.status === "Pending") {
            hasAnyPendingPeriod = true;
          }
        }
      }

      const loanDueDate = new Date(loan.dueDate);

      if (
        (hasOverduePeriod || hasIncompletePeriod) &&
        loan.status !== "Overdue" &&
        loan.status !== "Completed"
      ) {
        loanIdsToMarkOverdue.push(loan.id);
      } else if (
        loan.status === "Fully Funded" &&
        now > loanDueDate &&
        !hasAnyPendingPeriod
      ) {
        loanIdsToMarkOverdue.push(loan.id);
      } else if (
        loan.status === "Overdue" &&
        !hasOverduePeriod &&
        !hasIncompletePeriod &&
        !hasAnyPendingPeriod &&
        now <= loanDueDate
      ) {
        loanIdsToMarkFullyFunded.push(loan.id);
      }
    }

    let updatedPeriodsCount = 0;
    let updatedLoansCount = 0;

    if (periodIdsToMarkOverdue.length > 0) {
      await db
        .update(interestPeriods)
        .set({ status: "Overdue", updatedAt: now })
        .where(inArray(interestPeriods.id, periodIdsToMarkOverdue));
      updatedPeriodsCount = periodIdsToMarkOverdue.length;
    }

    if (loanIdsToMarkOverdue.length > 0) {
      await db
        .update(loans)
        .set({ status: "Overdue", updatedAt: now })
        .where(inArray(loans.id, loanIdsToMarkOverdue));
      updatedLoansCount += loanIdsToMarkOverdue.length;
    }

    if (loanIdsToMarkFullyFunded.length > 0) {
      await db
        .update(loans)
        .set({ status: "Fully Funded", updatedAt: now })
        .where(inArray(loans.id, loanIdsToMarkFullyFunded));
      updatedLoansCount += loanIdsToMarkFullyFunded.length;
    }

    if (updatedLoansCount > 0 || updatedPeriodsCount > 0) {
      invalidateLoanData();
    }

    return json({
      success: true,
      updatedLoans: updatedLoansCount,
      updatedPeriods: updatedPeriodsCount,
      message: `Updated ${updatedLoansCount} loan(s) and ${updatedPeriodsCount} period(s)`,
    });
  } catch (error) {
    console.error("Error checking overdue statuses:", error);
    return json(
      {
        error: "Failed to check overdue statuses",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};
