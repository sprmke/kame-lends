/**
 * CSRF defense for cookie-authenticated mutating API routes.
 *
 * Browsers send `Origin` on cross-site POST/PATCH/DELETE. A missing header is a
 * non-browser client (curl, tests) and still needs a valid session cookie, so it
 * is allowed. An explicit `Origin: null` (sandboxed iframe) is rejected.
 */
export function isSameOriginRequest(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === "null") return false;
  try {
    return new URL(origin).origin === url.origin;
  } catch {
    return false;
  }
}
