import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { runUserPushDailyReminders } from "$lib/server/push/user-reminders";

export const config = { maxDuration: 60 };

function authorize(request: Request): boolean {
  const secret = env.CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export const GET: RequestHandler = async ({ request }) => {
  if (!authorize(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runUserPushDailyReminders();
  return json({ ok: true, ...result });
};
