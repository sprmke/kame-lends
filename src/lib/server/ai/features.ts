/**
 * Per-feature model routing. Add a feature here first, then a prompt in `prompts/`,
 * then call `generateStructured` with it. Prices are USD per 1M tokens and only
 * feed the cost estimate in `ai_usage_events`.
 */
export const AI_FEATURES = ["receipt_extraction"] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

export type AiProvider = "gemini" | "groq";

export interface AiFeatureRoute {
  geminiModel: string;
  groqModel: string;
  /** Groq fallback when every Gemini key fails (images: jpeg/png/gif/webp only). */
  groqFallback: boolean;
  maxOutputTokens: number;
  /** 0 disables Gemini 2.5 "thinking" — extraction does not need it and it costs output tokens. */
  thinkingBudget: number;
  temperature: number;
  /** Per HTTP attempt. */
  timeoutMs: number;
  price: Record<AiProvider, { inputPerM: number; outputPerM: number }>;
}

export const AI_FEATURE_ROUTES: Record<AiFeature, AiFeatureRoute> = {
  receipt_extraction: {
    geminiModel: "gemini-2.5-flash",
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
};

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
