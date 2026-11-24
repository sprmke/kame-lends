/**
 * Per-feature model routing. Add a feature here first, then a prompt in `prompts/`,
 * then call `generateStructured` (or `runAgentTurn` for agent profiles).
 * Prices are USD per 1M tokens and only feed the cost estimate in `ai_usage_events`.
 *
 * Model lifecycle checked 2026-11-21:
 * - `gemini-2.5-flash` is deprecated and routes to `gemini-3.5-flash-lite`
 *   starting 2026-12-01, so receipt extraction moves to the replacement now.
 * - `gemini-3.8-flash` is the current stable Flash model with no shutdown date.
 */
export const AI_FEATURES = ["receipt_extraction", "assistant_chat"] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

export type AiProvider = "gemini" | "groq";

export interface AiFeatureRoute {
  geminiModel: string;
  groqModel: string;
  /** Groq fallback when every Gemini key fails (images: jpeg/png/gif/webp only). */
  groqFallback: boolean;
  maxOutputTokens: number;
  /** 0 disables Gemini "thinking". */
  thinkingBudget: number;
  temperature: number;
  /** Per HTTP attempt. */
  timeoutMs: number;
  price: Record<AiProvider, { inputPerM: number; outputPerM: number }>;
}

export const AI_FEATURE_ROUTES: Record<AiFeature, AiFeatureRoute> = {
  receipt_extraction: {
    geminiModel: "gemini-3.5-flash-lite",
    groqModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    groqFallback: true,
    maxOutputTokens: 2048,
    thinkingBudget: 0,
    temperature: 0.1,
    timeoutMs: 30_000,
    price: {
      gemini: { inputPerM: 0.3, outputPerM: 2.5 },
      groq: { inputPerM: 0.11, outputPerM: 0.34 },
    },
  },
  assistant_chat: {
    geminiModel: "gemini-3.8-flash",
    groqModel: "",
    groqFallback: false,
    maxOutputTokens: 4096,
    thinkingBudget: 512,
    temperature: 0.2,
    timeoutMs: 25_000,
    price: {
      // Promotional pricing through 2026-12-31; the table is an estimate only.
      gemini: { inputPerM: 0.75, outputPerM: 3.75 },
      groq: { inputPerM: 0, outputPerM: 0 },
    },
  },
};

const ENV_MODEL_OVERRIDE: Partial<Record<AiFeature, string>> = {
  receipt_extraction: "GEMINI_MODEL_OVERRIDE_RECEIPT_EXTRACTION",
  assistant_chat: "GEMINI_MODEL_OVERRIDE_ASSISTANT_CHAT",
};

/**
 * Route for one feature, with the optional env model override applied. Feature
 * code must use this instead of reading `AI_FEATURE_ROUTES` directly so a
 * retired model can be swapped without a deploy.
 */
export function resolveFeatureRoute(feature: AiFeature): AiFeatureRoute {
  const route = AI_FEATURE_ROUTES[feature];
  const envName = ENV_MODEL_OVERRIDE[feature];
  const override = envName ? process.env[envName]?.trim() : undefined;
  return override ? { ...route, geminiModel: override } : route;
}

export function isAiFeature(value: unknown): value is AiFeature {
  return (
    typeof value === "string" &&
    (AI_FEATURES as readonly string[]).includes(value)
  );
}

export function estimateCostUsd(
  route: AiFeatureRoute,
  provider: AiProvider,
  usage: { inputTokens: number; outputTokens: number },
): number {
  const price = route.price[provider];
  const cost =
    (usage.inputTokens * price.inputPerM +
      usage.outputTokens * price.outputPerM) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
