import { env } from "$env/dynamic/private";

/** Reads a private env var (SvelteKit first, then `process.env` for scripts/tests); blank → undefined. */
export function readEnv(name: string): string | undefined {
  const fromKit = env[name as keyof typeof env];
  const value =
    (typeof fromKit === "string" ? fromKit : undefined) ?? process.env[name];
  const trimmed = value?.trim();
  return trimmed || undefined;
}
