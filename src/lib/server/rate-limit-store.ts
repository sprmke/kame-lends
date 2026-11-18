import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { rateLimitBuckets } from "$lib/server/db/schema";
import {
  nextRateLimitState,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitDecision,
} from "$lib/server/rate-limit";

function failOpenOnStoreError(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

/** Durable limiter (Postgres). Production fails closed if the store errors. */
export async function consumeRateLimit(
  key: string,
  limit: number = RATE_LIMIT_MAX,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): Promise<RateLimitDecision> {
  const now = Date.now();
  try {
    const existing = await db
      .select({
        count: rateLimitBuckets.count,
        windowStart: rateLimitBuckets.windowStart,
      })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.key, key))
      .limit(1);
    const current = existing[0]
      ? {
          count: existing[0].count,
          windowStart: existing[0].windowStart.getTime(),
        }
      : null;
    const next = nextRateLimitState(current, now, limit, windowMs);
    await db
      .insert(rateLimitBuckets)
      .values({
        key,
        count: next.count,
        windowStart: new Date(next.windowStart),
      })
      .onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: {
          count: next.count,
          windowStart: new Date(next.windowStart),
        },
      });
    return next;
  } catch (error) {
    console.error("[rate-limit] store unavailable", error);
    if (failOpenOnStoreError()) {
      return {
        allowed: true,
        retryAfterSec: 0,
        count: 0,
        windowStart: now,
      };
    }
    return {
      allowed: false,
      retryAfterSec: 60,
      count: limit,
      windowStart: now,
    };
  }
}
