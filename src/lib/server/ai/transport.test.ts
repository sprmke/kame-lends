import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_FEATURE_ROUTES } from "./features";
import {
  backoffDelayMs,
  callModel,
  resetKeyRotationForTests,
  type TransportDeps,
  type TransportRequest,
} from "./transport";
import { AiGatewayError } from "./errors";

const route = AI_FEATURE_ROUTES.receipt_extraction;

const request: TransportRequest = {
  route,
  system: "system prompt",
  parts: [
    { type: "text", text: "read" },
    { type: "image", mimeType: "image/jpeg", base64: "AAAA" },
  ],
  responseSchema: { type: "OBJECT" },
};

function geminiOk(text: string, usage = { prompt: 100, out: 20 }) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: "thinking...", thought: true }, { text }],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: usage.prompt,
        candidatesTokenCount: usage.out,
      },
    }),
  };
}

function groqOk(text: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    }),
  };
}

function httpError(status: number, message = "", retryAfter?: string) {
  const headers = new Headers();
  if (retryAfter) headers.set("retry-after", retryAfter);
  return {
    ok: false,
    status,
    headers,
    json: async () => ({ error: { message } }),
  };
}

function makeDeps(fetchMock: ReturnType<typeof vi.fn>): TransportDeps {
  return {
    fetch: fetchMock as unknown as typeof fetch,
    sleep: vi.fn(async () => {}),
    now: () => 0,
    random: () => 0,
  };
}

describe("transport.callModel", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetKeyRotationForTests();
    delete process.env.GEMINI_API_KEYS;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("sends the Gemini key in a header, never the URL, and skips thought parts", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    const fetchMock = vi.fn().mockResolvedValue(geminiOk('{"ok":true}'));

    const result = await callModel(request, makeDeps(fetchMock));

    expect(result).toMatchObject({
      text: '{"ok":true}',
      provider: "gemini",
      model: route.geminiModel,
      fallbackUsed: false,
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain("key=");
    expect(init.headers["x-goog-api-key"]).toBe("gem-key");
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe("system prompt");
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
    expect(body.generationConfig.responseSchema).toEqual({ type: "OBJECT" });
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("image/jpeg");
  });

  it("retries a 429 on the same key with backoff, then succeeds", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(429, "slow down", "2"))
      .mockResolvedValueOnce(geminiOk("{}"));
    const deps = makeDeps(fetchMock);

    await callModel(request, deps);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledWith(2000);
  });

  it("rotates to the next key on an invalid-key 400 without retrying", async () => {
    process.env.GEMINI_API_KEYS = "bad-key, good-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        httpError(400, "API key not valid. API_KEY_INVALID"),
      )
      .mockResolvedValueOnce(geminiOk("{}"));

    await callModel(request, makeDeps(fetchMock));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe(
      "bad-key",
    );
    expect(fetchMock.mock.calls[1][1].headers["x-goog-api-key"]).toBe(
      "good-key",
    );
  });

  it("falls back to Groq when every Gemini attempt fails", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    process.env.GROQ_API_KEY = "groq-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(503))
      .mockResolvedValueOnce(httpError(503))
      .mockResolvedValueOnce(groqOk('{"ok":1}'));

    const result = await callModel(request, makeDeps(fetchMock));

    expect(result).toMatchObject({
      provider: "groq",
      model: route.groqModel,
      fallbackUsed: true,
      usage: { inputTokens: 50, outputTokens: 10 },
    });
    const [url, init] = fetchMock.mock.calls[2];
    expect(url).toContain("api.groq.com");
    expect(init.headers.Authorization).toBe("Bearer groq-key");
    const body = JSON.parse(init.body);
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "system prompt",
    });
    expect(body.messages[1].content[1].image_url.url).toBe(
      "data:image/jpeg;base64,AAAA",
    );
  });

  it("does not send unsupported images to Groq", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    process.env.GROQ_API_KEY = "groq-key";
    const fetchMock = vi.fn().mockResolvedValue(httpError(500));

    await expect(
      callModel(
        {
          ...request,
          parts: [{ type: "image", mimeType: "image/heic", base64: "AAAA" }],
        },
        makeDeps(fetchMock),
      ),
    ).rejects.toMatchObject({ code: "provider_error", provider: "gemini" });
    expect(
      fetchMock.mock.calls.every(([url]) =>
        String(url).includes("generativelanguage"),
      ),
    ).toBe(true);
  });

  it("gives up after retrying network failures", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(callModel(request, makeDeps(fetchMock))).rejects.toMatchObject(
      { code: "provider_error" },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns rate_limited when Gemini stays throttled and no fallback exists", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    const fetchMock = vi.fn().mockResolvedValue(httpError(429));

    await expect(callModel(request, makeDeps(fetchMock))).rejects.toMatchObject(
      { code: "rate_limited" },
    );
  });

  it("throws not_configured with no keys", async () => {
    const fetchMock = vi.fn();
    await expect(
      callModel(request, makeDeps(fetchMock)),
    ).rejects.toBeInstanceOf(AiGatewayError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats an empty Gemini reply as a failure", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ candidates: [{ finishReason: "SAFETY" }] }),
    });

    await expect(callModel(request, makeDeps(fetchMock))).rejects.toMatchObject(
      { code: "provider_error" },
    );
  });
});

describe("backoffDelayMs", () => {
  it("honors retry-after and caps it", () => {
    expect(backoffDelayMs(0, "1")).toBe(1000);
    expect(backoffDelayMs(0, "60")).toBe(4000);
  });

  it("grows exponentially with jitter", () => {
    expect(backoffDelayMs(0, null, () => 0)).toBe(400);
    expect(backoffDelayMs(1, null, () => 0)).toBe(800);
    expect(backoffDelayMs(5, null, () => 0.99)).toBe(4000);
  });
});
