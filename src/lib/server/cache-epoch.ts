/**
 * Cross-instance cache epochs (PERF-02).
 *
 * The 45-second memory cache is per Vercel isolate: a payment saved on
 * instance A could be invisible on instance B. A row in `cache_epochs` is
 * bumped on every money mutation, and the cache key includes the epoch, so
 * every instance re-reads after a write.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import { cacheEpochs } from "$lib/server/db/schema";

export async function cacheEpoch(key: string): Promise<number> {
  try {
    const row = await db.query.cacheEpochs.findFirst({
      where: eq(cacheEpochs.key, key),
      columns: { version: true },
    });
    return row?.version ?? 0;
  } catch (error) {
    // A cache key must never break a page. Falling back to 0 only risks the
    // old 45-second staleness, not a wrong number.
    console.error("[cache] epoch read failed", error);
    return 0;
  }
}

export async function bumpCacheEpoch(key: string): Promise<void> {
  try {
    await db
      .insert(cacheEpochs)
      .values({ key, version: 1 })
      .onConflictDoUpdate({
        target: cacheEpochs.key,
        set: {
          version: sql`${cacheEpochs.version} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[cache] epoch bump failed", error);
  }
}
