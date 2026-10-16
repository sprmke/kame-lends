import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("./usage", () => ({
  countRecentCalls: vi.fn(async () => 0),
  recordAiUsage: vi.fn(async () => {}),
}));
vi.mock("./cache", async () => {
  const actual = await vi.importActual<typeof import("./cache")>("./cache");
  return {
    buildCacheKey: actual.buildCacheKey,
    getCachedResult: vi.fn(async () => null),
    setCachedResult: vi.fn(async () => {}),
  };
});

import {
  generateStructured,
  parseJsonReply,
  type GenerateStructuredOptions,
} from "./client";
import { definePrompt } from "./prompt";
import { countRecentCalls, recordAiUsage } from "./usage";
import { getCachedResult, setCachedResult } from "./cache";
import type { TransportResult } from "./transport";

const schema = z.object({ amount: z.number() });
const prompt = definePrompt<{ name: string }>({
  id: "test_prompt",
  version: "1",
  build: (ctx) => `Hello ${ctx.name}`,
});

function reply(text: string, provider: "gemini" | "groq" = "gemini") {
  return {
    text,
    provider,
    model: provider === "gemini" ? "gemini-2.5-flash" : "llama",
    usage: { inputTokens: 1000, outputTokens: 100 },
    latencyMs: 10,
    fallbackUsed: provider === "groq",
  } satisfies TransportResult;
}

function options(
  extra: Partial<
    GenerateStructuredOptions<{ name: string }, { amount: number }>
  > = {},
): GenerateStructuredOptions<{ name: string }, { amount: number }> {
  return {
    feature: "receipt_extraction" as const,
    prompt,
    promptContext: { name: "Kame" },
    parts: [{ type: "text" as const, text: "input" }],
    schema,
    responseSchema: {},
    userId: "user-1",
    ...extra,
  };
}

describe("generateStructured", () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "key";
    delete process.env.AI_ENABLED;
    delete process.env.AI_DISABLED_FEATURES;
    delete process.env.AI_DAILY_CALLS_PER_USER;
    delete process.env.AI_RESPONSE_CACHE_DISABLED;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("validates JSON, meters usage, and caches the result", async () => {
    const callModel = vi.fn().mockResolvedValue(reply('{"amount": 5000}'));

    const result = await generateStructured(
      options({ cacheInput: ["image-hash"] }),
      { callModel },
    );

    expect(result).toMatchObject({
      data: { amount: 5000 },
      provider: "gemini",
      cacheHit: false,
    });
    expect(callModel.mock.calls[0][0].system).toBe("Hello Kame");
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        promptId: "test_prompt",
        promptVersion: "1",
        inputTokens: 1000,
        outputTokens: 100,
        estCostUsd: 0.00055,
        cacheHit: false,
      }),
    );
    expect(setCachedResult).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      "receipt_extraction",
      { amount: 5000 },
    );
  });

  it("retries once with the validation issues, then succeeds", async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce(reply('{"amount": "lots"}'))
      .mockResolvedValueOnce(reply('{"amount": 10}'));

    const result = await generateStructured(options(), { callModel });

    expect(result.data).toEqual({ amount: 10 });
    expect(callModel).toHaveBeenCalledTimes(2);
    const repairParts = callModel.mock.calls[1][0].parts;
    expect(repairParts.at(-1).text).toContain("amount");
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 2000, outputTokens: 200 }),
    );
  });

  it("throws invalid_output after the repair also fails and records the error", async () => {
    const callModel = vi.fn().mockResolvedValue(reply("not json"));

    await expect(
      generateStructured(options(), { callModel }),
    ).rejects.toMatchObject({ code: "invalid_output" });
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        errorCode: "invalid_output",
      }),
    );
  });

  it("serves a valid cache hit without calling the model", async () => {
    vi.mocked(getCachedResult).mockResolvedValueOnce({ amount: 7 });
    const callModel = vi.fn();

    const result = await generateStructured(options({ cacheInput: ["hash"] }), {
      callModel,
    });

    expect(result).toMatchObject({ data: { amount: 7 }, cacheHit: true });
    expect(callModel).not.toHaveBeenCalled();
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ cacheHit: true, estCostUsd: 0 }),
    );
  });

  it("respects the kill switch and per-feature disable", async () => {
    const callModel = vi.fn();
    process.env.AI_ENABLED = "false";
    await expect(
      generateStructured(options(), { callModel }),
    ).rejects.toMatchObject({ code: "disabled" });

    process.env.AI_ENABLED = "true";
    process.env.AI_DISABLED_FEATURES = "receipt_extraction";
    await expect(
      generateStructured(options(), { callModel }),
    ).rejects.toMatchObject({ code: "disabled" });
    expect(callModel).not.toHaveBeenCalled();
  });

  it("returns not_configured without keys", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      generateStructured(options(), { callModel: vi.fn() }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("enforces the daily per-user cap", async () => {
    process.env.AI_DAILY_CALLS_PER_USER = "3";
    vi.mocked(countRecentCalls).mockResolvedValueOnce(3);
    const callModel = vi.fn();

    await expect(
      generateStructured(options(), { callModel }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    expect(callModel).not.toHaveBeenCalled();
  });
});

describe("parseJsonReply", () => {
  it("accepts plain and fenced JSON only", () => {
    expect(parseJsonReply('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseJsonReply('Sure! {"a":1}')).toThrow();
  });
});
