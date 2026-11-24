import { json, type RequestHandler } from "@sveltejs/kit";
import { isCronAuthorized } from "$lib/server/cron-auth";
import { pruneEmailNotificationLog } from "$lib/server/email/log";
import { runUserPushDailyReminders } from "$lib/server/push/user-reminders";

export const config = { maxDuration: 60 };

/**
 * Daily at 01:00 UTC (09:00 Manila).
 *
 * Runs push reminders first, then email digests. Each channel is isolated so a
 * failure in one does not block the other. `?dryRun=1` plans email digests
 * without sending; `?today=YYYY-MM-DD` overrides the business date for QA.
 */
export const GET: RequestHandler = async ({ request, url }) => {
  if (!isCronAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = url.searchParams.get("dryRun") === "1";
  const todayKey = url.searchParams.get("today")?.trim() || undefined;

  let push: unknown;
  try {
    push = await runUserPushDailyReminders(todayKey);
  } catch (err) {
    console.error("[cron/reminders] push reminders failed", err);
    push = { error: "push reminders failed" };
  }

  let email: unknown;
  try {
    const { runEmailReminderDigests } =
      await import("$lib/server/email/reminders");
    email = await runEmailReminderDigests({ todayKey, dryRun });
  } catch (err) {
    console.error("[cron/reminders] email reminders failed", err);
    email = { error: "email reminders failed" };
  }

  let prunedEmails = 0;
  if (!dryRun) {
    try {
      prunedEmails = await pruneEmailNotificationLog(180);
    } catch (err) {
      console.error("[cron/reminders] email log prune failed", err);
    }
  }

  return json({ ok: true, dryRun, push, email, prunedEmails });
};
