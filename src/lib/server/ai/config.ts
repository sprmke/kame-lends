import { readEnv } from "$lib/server/read-env";
import { AI_FEATURES, type AiFeature } from "./features";

/**
 * AI env config. Keys never leave this module and `transport.ts`.
 *
 * - `GEMINI_API_KEYS` (comma list, rotated) or `GEMINI_API_KEY`
 * - `GROQ_API_KEY` (optional fallback)
 * - `AI_ENABLED=false` kill switch (default: on when any key exists)
 * - `AI_DISABLED_FEATURES` comma list of feature ids
 * - `AI_DAILY_CALLS_PER_USER` (default 300, 0 = unlimited)
 * - `AI_RESPONSE_CACHE_DISABLED=1`
 */
function isFalsy(value: string | undefined): boolean {
  return value !== undefined && /^(0|false|off|no)$/i.test(value);
}

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && /^(1|true|on|yes)$/i.test(value);
}

export function getGeminiApiKeys(): string[] {
  const multi = readEnv("GEMINI_API_KEYS");
  if (multi) {
    return multi
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
  }
  const single = readEnv("GEMINI_API_KEY");
  return single ? [single] : [];
}

export function getGroqApiKey(): string | null {
  return readEnv("GROQ_API_KEY") ?? null;
}

export function isAiConfigured(): boolean {
  return getGeminiApiKeys().length > 0 || Boolean(getGroqApiKey());
}

export function isAiKillSwitchOn(): boolean {
  return isFalsy(readEnv("AI_ENABLED"));
}

export function getDisabledFeatures(): Set<string> {
  const raw = readEnv("AI_DISABLED_FEATURES");
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export const DEFAULT_DAILY_CALLS_PER_USER = 300;

/** 0 means unlimited. */
export function getDailyCallLimit(): number {
  const raw = readEnv("AI_DAILY_CALLS_PER_USER");
  if (raw === undefined) return DEFAULT_DAILY_CALLS_PER_USER;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_DAILY_CALLS_PER_USER;
}

export function isResponseCacheEnabled(): boolean {
  return !isTruthy(readEnv("AI_RESPONSE_CACHE_DISABLED"));
}

export type AiDisabledReason = "not_configured" | "disabled";

export interface AiStatus {
  enabled: boolean;
  features: Record<AiFeature, boolean>;
  reason: AiDisabledReason | null;
}

/** Safe to send to the browser — no keys, no limits. */
export function getAiStatus(): AiStatus {
  const reason: AiDisabledReason | null = !isAiConfigured()
    ? "not_configured"
    : isAiKillSwitchOn()
      ? "disabled"
      : null;
  const disabled = getDisabledFeatures();
  const features = Object.fromEntries(
    AI_FEATURES.map((feature) => [
      feature,
      reason === null && !disabled.has(feature),
    ]),
  ) as Record<AiFeature, boolean>;
  return { enabled: reason === null, features, reason };
}
