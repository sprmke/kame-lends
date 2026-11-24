export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSec: number;
  count: number;
  windowStart: number;
};

export function nextRateLimitState(
  current: { count: number; windowStart: number } | null,
  now: number,
  limit: number,
  windowMs: number,
): RateLimitDecision {
  if (!current || now - current.windowStart >= windowMs) {
    return {
      allowed: true,
      retryAfterSec: 0,
      count: 1,
      windowStart: now,
    };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((current.windowStart + windowMs - now) / 1000),
      ),
      count: current.count,
      windowStart: current.windowStart,
    };
  }
  return {
    allowed: true,
    retryAfterSec: 0,
    count: current.count + 1,
    windowStart: current.windowStart,
  };
}

export function rateLimitKey(pathname: string, identity: string): string {
  return `${pathname}:${identity}`;
}

const HIGH_COST_PREFIXES = [
  "/api/health",
  "/api/sign",
  "/api/ai/receipt-extraction",
  "/api/ai/assistant",
  "/api/backup",
  "/api/export",
  "/api/storage/upload",
  "/api/push/test",
  "/api/email/test",
] as const;

export function isRateLimitedApiPath(pathname: string): boolean {
  return HIGH_COST_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 30;
/** Public readiness probe: allow CD smoke, block scrapers waking Neon. */
export const RATE_LIMIT_HEALTH_MAX = 60;
/** Full JSON backup download: expensive Neon read. */
export const RATE_LIMIT_BACKUP_MAX = 5;

export function rateLimitMaxForPath(pathname: string): number {
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return RATE_LIMIT_HEALTH_MAX;
  }
  if (pathname === "/api/backup" || pathname.startsWith("/api/backup/")) {
    return RATE_LIMIT_BACKUP_MAX;
  }
  return RATE_LIMIT_MAX;
}
