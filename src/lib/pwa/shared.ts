/** Worker-safe PWA constants. No DOM, no `$app/*`, no `$lib/server/*`. */

export const CACHE_PREFIX = "kl";

export function appCacheName(version: string): string {
  return `${CACHE_PREFIX}-app-${version}`;
}

export const PAGES_CACHE = `${CACHE_PREFIX}-pages`;
export const DATA_CACHE = `${CACHE_PREFIX}-data`;
export const FONTS_CACHE = `${CACHE_PREFIX}-fonts`;

/** Paths that must never be cached or served from cache. */
export const NEVER_CACHE_PREFIXES = [
  "/auth",
  "/signin",
  "/api/e2e",
  "/api/cron",
  "/api/webhooks",
  "/api/backup",
  "/api/export",
  "/api/storage",
  "/api/ai",
  "/api/health",
  "/api/pwa",
  "/api/push",
] as const;

/**
 * GET API endpoints safe to cache for offline read.
 * Adding an entry stores borrower/investor PII on disk.
 */
export const OFFLINE_API_READS = [
  "/api/loans",
  "/api/party-profile/me",
  "/api/payment-methods",
] as const;

export const OFFLINE_ERROR_MESSAGE =
  "You are offline. Connect to save changes.";
export const OFFLINE_ERROR_BODY = JSON.stringify({
  error: OFFLINE_ERROR_MESSAGE,
});

export const SW_MESSAGE = {
  SKIP_WAITING: "SKIP_WAITING",
  PURGE_OFFLINE: "PURGE_OFFLINE",
  CHECK_VERSION: "CHECK_VERSION",
  KILLED: "KILLED",
  PUSH_RESYNC: "PUSH_RESYNC",
  NOTIFICATION_CLICK: "NOTIFICATION_CLICK",
} as const;

export type PushPayload = {
  title: string;
  body: string;
  path?: string;
  tag?: string;
  badgeCount?: number;
};

export function pathnameOf(url: string | URL): string {
  return new URL(url, "https://placeholder.local").pathname;
}

export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isLoanContractApi(pathname: string): boolean {
  return /^\/api\/loans\/[^/]+\/contract(?:\/|$)/.test(pathname);
}

export function isNeverCached(pathname: string): boolean {
  return (
    NEVER_CACHE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix)) ||
    isLoanContractApi(pathname)
  );
}

export function isOfflineApiRead(pathname: string): boolean {
  if (isLoanContractApi(pathname)) return false;
  return OFFLINE_API_READS.some((prefix) => matchesPrefix(pathname, prefix));
}

/** Strip SvelteKit invalidation param so cached __data.json keys match. */
export function normalizeDataCacheKey(url: string | URL): string {
  const parsed = new URL(url, "https://placeholder.local");
  parsed.searchParams.delete("x-sveltekit-invalidated");
  const search = parsed.searchParams.toString();
  return search ? `${parsed.pathname}?${search}` : parsed.pathname;
}

export function isDataRequest(pathname: string): boolean {
  return pathname.includes("/__data.json");
}

export function isGoogleFontRequest(url: URL): boolean {
  return (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  );
}

export function isImmutableAsset(pathname: string): boolean {
  return pathname.startsWith("/_app/immutable/");
}

export function shouldCacheNavigation(response: Response): boolean {
  if (!response.ok || response.redirected) return false;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return false;
  const cacheControl = response.headers.get("cache-control") ?? "";
  if (cacheControl.includes("no-store")) return false;
  return true;
}

export function offlineJsonResponse(): Response {
  return new Response(OFFLINE_ERROR_BODY, {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

export const INSTALL_DISMISS_KEY = "kl:install-dismissed-at";
export const INSTALL_DISMISS_DAYS = 30;
export const USER_ID_KEY = "kl:uid";

export function installDismissed(now = Date.now()): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(INSTALL_DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  return now - dismissedAt < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function recordInstallDismissal(now = Date.now()): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(INSTALL_DISMISS_KEY, String(now));
}
