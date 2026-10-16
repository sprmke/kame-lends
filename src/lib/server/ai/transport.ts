/**
 * The only module that talks to AI providers over HTTP (enforced by
 * `scripts/check-ai-gateway.mjs`). Owns key rotation, per-attempt timeouts,
 * jittered retries, and the Gemini → Groq fallback. Feature code calls
 * `generateStructured` in `client.ts`, never this file directly.
 */
import { getGeminiApiKeys, getGroqApiKey } from "./config";
import { AiGatewayError, type AiErrorCode } from "./errors";
import type { AiFeatureRoute, AiProvider } from "./features";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ATTEMPTS_PER_KEY = 2;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 4_000;
/** Whole-call budget so a request never outlives the serverless function. */
const DEFAULT_DEADLINE_MS = 55_000;

export type AiPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; base64: string };

export interface TransportRequest {
  route: AiFeatureRoute;
  system: string;
  parts: AiPart[];
  /** Gemini `responseSchema` (OpenAPI subset). Groq gets JSON mode only. */
  responseSchema?: Record<string, unknown>;
  deadlineMs?: number;
}

export interface TransportUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface TransportResult {
  text: string;
  provider: AiProvider;
  model: string;
  usage: TransportUsage;
  latencyMs: number;
  fallbackUsed: boolean;
}

type FailureKind =
  | "auth"
  | "bad_request"
  | "rate_limited"
  | "timeout"
  | "network"
  | "server"
  | "empty";

class AttemptError extends Error {
  constructor(
    readonly kind: FailureKind,
    readonly status: number | null = null,
    readonly retryAfter: string | null = null,
  ) {
    super(kind);
  }

  get retryable(): boolean {
    return (
      this.kind === "rate_limited" ||
      this.kind === "timeout" ||
      this.kind === "network" ||
      this.kind === "server"
    );
  }
}

export interface TransportDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
}

const defaultDeps: TransportDeps = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  random: () => Math.random(),
};

/** Jittered exponential backoff; a provider `retry-after` (seconds) wins when present. */
export function backoffDelayMs(
  attempt: number,
  retryAfter: string | null,
  random: () => number = Math.random,
): number {
  const retryAfterSec = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(retryAfterSec) && retryAfterSec >= 0) {
    return Math.min(retryAfterSec * 1000, MAX_BACKOFF_MS);
  }
  const exp = BASE_BACKOFF_MS * 2 ** attempt;
  return Math.min(exp + Math.floor(random() * BASE_BACKOFF_MS), MAX_BACKOFF_MS);
}

function classifyStatus(status: number, message: string): FailureKind {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "auth";
  // Gemini reports a bad or expired key as 400 API_KEY_INVALID — rotate keys.
  if (status === 400 && /api[_ ]?key/i.test(message)) return "auth";
  if (status >= 400 && status < 500) return "bad_request";
  return "server";
}

function providerErrorMessage(body: unknown): string {
  const error = (body as { error?: { message?: unknown } } | null)?.error;
  return typeof error?.message === "string" ? error.message : "";
}

const keyCursor: Record<AiProvider, number> = { gemini: 0, groq: 0 };

/** Test-only. */
export function resetKeyRotationForTests(): void {
  keyCursor.gemini = 0;
  keyCursor.groq = 0;
}

/** Round-robin start key per isolate so free-tier load spreads across projects. */
function nextKeyStartIndex(provider: AiProvider, keyCount: number): number {
  const start = keyCursor[provider] % keyCount;
  keyCursor[provider] = (keyCursor[provider] + 1) % keyCount;
  return start;
}

interface HttpCall {
  url: string;
  headers: Record<string, string>;
  body: string;
}

async function attemptJson(
  call: HttpCall,
  timeoutMs: number,
  deps: TransportDeps,
): Promise<unknown> {
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await deps.fetch(call.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...call.headers },
      body: call.body,
      signal,
    });
  } catch {
    throw new AttemptError(signal.aborted ? "timeout" : "network");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AttemptError(
      classifyStatus(response.status, providerErrorMessage(body)),
      response.status,
      response.headers?.get?.("retry-after") ?? null,
    );
  }
  return body;
}

/**
 * Runs one provider across its keys with retry/backoff. Throws the last
 * `AttemptError`; a non-auth 400 stops trying this provider's other keys.
 */
async function withRetries<T>(
  provider: AiProvider,
  keys: string[],
  build: (key: string) => HttpCall,
  parse: (body: unknown) => T,
  options: { timeoutMs: number; deadline: number },
  deps: TransportDeps,
): Promise<T> {
  const start = nextKeyStartIndex(provider, keys.length);
  let lastError: AttemptError = new AttemptError("server");

  for (let k = 0; k < keys.length; k += 1) {
    const key = keys[(start + k) % keys.length];
    for (let attempt = 0; attempt < ATTEMPTS_PER_KEY; attempt += 1) {
      const remaining = options.deadline - deps.now();
      if (remaining <= 1_000) throw new AttemptError("timeout");
      try {
        const body = await attemptJson(
          build(key),
          Math.min(options.timeoutMs, remaining),
          deps,
        );
        return parse(body);
      } catch (error) {
        lastError =
          error instanceof AttemptError ? error : new AttemptError("server");
        if (lastError.kind === "bad_request") throw lastError;
        if (lastError.kind === "auth" || lastError.kind === "empty") break;
        if (!lastError.retryable) break;
        if (attempt < ATTEMPTS_PER_KEY - 1) {
          await deps.sleep(
            backoffDelayMs(attempt, lastError.retryAfter, deps.random),
          );
        }
      }
    }
  }
  throw lastError;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

interface ParsedReply {
  text: string;
  usage: TransportUsage;
}

function parseGeminiReply(body: unknown): ParsedReply {
  const typed = body as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: unknown; thought?: unknown }> };
    }>;
    usageMetadata?: Record<string, unknown>;
  } | null;
  const parts = typed?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((part) => part.thought !== true && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim();
  if (!text) throw new AttemptError("empty");
  const meta = typed?.usageMetadata ?? {};
  return {
    text,
    usage: {
      inputTokens: toNumber(meta.promptTokenCount),
      outputTokens:
        toNumber(meta.candidatesTokenCount) + toNumber(meta.thoughtsTokenCount),
    },
  };
}

function parseGroqReply(body: unknown): ParsedReply {
  const typed = body as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: Record<string, unknown>;
  } | null;
  const content = typed?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AttemptError("empty");
  }
  return {
    text: content.trim(),
    usage: {
      inputTokens: toNumber(typed?.usage?.prompt_tokens),
      outputTokens: toNumber(typed?.usage?.completion_tokens),
    },
  };
}

function geminiCall(key: string, request: TransportRequest): HttpCall {
  const { route } = request;
  return {
    url: `${GEMINI_API_BASE}/models/${route.geminiModel}:generateContent`,
    headers: { "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [
        {
          role: "user",
          parts: request.parts.map((part) =>
            part.type === "text"
              ? { text: part.text }
              : { inlineData: { mimeType: part.mimeType, data: part.base64 } },
          ),
        },
      ],
      generationConfig: {
        temperature: route.temperature,
        maxOutputTokens: route.maxOutputTokens,
        responseMimeType: "application/json",
        ...(request.responseSchema
          ? { responseSchema: request.responseSchema }
          : {}),
        thinkingConfig: { thinkingBudget: route.thinkingBudget },
      },
    }),
  };
}

function groqCall(key: string, request: TransportRequest): HttpCall {
  const { route } = request;
  return {
    url: GROQ_CHAT_URL,
    headers: { Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: route.groqModel,
      temperature: route.temperature,
      max_tokens: route.maxOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: request.system },
        {
          role: "user",
          content: request.parts.map((part) =>
            part.type === "text"
              ? { type: "text", text: part.text }
              : {
                  type: "image_url",
                  image_url: {
                    url: `data:${part.mimeType};base64,${part.base64}`,
                  },
                },
          ),
        },
      ],
    }),
  };
}

function canUseGroq(request: TransportRequest): boolean {
  return request.parts.every(
    (part) => part.type === "text" || GROQ_IMAGE_MIME_TYPES.has(part.mimeType),
  );
}

function toGatewayError(
  error: AttemptError,
  provider: AiProvider,
): AiGatewayError {
  const code: AiErrorCode =
    error.kind === "rate_limited"
      ? "rate_limited"
      : error.kind === "timeout"
        ? "timeout"
        : "provider_error";
  return new AiGatewayError(code, `${provider} ${error.kind}`, {
    provider,
    status: error.status ?? undefined,
  });
}

/** Gemini first (all keys), then Groq when the route allows it and the input is supported. */
export async function callModel(
  request: TransportRequest,
  deps: TransportDeps = defaultDeps,
): Promise<TransportResult> {
  const geminiKeys = getGeminiApiKeys();
  const groqKey = getGroqApiKey();
  const groqAllowed =
    request.route.groqFallback && Boolean(groqKey) && canUseGroq(request);

  if (geminiKeys.length === 0 && !groqAllowed) {
    throw new AiGatewayError(
      "not_configured",
      "No AI provider keys configured",
    );
  }

  const startedAt = deps.now();
  const deadline = startedAt + (request.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const options = { timeoutMs: request.route.timeoutMs, deadline };
  let lastFailure: { error: AttemptError; provider: AiProvider } | null = null;

  if (geminiKeys.length > 0) {
    try {
      const reply = await withRetries(
        "gemini",
        geminiKeys,
        (key) => geminiCall(key, request),
        parseGeminiReply,
        options,
        deps,
      );
      return {
        ...reply,
        provider: "gemini",
        model: request.route.geminiModel,
        latencyMs: deps.now() - startedAt,
        fallbackUsed: false,
      };
    } catch (error) {
      if (!(error instanceof AttemptError)) throw error;
      lastFailure = { error, provider: "gemini" };
    }
  }

  if (groqAllowed && groqKey) {
    try {
      const reply = await withRetries(
        "groq",
        [groqKey],
        (key) => groqCall(key, request),
        parseGroqReply,
        options,
        deps,
      );
      return {
        ...reply,
        provider: "groq",
        model: request.route.groqModel,
        latencyMs: deps.now() - startedAt,
        fallbackUsed: geminiKeys.length > 0,
      };
    } catch (error) {
      if (!(error instanceof AttemptError)) throw error;
      lastFailure = { error, provider: "groq" };
    }
  }

  throw lastFailure
    ? toGatewayError(lastFailure.error, lastFailure.provider)
    : new AiGatewayError("provider_error");
}
