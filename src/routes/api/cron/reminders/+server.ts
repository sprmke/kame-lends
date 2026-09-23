import { json, type RequestHandler } from "@sveltejs/kit";
import { isCronAuthorized } from "$lib/server/cron-auth";
import { runUserPushDailyReminders } from "$lib/server/push/user-reminders";

export const config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ request }) => {
  if (!isCronAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runUserPushDailyReminders();
  return json({ ok: true, ...result });
};
