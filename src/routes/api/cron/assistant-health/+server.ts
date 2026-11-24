import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isCronAuthorized } from "$lib/server/cron-auth";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "$lib/server/email/send-email";
import { WORKSPACE_OWNER_EMAIL } from "$lib/server/workspace-owner";
import {
  assistantAlerts,
  getAssistantAlertThresholds,
  queryAssistantHealth,
} from "$lib/server/assistant/health";

/**
 * Daily assistant health check. Counts and rates only. Emails the workspace
 * owner when cost, fallback rate, tool errors, or forbidden probes cross a
 * threshold. Missing tables skip instead of failing the cron.
 */
export const GET: RequestHandler = async ({ request }) => {
  if (!isCronAuthorized(request)) {
    console.warn(
      JSON.stringify({
        level: "warn",
        kind: "cron_unauthorized",
        path: "/api/cron/assistant-health",
      }),
    );
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await queryAssistantHealth();
  if (health.availability !== "ok") {
    return json({
      success: true,
      skipped: true,
      reason: "assistant tables unavailable",
    });
  }

  const thresholds = getAssistantAlertThresholds();
  const alerts = assistantAlerts(health, thresholds);
  let emailed = false;
  if (alerts.length > 0 && isTransactionalEmailConfigured()) {
    try {
      await sendTransactionalEmail({
        to: WORKSPACE_OWNER_EMAIL,
        subject: `Assistant health: ${alerts.length} alert${alerts.length === 1 ? "" : "s"}`,
        html: [
          `<p>Ask Kame in the last ${health.windowHours} hours:</p>`,
          `<ul>${alerts.map((alert) => `<li>${alert}</li>`).join("")}</ul>`,
          `<p>Messages: ${health.messages}. Tool calls: ${health.toolCalls}. Tool errors: ${health.toolErrors}. Forbidden: ${health.forbidden}.</p>`,
          `<p>Runbook: docs/architecture/ai-assistant.md.</p>`,
        ].join(""),
      });
      emailed = true;
    } catch (error) {
      console.warn(
        "[ai.assistant] health email failed",
        (error as Error).message,
      );
    }
  }

  console.info(
    JSON.stringify({
      level: alerts.length > 0 ? "warn" : "info",
      kind: "ai.assistant_health",
      messages: health.messages,
      fallbackRate: Number(health.fallbackRate.toFixed(3)),
      costUsd: Number(health.costUsd.toFixed(4)),
      toolCalls: health.toolCalls,
      toolErrorRate: Number(health.toolErrorRate.toFixed(3)),
      forbidden: health.forbidden,
      alerts: alerts.length,
      emailed,
    }),
  );

  return json({ success: true, health, thresholds, alerts, emailed });
};
