import { env } from "$env/dynamic/public";

/** Client hint only. Server still enforces R2 env vars on upload. */
export function isR2ConfiguredClientHint(): boolean {
  return env.PUBLIC_R2_ENABLED === "true";
}
