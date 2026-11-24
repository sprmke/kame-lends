import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/read-env", () => ({
  readEnv: (name: string) => process.env[name],
}));

import {
  getAiStatus,
  getAssistantLimits,
  getAssistantRollout,
  getDailyCallLimit,
  getDisabledFeatures,
  getDisabledTools,
  isAssistantRolloutAllowed,
  isAiKillSwitchOn,
} from "./config";

const MANAGED = [
  "GEMINI_API_KEY",
  "GEMINI_API_KEYS",
  "GROQ_API_KEY",
  "AI_ENABLED",
  "AI_DISABLED_FEATURES",
  "AI_DISABLED_TOOLS",
  "AI_DAILY_CALLS_PER_USER",
  "AI_ASSISTANT_ROLLOUT",
  "AI_ASSISTANT_DAILY_TURNS_PER_USER",
  "AI_DAILY_COST_USD_PER_USER",
  "AI_ASSISTANT_TURN_TOKEN_CEILING",
  "AI_ASSISTANT_RETENTION_DAYS",
  "AI_ASSISTANT_MAX_ROUNDS",
  "AI_ASSISTANT_MAX_TOOLS_PER_ROUND",
  "AI_ASSISTANT_DEADLINE_MS",
  "AI_ASSISTANT_MAX_OUTPUT_CHARS",
];

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of MANAGED) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("AI status and kill switches", () => {
  it("reports both features off without keys", () => {
    expect(getAiStatus("admin")).toMatchObject({
      enabled: false,
      reason: "not_configured",
      features: { receipt_extraction: false, assistant_chat: false },
    });
  });

  it("gates the assistant to admins under owner rollout", () => {
    process.env.GEMINI_API_KEY = "key";
    expect(getAiStatus("admin").features).toMatchObject({
      receipt_extraction: true,
      assistant_chat: true,
    });
    expect(getAiStatus("investor").features).toMatchObject({
      receipt_extraction: true,
      assistant_chat: false,
    });
    expect(getAssistantRollout()).toBe("owner");
    expect(isAssistantRolloutAllowed("admin")).toBe(true);
    expect(isAssistantRolloutAllowed("investor")).toBe(false);
  });

  it("opens the assistant to everyone under all rollout", () => {
    process.env.GEMINI_API_KEY = "key";
    process.env.AI_ASSISTANT_ROLLOUT = "all";
    expect(getAiStatus(null).features.assistant_chat).toBe(true);
    expect(isAssistantRolloutAllowed(null)).toBe(true);
  });

  it("honours the global kill switch and per-feature disable list", () => {
    process.env.GEMINI_API_KEY = "key";
    process.env.AI_ENABLED = "false";
    process.env.AI_DISABLED_FEATURES = "assistant_chat, receipt_extraction";
    expect(isAiKillSwitchOn()).toBe(true);
    expect(getDisabledFeatures()).toEqual(
      new Set(["assistant_chat", "receipt_extraction"]),
    );
    const status = getAiStatus("admin");
    expect(status.enabled).toBe(false);
    expect(status.reason).toBe("disabled");
    expect(status.features.assistant_chat).toBe(false);
  });

  it("keeps the assistant off when only Groq is configured", () => {
    process.env.GROQ_API_KEY = "groq";
    const status = getAiStatus("admin");
    expect(status.enabled).toBe(true);
    expect(status.features.receipt_extraction).toBe(true);
    expect(status.features.assistant_chat).toBe(false);
  });

  it("parses the disabled tool list", () => {
    process.env.AI_DISABLED_TOOLS = "get_data_health, simulate_interest";
    expect(getDisabledTools()).toEqual(
      new Set(["get_data_health", "simulate_interest"]),
    );
  });
});

describe("assistant limits", () => {
  it("uses safe defaults", () => {
    expect(getAssistantLimits()).toMatchObject({
      maxRounds: 6,
      maxToolsPerRound: 8,
      deadlineMs: 50_000,
      tokenCeiling: 60_000,
      dailyTurns: 60,
      dailyCostUsd: 1,
      retentionDays: 90,
    });
    expect(getDailyCallLimit()).toBe(300);
  });

  it("clamps invalid and negative values to defaults", () => {
    process.env.AI_ASSISTANT_MAX_ROUNDS = "0";
    process.env.AI_ASSISTANT_DEADLINE_MS = "-1";
    process.env.AI_DAILY_COST_USD_PER_USER = "-5";
    process.env.AI_DAILY_CALLS_PER_USER = "not-a-number";
    const limits = getAssistantLimits();
    expect(limits.maxRounds).toBe(6);
    expect(limits.deadlineMs).toBe(50_000);
    expect(limits.dailyCostUsd).toBe(1);
    expect(getDailyCallLimit()).toBe(300);
  });

  it("accepts explicit values, including zero for unlimited caps", () => {
    process.env.AI_ASSISTANT_MAX_ROUNDS = "3";
    process.env.AI_ASSISTANT_DAILY_TURNS_PER_USER = "0";
    process.env.AI_DAILY_COST_USD_PER_USER = "0";
    process.env.AI_DAILY_CALLS_PER_USER = "0";
    const limits = getAssistantLimits();
    expect(limits.maxRounds).toBe(3);
    expect(limits.dailyTurns).toBe(0);
    expect(limits.dailyCostUsd).toBe(0);
    expect(getDailyCallLimit()).toBe(0);
  });
});
