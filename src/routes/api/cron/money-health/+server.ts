import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isCronAuthorized } from "$lib/server/cron-auth";
import { publicJsonError } from "$lib/server/http-error";
import { runMoneyHealthChecks } from "$lib/server/money-health";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "$lib/server/email/send-email";
import { WORKSPACE_OWNER_EMAIL } from "$lib/server/workspace-owner";

/**
 * Weekly money health summary (T8.5). Counts only, no names or amounts.
 * Runs Monday 07:00 Asia/Manila (`0 23 * * 0` UTC in vercel.json).
 */
export const GET: RequestHandler = async ({ request }) => {
  if (!isCronAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const checks = await runMoneyHealthChecks();
    const total = checks.reduce((sum, check) => sum + check.count, 0);

    if (isTransactionalEmailConfigured()) {
      const rows = checks
        .map(
          (check) =>
            `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${check.title}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${check.count}</td></tr>`,
        )
        .join("");
      await sendTransactionalEmail({
        to: WORKSPACE_OWNER_EMAIL,
        subject: `Money health: ${total} anomal${total === 1 ? "y" : "ies"}`,
        html: `<h2>Weekly money health</h2><p>${total} item(s) need review. Counts only; open Settings → Data health for detail.</p><table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows}</table>`,
      });
    }

    return json({
      success: true,
      total,
      checks: checks.map((c) => ({ id: c.id, count: c.count })),
    });
  } catch (error) {
    console.error("[cron] money health summary failed", error);
    return json(publicJsonError("Money health summary failed", error), {
      status: 500,
    });
  }
};
