import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import { aiMessages, aiUsageEvents } from "$lib/server/db/schema";
import type { AiErrorCode } from "./errors";
import type { AiFeature, AiProvider } from "./features";

export interface AiUsageRecord {
  userId: string | null;
  feature: AiFeature;
  provider: AiProvider | null;
  model: string | null;
  promptId: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
  latencyMs: number | null;
  status: "success" | "error";
  errorCode: AiErrorCode | null;
  fallbackUsed: boolean;
  cacheHit: boolean;
  conversationId?: string | null;
  messageId?: string | null;
  rounds?: number | null;
  toolCalls?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Model calls in the last 24h for this user (cache hits excluded).
 * Fails open (0) when the table is missing so deploys before migrate still work.
 */
export async function countRecentCalls(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ value: count() })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.userId, userId),
          eq(aiUsageEvents.cacheHit, false),
          gte(aiUsageEvents.createdAt, new Date(Date.now() - DAY_MS)),
        ),
      );
    return Number(row?.value ?? 0);
  } catch (error) {
    console.warn("[ai.usage] count failed", (error as Error).message);
    return 0;
  }
}

/**
 * Assistant turns in the last 24h for this user. One user message = one turn.
 * Fails open (0) when the assistant tables do not exist yet, matching the
 * deploy-before-migrate pattern used by `countRecentCalls`.
 */
export async function countAssistantTurns(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ value: count() })
      .from(aiMessages)
      .where(
        and(
          eq(aiMessages.userId, userId),
          eq(aiMessages.role, "user"),
          gte(aiMessages.createdAt, new Date(Date.now() - DAY_MS)),
        ),
      );
    return Number(row?.value ?? 0);
  } catch (error) {
    console.warn("[ai.usage] turn count failed", (error as Error).message);
    return 0;
  }
}

/** Estimated USD spent by this user in the last 24h (cache hits included as 0). */
export async function getDailyCostUsd(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({
        value: sql<string>`coalesce(sum(${aiUsageEvents.estCostUsd}), 0)`,
      })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.userId, userId),
          gte(aiUsageEvents.createdAt, new Date(Date.now() - DAY_MS)),
        ),
      );
    return Number(row?.value ?? 0);
  } catch (error) {
    console.warn("[ai.usage] cost sum failed", (error as Error).message);
    return 0;
  }
}

/**
 * Persists one usage row and logs a single structured line. Never throws and never
 * logs prompt/response bodies (receipts contain names and account numbers).
 */
export async function recordAiUsage(record: AiUsageRecord): Promise<void> {
  console.info(
    JSON.stringify({
      event: `ai.${record.feature}.${record.status}`,
      provider: record.provider,
      model: record.model,
      prompt: `${record.promptId}@${record.promptVersion}`,
      latencyMs: record.latencyMs,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      errorCode: record.errorCode,
      fallbackUsed: record.fallbackUsed,
      cacheHit: record.cacheHit,
    }),
  );
  try {
    await db.insert(aiUsageEvents).values({
      ...record,
      estCostUsd: record.estCostUsd.toFixed(6),
    });
  } catch (error) {
    console.warn("[ai.usage] insert failed", (error as Error).message);
  }
}
