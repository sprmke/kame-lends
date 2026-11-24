import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { sql } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { isWorkspaceOwnerEmail } from "$lib/server/workspace-owner";
import { db } from "$lib/server/db";

interface UsageRow extends Record<string, unknown> {
  turns: number;
  assistant_messages: number;
  users: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  avg_ms: number;
  ok_count: number;
  guard_ok: number;
  guard_regenerated: number;
  guard_fallback: number;
  thumbs_up: number;
  thumbs_down: number;
  tool_calls: number;
  tool_errors: number;
}

/**
 * Owner-only assistant usage card. Counts and rates only: no questions, names,
 * or amounts. Missing assistant tables return an empty shape.
 */
export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !isWorkspaceOwnerEmail(session.user.email) &&
    (session.user as { role?: string | null }).role !== "admin"
  ) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = (await db.execute(sql`
      select
        (select count(*)::int from ai_messages where role = 'user' and created_at > now() - interval '7 days') as turns,
        (select count(*)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days') as assistant_messages,
        (select count(distinct user_id)::int from ai_messages where role = 'user' and created_at > now() - interval '7 days') as users,
        coalesce((select sum(tokens_in)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days'), 0) as input_tokens,
        coalesce((select sum(tokens_out)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days'), 0) as output_tokens,
        coalesce((select sum(est_cost_usd)::float from ai_messages where role = 'assistant' and created_at > now() - interval '7 days'), 0) as cost_usd,
        coalesce((select avg((latency_breakdown->>'total')::float) from ai_messages where role = 'assistant' and created_at > now() - interval '7 days' and latency_breakdown ? 'total'), 0) as avg_ms,
        (select count(*)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days' and guard_mode = 'ok') as guard_ok,
        (select count(*)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days' and guard_mode = 'regenerated') as guard_regenerated,
        (select count(*)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days' and guard_mode = 'fallback') as guard_fallback,
        (select count(*)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days' and feedback = 1) as thumbs_up,
        (select count(*)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days' and feedback = -1) as thumbs_down,
        (select count(*)::int from ai_tool_calls where created_at > now() - interval '7 days') as tool_calls,
        (select count(*)::int from ai_tool_calls where created_at > now() - interval '7 days' and ok = false) as tool_errors,
        (select count(*)::int from ai_messages where role = 'assistant' and created_at > now() - interval '7 days' and provider is not null) as ok_count
    `)) as unknown as UsageRow[];
    const row = rows[0];
    const assistantMessages = row?.assistant_messages ?? 0;
    return json({
      window: "7d",
      generatedAt: new Date().toISOString(),
      turns: row?.turns ?? 0,
      assistantMessages,
      users: row?.users ?? 0,
      inputTokens: row?.input_tokens ?? 0,
      outputTokens: row?.output_tokens ?? 0,
      costUsd: row?.cost_usd ?? 0,
      avgMs: row?.avg_ms ?? 0,
      guard: {
        ok: row?.guard_ok ?? 0,
        regenerated: row?.guard_regenerated ?? 0,
        fallback: row?.guard_fallback ?? 0,
      },
      feedback: {
        up: row?.thumbs_up ?? 0,
        down: row?.thumbs_down ?? 0,
      },
      tools: {
        calls: row?.tool_calls ?? 0,
        errors: row?.tool_errors ?? 0,
        errorRate:
          row && row.tool_calls > 0
            ? Math.round((row.tool_errors / row.tool_calls) * 1000) / 10
            : 0,
      },
    });
  } catch (error) {
    console.warn("[ai.assistant] usage card failed", (error as Error).message);
    return json({
      window: "7d",
      generatedAt: new Date().toISOString(),
      turns: 0,
      assistantMessages: 0,
      users: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      avgMs: 0,
      guard: { ok: 0, regenerated: 0, fallback: 0 },
      feedback: { up: 0, down: 0 },
      tools: { calls: 0, errors: 0, errorRate: 0 },
      unavailable: true,
    });
  }
};
