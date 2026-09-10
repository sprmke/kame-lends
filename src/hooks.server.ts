import { sequence } from "@sveltejs/kit/hooks";
import { redirect, type Handle } from "@sveltejs/kit";
import { handle as authHandle } from "$lib/server/auth";

/** Auth.js and Drizzle both wrap errors; the connection failure is at the bottom. */
function rootCauseMessage(error: unknown): string {
  let current = error;
  let message = String(error);
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    message = current.message;
    if (!(current.cause instanceof Error)) break;
    current = current.cause;
    message = `${message} <- ${current.message}`;
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

export const handle = sequence(authHandle, resolveSession, protectRoutes);
