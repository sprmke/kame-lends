import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isCronAuthorized } from "$lib/server/cron-auth";
import { logEgress } from "$lib/server/egress-log";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "$lib/server/email/send-email";
import { publicJsonError } from "$lib/server/http-error";
import { fetchNeonTransferSnapshot, formatBytes } from "$lib/server/neon-usage";
import { WORKSPACE_OWNER_EMAIL } from "$lib/server/workspace-owner";

/**
 * Weekly Neon transfer check (Monday 07:00 UTC).
 * Emails the workspace owner when billing-period transfer exceeds the alert
 * threshold (default 10 GB). Does not wake the database compute.
 */
export const GET: RequestHandler = async ({ request }) => {
  const started = performance.now();
  if (!isCronAuthorized(request)) {
    console.warn(
      JSON.stringify({
        level: "warn",
        kind: "cron_unauthorized",
        path: "/api/cron/neon-usage",
      }),
    );
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await fetchNeonTransferSnapshot();
    if (!snapshot) {
      return json({
        success: true,
        skipped: true,
        reason: "NEON_API_KEY or NEON_PROJECT_ID not configured",
      });
    }

    let emailed = false;
    if (snapshot.overAlert && isTransactionalEmailConfigured()) {
      await sendTransactionalEmail({
        to: WORKSPACE_OWNER_EMAIL,
        subject: `Neon transfer alert: ${formatBytes(snapshot.dataTransferBytes)}`,
        html: `<p>Public network transfer this billing period is <strong>${formatBytes(snapshot.dataTransferBytes)}</strong> (alert at ${formatBytes(snapshot.alertBytes)}).</p><p>Project <code>${snapshot.projectId}</code>. Check Vercel logs for cron_egress /api/cron/backup and avoid prod dumps without --confirm-prod.</p>`,
      });
      emailed = true;
    }

    logEgress({
      kind: "cron_egress",
      path: "/api/cron/neon-usage",
      ms: Math.round(performance.now() - started),
      status: 200,
      approxBytes: snapshot.dataTransferBytes,
      extra: {
        overAlert: snapshot.overAlert,
        emailed,
        alertBytes: snapshot.alertBytes,
      },
    });

    return json({
      success: true,
      projectId: snapshot.projectId,
      dataTransferBytes: snapshot.dataTransferBytes,
      dataTransferLabel: formatBytes(snapshot.dataTransferBytes),
      alertBytes: snapshot.alertBytes,
      overAlert: snapshot.overAlert,
      emailed,
    });
  } catch (error) {
    console.error("[cron] neon usage check failed", error);
    return json(publicJsonError("Neon usage check failed", error), {
      status: 500,
    });
  }
};
