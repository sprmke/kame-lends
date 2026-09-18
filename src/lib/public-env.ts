import { env } from "$env/dynamic/public";
import { APP_DEFAULT_URL } from "$lib/brand";

export function publicAppUrl(): string {
  const fromEnv = env.PUBLIC_APP_URL?.trim();
  return fromEnv || APP_DEFAULT_URL;
}

export function publicContractDisputeVenue(): string {
  return env.PUBLIC_CONTRACT_DISPUTE_VENUE ?? "Pampanga, Philippines";
}

export function publicVapidKey(): string | undefined {
  const key = env.PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key || undefined;
}
