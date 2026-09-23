import { sequence } from "@sveltejs/kit/hooks";
import {
  json,
  redirect,
  type Handle,
  type HandleServerError,
} from "@sveltejs/kit";
import { handle as authHandle } from "$lib/server/auth";
import {
  isSameOriginRequest,
  requiresApiSession,
  requiresOriginCheck,
} from "$lib/server/api-access";
import { warnMissingProductionEnv } from "$lib/server/env-production";
import { isRateLimitedApiPath, rateLimitKey } from "$lib/server/rate-limit";
import { consumeRateLimit } from "$lib/server/rate-limit-store";
import {
  applyApiCacheHeaders,
  applySecurityHeaders,
} from "$lib/server/security-headers";

/** Auth.js and Drizzle both wrap errors; the connection failure is at the bottom. */
function rootCauseMessage(error: unknown): string {
  let current: unknown = error;
  let message = String(error);
  for (let depth = 0; depth < 5; depth += 1) {
    if (!(current instanceof Error)) break;
    message = current.message;
    if (!(current.cause instanceof Error)) break;
    current = current.cause;
    message = `${message} <- ${(current as Error).message}`;
  }
  return message;
}

/** One session lookup per request instead of hooks + layout + page each calling auth(). */
const resolveSession: Handle = async ({ event, resolve }) => {
  try {
    event.locals.session = (await event.locals.auth?.()) ?? null;
  } catch (error) {
    console.error("[auth] session lookup failed:", rootCauseMessage(error));
    event.locals.session = null;
  }
  return resolve(event);
};

const protectRoutes: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  const session = event.locals.session;
  const isLoggedIn = !!session?.user;

  const isPublicRoute = pathname === "/" || pathname === "/signin";
  const isAuthRoute = pathname.startsWith("/auth");
  const isSigningRoute = pathname.startsWith("/sign/");
  const isApiRoute = pathname.startsWith("/api");

  if (isApiRoute) {
    return resolve(event);
  }

  if (isPublicRoute || isAuthRoute || isSigningRoute) {
    if (isLoggedIn && pathname === "/") {
      throw redirect(303, "/dashboard");
    }
    return resolve(event);
  }

  if (!isLoggedIn) {
    const signInUrl = new URL("/signin", event.url.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    throw redirect(303, signInUrl.toString());
  }

  return resolve(event);
};

const apiGuardAndHeaders: Handle = async ({ event, resolve }) => {
  warnMissingProductionEnv();
  const { pathname } = event.url;
  const method = event.request.method;

  if (pathname.startsWith("/api/")) {
    if (requiresApiSession(pathname) && !event.locals.session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    if (requiresOriginCheck(method, pathname) && !isSameOriginRequest(event)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }
    if (isRateLimitedApiPath(pathname)) {
      const identity =
        event.locals.session?.user?.id ?? event.getClientAddress();
      const decision = await consumeRateLimit(rateLimitKey(pathname, identity));
      if (!decision.allowed) {
        return json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: { "Retry-After": String(decision.retryAfterSec) },
          },
        );
      }
    }
  }

  const response = await resolve(event);
  applySecurityHeaders(response.headers);
  if (pathname.startsWith("/api/")) {
    applyApiCacheHeaders(response.headers);
  }
  return response;
};

export const handle = sequence(
  authHandle,
  resolveSession,
  apiGuardAndHeaders,
  protectRoutes,
);

export const handleError: HandleServerError = ({ error, event, status }) => {
  console.error(
    JSON.stringify({
      level: "error",
      route: event.route.id ?? event.url.pathname,
      status,
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev-local",
    }),
  );
  void error;
  return { message: "Something went wrong" };
};
