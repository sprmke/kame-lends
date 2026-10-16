import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isCronAuthorized } from "$lib/server/cron-auth";

export const config = { maxDuration: 60 };

/** Daily at 00:00 UTC (08:00 Manila). Each group still sends only on its own interval. */
export const GET: RequestHandler = async ({ request }) => {
  if (!isCronAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runGroupTelegramSigningReminders } =
      await import("$lib/server/telegram/group-notifications");
    const telegram = await runGroupTelegramSigningReminders();
    return json({ ok: true, telegram });
  } catch (err) {
    console.error("[cron/signing-reminders] failed", err);
    return json({ error: "Signing reminders failed" }, { status: 500 });
  }
};
