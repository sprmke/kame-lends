/**
 * AI gateway entry point for feature code. One call = kill switch → daily cap →
 * cache → transport → strict JSON + zod validation (one repair retry) → metering.
 */
import type { z } from "zod";
import { buildCacheKey, getCachedResult, setCachedResult } from "./cache";
import {
  getDailyCallLimit,
  getDisabledFeatures,
  isAiConfigured,
  isAiKillSwitchOn,
  isResponseCacheEnabled,
} from "./config";
import { AiGatewayError, isAiGatewayError } from "./errors";
import {
  AI_FEATURE_ROUTES,
  estimateCostUsd,
  type AiFeature,
  type AiProvider,
} from "./features";
import type { PromptDefinition } from "./prompt";
import {
  callModel,
  type AiPart,
  type TransportResult,
  type TransportUsage,
} from "./transport";
import { countRecentCalls, recordAiUsage } from "./usage";

export interface GenerateStructuredOptions<Ctx, T> {
  feature: AiFeature;
  prompt: PromptDefinition<Ctx>;
  promptContext: Ctx;
  /** Input parts after the instruction text (images, extra text). */
  parts: AiPart[];
  schema: z.ZodType<T>;
  /** Gemini responseSchema (OpenAPI subset). */
  responseSchema: Record<string, unknown>;
  userId: string;
  /** Extra cache-key material (e.g. image bytes). Omit to skip the cache. */
  cacheInput?: Array<string | Buffer>;
}

export interface StructuredResult<T> {
  data: T;
  provider: AiProvider | null;
  model: string | null;
  cacheHit: boolean;
  fallbackUsed: boolean;
}

export interface ClientDeps {
  callModel: typeof callModel;
}

const defaultDeps: ClientDeps = { callModel };

/** Throws `disabled` / `not_configured` when the feature cannot run right now. */
export function assertFeatureEnabled(feature: AiFeature): void {
  if (!isAiConfigured()) {
    throw new AiGatewayError("not_configured", "No AI provider keys");
  }
  if (isAiKillSwitchOn() || getDisabledFeatures().has(feature)) {
    throw new AiGatewayError("disabled", `AI feature ${feature} is disabled`);
  }
}

async function assertWithinDailyCap(userId: string): Promise<void> {
  const limit = getDailyCallLimit();
  if (limit === 0) return;
  if ((await countRecentCalls(userId)) >= limit) {
    throw new AiGatewayError("quota_exceeded", "Daily AI call limit reached");
  }
}

/** Strict parse: whole reply must be JSON (a ```json fence is tolerated). */
export function parseJsonReply(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 10)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function addUsage(a: TransportUsage, b: TransportUsage): TransportUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

type Validation<T> = { ok: true; data: T } | { ok: false; issues: string };

function validate<T>(schema: z.ZodType<T>, text: string): Validation<T> {
  let raw: unknown;
  try {
    raw = parseJsonReply(text);
  } catch {
    return { ok: false, issues: "reply was not valid JSON" };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, issues: formatIssues(parsed.error) };
}

export async function generateStructured<Ctx, T>(
  options: GenerateStructuredOptions<Ctx, T>,
  deps: ClientDeps = defaultDeps,
): Promise<StructuredResult<T>> {
  const { feature, prompt, userId, schema } = options;
  const route = AI_FEATURE_ROUTES[feature];
  const base = {
    userId,
    feature,
    promptId: prompt.id,
    promptVersion: prompt.version,
  };

  assertFeatureEnabled(feature);

  const cacheKey =
    options.cacheInput && isResponseCacheEnabled()
      ? buildCacheKey([
          userId,
          `${prompt.id}@${prompt.version}`,
          route.geminiModel,
          ...options.cacheInput,
        ])
      : null;

  if (cacheKey) {
    const cached = await getCachedResult(userId, cacheKey);
    const parsed = cached === null ? null : schema.safeParse(cached);
    if (parsed?.success) {
      await recordAiUsage({
        ...base,
        provider: null,
        model: null,
        inputTokens: 0,
        outputTokens: 0,
        estCostUsd: 0,
        latencyMs: 0,
        status: "success",
        errorCode: null,
        fallbackUsed: false,
        cacheHit: true,
      });
      return {
        data: parsed.data,
        provider: null,
        model: null,
        cacheHit: true,
        fallbackUsed: false,
      };
    }
  }

  await assertWithinDailyCap(userId);

  const system = prompt.build(options.promptContext);
  const startedAt = Date.now();
  let usage: TransportUsage = { inputTokens: 0, outputTokens: 0 };
  let last: TransportResult | null = null;

  try {
    const first = await deps.callModel({
      route,
      system,
      parts: options.parts,
      responseSchema: options.responseSchema,
    });
    last = first;
    usage = addUsage(usage, first.usage);
    let result = validate(schema, first.text);

    if (!result.ok) {
      const repair = await deps.callModel({
        route,
        system,
        parts: [
          ...options.parts,
          {
            type: "text",
            text: `Your previous reply did not match the required JSON schema (${result.issues}). Reply again with only the corrected JSON object.`,
          },
        ],
        responseSchema: options.responseSchema,
      });
      last = repair;
      usage = addUsage(usage, repair.usage);
      result = validate(schema, repair.text);
    }

    if (!result.ok) {
      throw new AiGatewayError("invalid_output", result.issues, {
        provider: last.provider,
      });
    }

    await recordAiUsage({
      ...base,
      provider: last.provider,
      model: last.model,
      ...usage,
      estCostUsd: estimateCostUsd(route, last.provider, usage),
      latencyMs: Date.now() - startedAt,
      status: "success",
      errorCode: null,
      fallbackUsed: last.fallbackUsed,
      cacheHit: false,
    });

    if (cacheKey) {
      await setCachedResult(userId, cacheKey, feature, result.data);
    }

    return {
      data: result.data,
      provider: last.provider,
      model: last.model,
      cacheHit: false,
      fallbackUsed: last.fallbackUsed,
    };
  } catch (error) {
    const gatewayError = isAiGatewayError(error)
      ? error
      : new AiGatewayError("provider_error", (error as Error)?.message);
    const provider = last?.provider ?? gatewayError.provider;
    await recordAiUsage({
      ...base,
      provider,
      model: last?.model ?? null,
      ...usage,
      estCostUsd: provider ? estimateCostUsd(route, provider, usage) : 0,
      latencyMs: Date.now() - startedAt,
      status: "error",
      errorCode: gatewayError.code,
      fallbackUsed: last?.fallbackUsed ?? false,
      cacheHit: false,
    });
    throw gatewayError;
  }
}
