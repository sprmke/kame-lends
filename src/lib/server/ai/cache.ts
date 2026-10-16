import { createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "$lib/server/db";
import { aiResponseCache } from "$lib/server/db/schema";
import type { AiFeature } from "./features";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Share of writes that also sweep expired rows (cheap lazy cleanup, no cron needed). */
const SWEEP_PROBABILITY = 0.05;

/** sha256 over the parts that change the answer: user, prompt id@version, model, and the input bytes. */
export function buildCacheKey(parts: Array<string | Buffer>): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

export async function getCachedResult(
  userId: string,
  cacheKey: string,
): Promise<unknown | null> {
  try {
    const [row] = await db
      .select({ result: aiResponseCache.result })
      .from(aiResponseCache)
      .where(
        and(
          eq(aiResponseCache.cacheKey, cacheKey),
          eq(aiResponseCache.userId, userId),
          gt(aiResponseCache.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row?.result ?? null;
  } catch (error) {
    console.warn("[ai.cache] read failed", (error as Error).message);
    return null;
  }
}

export async function setCachedResult(
  userId: string,
  cacheKey: string,
  feature: AiFeature,
  result: unknown,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  try {
    await db
      .insert(aiResponseCache)
      .values({ cacheKey, userId, feature, result, createdAt: now, expiresAt })
      .onConflictDoUpdate({
        target: aiResponseCache.cacheKey,
        set: { result, createdAt: now, expiresAt },
      });
    if (Math.random() < SWEEP_PROBABILITY) {
      await db
        .delete(aiResponseCache)
        .where(lt(aiResponseCache.expiresAt, now));
    }
  } catch (error) {
    console.warn("[ai.cache] write failed", (error as Error).message);
  }
}
