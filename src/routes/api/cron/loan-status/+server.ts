import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isCronAuthorized } from "$lib/server/cron-auth";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { logEgress } from "$lib/server/egress-log";
import { syncLoanStatuses } from "$lib/server/loan-interest-period-sync";
import { publicJsonError } from "$lib/server/http-error";
import { purgeExpiredIdempotencyKeys } from "$lib/server/idempotency";

/**
 * Daily status sweep (00:10 Asia/Manila → `10 16 * * *` UTC in vercel.json).
 * Marks overdue periods and loans from the single status rule with batched
 * updates. No user request is needed, so lists, portals, reminders, Telegram,
 * push, and calendar never read a days-old status.
 */
export const GET: RequestHandler = async ({ request }) => {
  const started = performance.now();
  if (!isCronAuthorized(request)) {
    console.warn(
      JSON.stringify({
        level: "warn",
        kind: "cron_unauthorized",
        path: "/api/cron/loan-status",
      }),
    );
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await purgeExpiredIdempotencyKeys();
    const result = await syncLoanStatuses();
    if (result.updatedLoans > 0 || result.updatedPeriods > 0) {
      invalidateLoanData();
    }
    logEgress({
      kind: "cron_egress",
      path: "/api/cron/loan-status",
      ms: Math.round(performance.now() - started),
      status: 200,
      rows: result.loans,
      extra: {
        updatedLoans: result.updatedLoans,
        updatedPeriods: result.updatedPeriods,
      },
    });
    return json({
      success: true,
      loans: result.loans,
      updatedLoans: result.updatedLoans,
      updatedPeriods: result.updatedPeriods,
    });
  } catch (error) {
    console.error("[cron] loan status sweep failed", error);
    return json(publicJsonError("Loan status sweep failed", error), {
      status: 500,
    });
  }
};
