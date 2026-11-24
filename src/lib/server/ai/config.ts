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
 *
 * Assistant:
 * - `AI_DISABLED_TOOLS` comma list of tool names
 * - `AI_ASSISTANT_ROLLOUT=owner|all` (default `owner`)
 * - `AI_ASSISTANT_DAILY_TURNS_PER_USER` (default 60, 0 = unlimited)
 * - `AI_DAILY_COST_USD_PER_USER` (default 1, 0 = unlimited)
 * - `AI_ASSISTANT_TURN_TOKEN_CEILING` (default 60000)
 * - `AI_ASSISTANT_RETENTION_DAYS` (default 90)
 * - `GEMINI_MODEL_OVERRIDE_ASSISTANT_CHAT`
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

/** The assistant tool loop is Gemini-only in v1 (ADR-5). */
export function isAssistantConfigured(): boolean {
  return getGeminiApiKeys().length > 0;
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

export function getDisabledTools(): Set<string> {
  const raw = readEnv("AI_DISABLED_TOOLS");
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

export type AssistantRollout = "owner" | "all";

export function getAssistantRollout(): AssistantRollout {
  return readEnv("AI_ASSISTANT_ROLLOUT")?.trim().toLowerCase() === "all"
    ? "all"
    : "owner";
}

/**
 * Rollout is deliberately separate from the global kill switch: the feature
 * can be wired and deployed dark, then opened to owners, then everyone.
 */
export function isAssistantRolloutAllowed(role?: string | null): boolean {
  if (getAssistantRollout() === "all") return true;
  return role === "admin";
}

export interface AssistantLimits {
  maxRounds: number;
  maxToolsPerRound: number;
  deadlineMs: number;
  tokenCeiling: number;
  dailyTurns: number;
  dailyCostUsd: number;
  retentionDays: number;
  maxOutputChars: number;
}

function intEnv(name: string, fallback: number, min = 0): number {
  const raw = readEnv(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getAssistantLimits(): AssistantLimits {
  return {
    maxRounds: intEnv("AI_ASSISTANT_MAX_ROUNDS", 6, 1),
    maxToolsPerRound: intEnv("AI_ASSISTANT_MAX_TOOLS_PER_ROUND", 8, 1),
    deadlineMs: intEnv("AI_ASSISTANT_DEADLINE_MS", 50_000, 5_000),
    tokenCeiling: intEnv("AI_ASSISTANT_TURN_TOKEN_CEILING", 60_000, 2_000),
    dailyTurns: intEnv("AI_ASSISTANT_DAILY_TURNS_PER_USER", 60, 0),
    dailyCostUsd: floatEnv("AI_DAILY_COST_USD_PER_USER", 1),
    retentionDays: intEnv("AI_ASSISTANT_RETENTION_DAYS", 90, 1),
    maxOutputChars: intEnv("AI_ASSISTANT_MAX_OUTPUT_CHARS", 16_000, 1_000),
  };
}

export type AiDisabledReason = "not_configured" | "disabled";

export interface AiStatus {
  enabled: boolean;
  features: Record<AiFeature, boolean>;
  reason: AiDisabledReason | null;
}

/**
 * Safe to send to the browser — no keys, no limits. Pass the session role so
 * the owner-only rollout gate reaches the UI.
 */
export function getAiStatus(role?: string | null): AiStatus {
  const reason: AiDisabledReason | null = !isAiConfigured()
    ? "not_configured"
    : isAiKillSwitchOn()
      ? "disabled"
      : null;
  const disabled = getDisabledFeatures();
  const features = Object.fromEntries(
    AI_FEATURES.map((feature) => [
      feature,
      reason === null &&
        !disabled.has(feature) &&
        (feature !== "assistant_chat" ||
          (isAssistantConfigured() && isAssistantRolloutAllowed(role))),
    ]),
  ) as Record<AiFeature, boolean>;
  return { enabled: reason === null, features, reason };
}
