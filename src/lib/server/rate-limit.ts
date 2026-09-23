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
  "/api/sign",
  "/api/ai/receipt-extraction",
  "/api/backup",
  "/api/export",
  "/api/storage/upload",
  "/api/push/test",
] as const;

export function isRateLimitedApiPath(pathname: string): boolean {
  return HIGH_COST_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 30;
