/**
 * Assistant health snapshot for the daily cron. Counts and rates only: no
 * questions, names, amounts, or tool arguments.
 */
import { sql } from "drizzle-orm";
import { db } from "$lib/server/db";

export interface AssistantHealth {
  availability: "ok" | "unavailable";
  windowHours: number;
  messages: number;
  fallback: number;
  fallbackRate: number;
  costUsd: number;
  toolCalls: number;
  toolErrors: number;
  toolErrorRate: number;
  forbidden: number;
}

export interface AssistantAlertThresholds {
  costUsd: number;
  fallbackRate: number;
  toolErrorRate: number;
  forbidden: number;
}

const WINDOW_HOURS = 24;

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getAssistantAlertThresholds(): AssistantAlertThresholds {
  return {
    costUsd: readNumber("AI_ASSISTANT_ALERT_COST_USD", 5),
    fallbackRate: readNumber("AI_ASSISTANT_ALERT_FALLBACK_RATE", 0.15),
    toolErrorRate: readNumber("AI_ASSISTANT_ALERT_TOOL_ERROR_RATE", 0.1),
    forbidden: readNumber("AI_ASSISTANT_ALERT_FORBIDDEN", 20),
  };
}

export async function queryAssistantHealth(): Promise<AssistantHealth> {
  const empty: AssistantHealth = {
    availability: "unavailable",
    windowHours: WINDOW_HOURS,
    messages: 0,
    fallback: 0,
    fallbackRate: 0,
    costUsd: 0,
    toolCalls: 0,
    toolErrors: 0,
    toolErrorRate: 0,
    forbidden: 0,
  };
  try {
    const messageRows = (await db.execute(sql`
      select
        count(*) filter (where role = 'assistant')::int as messages,
        count(*) filter (where role = 'assistant' and guard_mode = 'fallback')::int as fallback,
        coalesce(sum(est_cost_usd) filter (where role = 'assistant'), 0)::float as cost
      from ai_messages
      where created_at > now() - interval '24 hours'
    `)) as unknown as Array<{
      messages: number;
      fallback: number;
      cost: number;
    }>;
    const toolRows = (await db.execute(sql`
      select
        count(*)::int as calls,
        count(*) filter (where not ok)::int as errors,
        count(*) filter (where error_code = 'forbidden')::int as forbidden
      from ai_tool_calls
      where created_at > now() - interval '24 hours'
    `)) as unknown as Array<{
      calls: number;
      errors: number;
      forbidden: number;
    }>;
    const messages = messageRows[0]?.messages ?? 0;
    const fallback = messageRows[0]?.fallback ?? 0;
    const calls = toolRows[0]?.calls ?? 0;
    const errors = toolRows[0]?.errors ?? 0;
    return {
      availability: "ok",
      windowHours: WINDOW_HOURS,
      messages,
      fallback,
      fallbackRate: messages > 0 ? fallback / messages : 0,
      costUsd: messageRows[0]?.cost ?? 0,
      toolCalls: calls,
      toolErrors: errors,
      toolErrorRate: calls > 0 ? errors / calls : 0,
      forbidden: toolRows[0]?.forbidden ?? 0,
    };
  } catch (error) {
    console.warn(
      "[ai.assistant] health query failed",
      (error as Error).message,
    );
    return empty;
  }
}

export function assistantAlerts(
  health: AssistantHealth,
  thresholds: AssistantAlertThresholds = getAssistantAlertThresholds(),
): string[] {
  if (health.availability !== "ok") return [];
  const alerts: string[] = [];
  if (thresholds.costUsd > 0 && health.costUsd > thresholds.costUsd) {
    alerts.push(
      `Estimated cost is $${health.costUsd.toFixed(2)} in the last 24h (limit $${thresholds.costUsd.toFixed(2)}).`,
    );
  }
  if (
    thresholds.fallbackRate > 0 &&
    health.messages > 0 &&
    health.fallbackRate > thresholds.fallbackRate
  ) {
    alerts.push(
      `Fallback rate is ${(health.fallbackRate * 100).toFixed(1)}% (limit ${(thresholds.fallbackRate * 100).toFixed(1)}%).`,
    );
  }
  if (
    thresholds.toolErrorRate > 0 &&
    health.toolCalls > 0 &&
    health.toolErrorRate > thresholds.toolErrorRate
  ) {
    alerts.push(
      `Tool error rate is ${(health.toolErrorRate * 100).toFixed(1)}% (limit ${(thresholds.toolErrorRate * 100).toFixed(1)}%).`,
    );
  }
  if (thresholds.forbidden > 0 && health.forbidden > thresholds.forbidden) {
    alerts.push(
      `${health.forbidden} forbidden tool calls in the last 24h (limit ${thresholds.forbidden}). Possible probing.`,
    );
  }
  return alerts;
}
