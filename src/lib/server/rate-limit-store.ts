import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { rateLimitBuckets } from "$lib/server/db/schema";
import {
  nextRateLimitState,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitDecision,
} from "$lib/server/rate-limit";

/** Durable limiter (Postgres). Fail open if the table is missing so deploys before migrate still serve. */
export async function consumeRateLimit(
  key: string,
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
    const next = nextRateLimitState(
      current,
      now,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
    );
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
    return {
      allowed: true,
      retryAfterSec: 0,
      count: 0,
      windowStart: now,
    };
  }
}
