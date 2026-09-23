import type { RequestEvent } from "@sveltejs/kit";

const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/pwa/version",
  "/api/cron",
  "/api/webhooks",
  "/api/sign",
  "/api/e2e",
] as const;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function matchesApiPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) =>
    matchesApiPrefix(pathname, prefix),
  );
}

export function isSameOriginRequest(event: RequestEvent): boolean {
  const expected = event.url.origin;
  const origin = event.request.headers.get("origin");
  if (origin) return origin === expected;
  const referer = event.request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }
  return process.env.VERCEL_ENV !== "production";
}

export function requiresApiSession(pathname: string): boolean {
  return pathname.startsWith("/api/") && !isPublicApiPath(pathname);
}

export function requiresOriginCheck(method: string, pathname: string): boolean {
  return MUTATING.has(method) && requiresApiSession(pathname);
}
