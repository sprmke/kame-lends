import { env } from "$env/dynamic/private";
import { APP_DEFAULT_URL } from "$lib/brand";

/** Absolute app origin for server-generated links (calendar, signing, emails). */
export function resolveAppUrl(): string {
  const fromEnv = env.PUBLIC_APP_URL?.trim();
  return fromEnv || APP_DEFAULT_URL;
}
