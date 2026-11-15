import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { syncLoanStatuses } from "$lib/server/loan-interest-period-sync";
import { publicJsonError } from "$lib/server/http-error";

/**
 * Safety net for the dashboard: recompute overdue periods and loan statuses
 * for the signed-in owner using the single status rule. The daily cron
 * (`/api/cron/loan-status`) is the primary writer; this keeps the screen honest
 * if a cron run was missed.
 */
export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncLoanStatuses({ userId });
    if (result.updatedLoans > 0 || result.updatedPeriods > 0) {
      invalidateLoanData();
    }

    return json({
      success: true,
      updatedLoans: result.updatedLoans,
      updatedPeriods: result.updatedPeriods,
      message: `Updated ${result.updatedLoans} loan(s) and ${result.updatedPeriods} period(s)`,
    });
  } catch (error) {
    console.error("Error checking overdue statuses:", error);
    return json(publicJsonError("Failed to check overdue statuses", error), {
      status: 500,
    });
  }
};
