import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantEvent, ToolArtifact } from "$lib/assistant/types";
import type { LoopResult } from "./loop";

const state = vi.hoisted(() => ({
  messages: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ id: string; patch: Record<string, unknown> }>,
  deletedReplies: [] as Array<{ conversationId: string; after: string }>,
  loopCalls: [] as Array<{ history: unknown[]; message: string }>,
  loopImpls: [] as Array<
    (options: unknown) => LoopResult | Promise<LoopResult>
  >,
  updatesConversation: 0,
  usage: [] as Array<Record<string, unknown>>,
  limits: {
    maxRounds: 6,
    maxToolsPerRound: 8,
    deadlineMs: 50_000,
    tokenCeiling: 60_000,
    dailyTurns: 60,
    dailyCostUsd: 1,
    retentionDays: 90,
    maxOutputChars: 16_000,
  },
}));

vi.mock("../client", () => ({ assertFeatureEnabled: vi.fn() }));

vi.mock("../config", () => ({
  getAssistantLimits: () => state.limits,
  isAssistantRolloutAllowed: (role?: string | null) => role === "admin",
}));

vi.mock("../usage", () => ({
  countAssistantTurns: vi.fn(async () => 0),
  getDailyCostUsd: vi.fn(async () => 0),
  recordAiUsage: vi.fn(async (row: Record<string, unknown>) => {
    state.usage.push(row);
  }),
}));

vi.mock("../receipt-extraction", () => ({
  MAX_RECEIPT_IMAGE_BYTES: 5_000_000,
  decodeImageDataUrl: () => null,
  extractReceipt: vi.fn(),
}));
vi.mock("$lib/server/receipt-references", () => ({
  findRecordedReferences: vi.fn(async () => []),
}));
vi.mock("$lib/receipt-extraction-types", () => ({
  receiptTransactions: () => [],
}));
vi.mock("$lib/receipt-scan/sanity", () => ({
  receiptSanityWarnings: () => [],
}));
vi.mock("$lib/server/receipt-scan-context", () => ({
  resolveReceiptScanParties: async () => ({
    lenderNames: [],
    borrowerName: null,
  }),
}));
vi.mock("$lib/server/access-control", () => ({
  hasInvestorContactViewAccess: async () => true,
  hasWitnessContactViewAccess: async () => true,
}));

vi.mock("../tools", () => ({
  assistantRegistry: {
    names: () => ["get_loan"],
    get: () => undefined,
  },
}));

vi.mock("./context", () => ({
  createToolContext: (input: {
    facts: unknown;
    viewer?: unknown;
    deadlineAt: number;
  }) => {
    const artifacts: ToolArtifact[] = [];
    return {
      userId: "u1",
      email: null,
      role: "admin",
      today: "2026-11-21",
      page: null,
      pins: [],
      locale: "en",
      facts: input.facts,
      viewer: { loans: async () => [], allLoans: async () => [] },
      artifacts,
      disabledTools: new Set<string>(),
      deadlineAt: input.deadlineAt,
      addArtifact(artifact: ToolArtifact) {
        artifacts.push(artifact);
      },
    };
  },
}));

vi.mock("./loop", () => ({
  runAssistantLoop: vi.fn(async (options: unknown) => {
    const typed = options as {
      history: unknown[];
      message: string;
      ctx: {
        facts: { addMoney: (value: number, label: string) => void };
        addArtifact: (artifact: ToolArtifact) => void;
        artifacts: ToolArtifact[];
      };
    };
    state.loopCalls.push({
      history: [...typed.history],
      message: typed.message,
    });
    const impl = state.loopImpls.shift();
    if (impl) return impl(options);
    typed.ctx.facts.addMoney(10_000, "Outstanding balance");
    typed.ctx.addArtifact({
      name: "get_loan",
      label: "Opening loan",
      rows: [],
      columns: [],
      sources: [{ type: "loan", id: 1, label: "Loan 1", href: "/loans/1" }],
      notes: ["1 loan."],
    });
    return {
      text: "The balance is {{f1}}.",
      rounds: 1,
      tokensIn: 10,
      tokensOut: 5,
      modelMs: [1],
      toolMs: [],
      steps: [],
      artifacts: typed.ctx.artifacts ?? [],
      exhausted: false,
      finishReason: "STOP",
      provider: "gemini",
      model: "gemini-test",
    } satisfies LoopResult;
  }),
}));

vi.mock("../assistant/store", () => {
  class AssistantStoreUnavailable extends Error {}
  return {
    AssistantStoreUnavailable,
    createConversation: vi.fn(
      async (_userId: string, title: string, pins: unknown[]) => ({
        id: "conv-1",
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pins,
      }),
    ),
    getConversation: vi.fn(async () => ({ id: "conv-1", title: "Thread" })),
    listMessages: vi.fn(async () => state.messages),
    newMessage: vi.fn(async (input: Record<string, unknown>) => {
      const row = {
        id: `msg-${state.messages.length + 1}`,
        status: input.status ?? "complete",
        text: input.text ?? "",
        blocks: input.blocks ?? [],
        attachments: input.attachments ?? [],
        toolTrace: input.toolTrace ?? [],
        feedback: null,
        createdAt: new Date().toISOString(),
        role: input.role,
        conversationId: input.conversationId,
        userId: input.userId,
      };
      state.messages.push(row);
      return row;
    }),
    updateMessage: vi.fn(
      async (id: string, _userId: string, patch: Record<string, unknown>) => {
        state.updates.push({ id, patch });
        const row = state.messages.find((message) => message.id === id);
        if (row) Object.assign(row, patch);
      },
    ),
    addToolCall: vi.fn(async () => undefined),
    touchConversation: vi.fn(async () => {
      state.updatesConversation += 1;
    }),
    updateConversationPins: vi.fn(async () => undefined),
    maybePurgeExpired: vi.fn(),
    deleteAssistantRepliesAfter: vi.fn(
      async (_userId: string, conversationId: string, after: Date) => {
        state.deletedReplies.push({
          conversationId,
          after: after.toISOString(),
        });
        return 1;
      },
    ),
    setMessageFeedback: vi.fn(async () => true),
    latestAssistantMessage: vi.fn(async () => null),
  };
});

import { runAssistantTurn } from "./turn";
import type { TurnInput } from "./turn";

function callInput(
  overrides: Partial<TurnInput> = {},
): TurnInput & { events: AssistantEvent[] } {
  const events: AssistantEvent[] = [];
  return {
    userId: "u1",
    email: "u1@example.test",
    role: "admin",
    displayName: "Owner",
    message: "How much is outstanding?",
    pins: [],
    page: null,
    emit: (event: AssistantEvent) => {
      events.push(event);
    },
    events,
    ...overrides,
  } as TurnInput & { events: AssistantEvent[] };
}

describe("runAssistantTurn guards", () => {
  beforeEach(() => {
    state.messages = [];
    state.updates = [];
    state.deletedReplies = [];
    state.loopCalls = [];
    state.loopImpls = [];
    state.updatesConversation = 0;
    state.usage = [];
  });

  it("refuses an account outside the rollout before touching storage", async () => {
    const value = callInput({ role: "investor" });
    await expect(runAssistantTurn(value)).rejects.toMatchObject({
      code: "rollout",
      status: 403,
    });
    expect(state.messages).toHaveLength(0);
  });

  it("rejects an empty question", async () => {
    const value = callInput({ message: "   " });
    await expect(runAssistantTurn(value)).rejects.toMatchObject({
      code: "bad_request",
    });
  });

  it("rejects an over-long question", async () => {
    const value = callInput({ message: "x".repeat(2_001) });
    await expect(runAssistantTurn(value)).rejects.toMatchObject({
      code: "too_long",
    });
  });

  it("rejects more than eight pins", async () => {
    const value = callInput({
      pins: Array.from({ length: 9 }, (_, index) => ({
        type: "loan",
        id: index + 1,
      })),
    });
    await expect(runAssistantTurn(value)).rejects.toMatchObject({
      code: "bad_pins",
    });
  });

  it("enforces the daily turn cap", async () => {
    const usage = await import("../usage");
    vi.mocked(usage.countAssistantTurns).mockResolvedValueOnce(60);
    const value = callInput();
    await expect(runAssistantTurn(value)).rejects.toMatchObject({
      code: "quota_exceeded",
      status: 429,
    });
  });

  it("enforces the daily cost cap", async () => {
    const usage = await import("../usage");
    vi.mocked(usage.getDailyCostUsd).mockResolvedValueOnce(2);
    const value = callInput();
    await expect(runAssistantTurn(value)).rejects.toMatchObject({
      code: "quota_exceeded",
      status: 429,
    });
  });
});

describe("runAssistantTurn pipeline", () => {
  beforeEach(() => {
    state.messages = [];
    state.updates = [];
    state.deletedReplies = [];
    state.loopCalls = [];
    state.loopImpls = [];
    state.usage = [];
    state.limits = {
      maxRounds: 6,
      maxToolsPerRound: 8,
      deadlineMs: 50_000,
      tokenCeiling: 60_000,
      dailyTurns: 60,
      dailyCostUsd: 1,
      retentionDays: 90,
      maxOutputChars: 16_000,
    };
  });

  it("emits turn_started, streamed text, and blocks, then persists", async () => {
    const value = callInput();
    const result = await runAssistantTurn(value);
    expect(result.conversationId).toBe("conv-1");
    const types = value.events.map((event) => event.type);
    expect(types[0]).toBe("turn_started");
    expect(types).toContain("text_start");
    expect(types).toContain("text_delta");
    const blocks = value.events.at(-1);
    expect(blocks?.type).toBe("blocks");
    if (blocks?.type === "blocks") {
      expect(blocks.guardMode).toBe("ok");
      expect(blocks.text).toContain("₱100.00");
      expect(blocks.blocks.some((block) => block.type === "stat_list")).toBe(
        true,
      );
    }
    const update = state.updates.at(-1);
    expect(update?.patch.status).toBe("complete");
    expect(update?.patch.guardMode).toBe("ok");
    expect(state.usage.at(-1)?.feature).toBe("assistant_chat");
  });

  it("regenerates once, then falls back when the model keeps typing numbers", async () => {
    state.loopImpls.push((options) => {
      const typed = options as {
        ctx: {
          facts: { addMoney: (value: number, label: string) => void };
          addArtifact: (artifact: ToolArtifact) => void;
          artifacts: ToolArtifact[];
        };
      };
      typed.ctx.facts.addMoney(10_000, "Outstanding balance");
      typed.ctx.addArtifact({
        name: "get_loan",
        label: "Opening loan",
        rows: [],
        sources: [],
        notes: ["1 loan."],
      });
      return {
        text: "The balance is ₱100.00.",
        rounds: 1,
        tokensIn: 10,
        tokensOut: 5,
        modelMs: [1],
        toolMs: [],
        steps: [],
        artifacts: typed.ctx.artifacts ?? [],
        exhausted: false,
        finishReason: "STOP",
        provider: "gemini",
        model: "gemini-test",
      };
    });
    state.loopImpls.push((options) => {
      const typed = options as {
        ctx: {
          facts: { addMoney: (value: number, label: string) => void };
          addArtifact: (artifact: ToolArtifact) => void;
          artifacts: ToolArtifact[];
        };
      };
      typed.ctx.facts.addMoney(10_000, "Outstanding balance");
      typed.ctx.addArtifact({
        name: "get_loan",
        label: "Opening loan",
        rows: [],
        sources: [],
        notes: ["1 loan."],
      });
      return {
        text: "Still ₱100.00.",
        rounds: 1,
        tokensIn: 10,
        tokensOut: 5,
        modelMs: [1],
        toolMs: [],
        steps: [],
        artifacts: typed.ctx.artifacts ?? [],
        exhausted: false,
        finishReason: "STOP",
        provider: "gemini",
        model: "gemini-test",
      };
    });

    const value = callInput();
    await runAssistantTurn(value);
    expect(state.loopCalls).toHaveLength(2);
    const blocks = value.events.at(-1);
    expect(blocks?.type).toBe("blocks");
    if (blocks?.type === "blocks") {
      expect(blocks.guardMode).toBe("fallback");
      expect(blocks.text).not.toContain("₱100.00");
    }
    expect(state.updates.at(-1)?.patch.guardMode).toBe("fallback");
  });

  it("regenerate replaces the prior answer and keeps only the answered question in history", async () => {
    state.messages = [
      {
        id: "user-1",
        role: "user",
        status: "complete",
        text: "Old question",
        blocks: [],
        attachments: [],
        createdAt: new Date(Date.now() - 10_000).toISOString(),
        feedback: null,
      },
      {
        id: "assistant-1",
        role: "assistant",
        status: "complete",
        text: "Old answer",
        blocks: [],
        attachments: [],
        createdAt: new Date(Date.now() - 9_000).toISOString(),
        feedback: null,
      },
    ];
    const value = callInput({ regenerate: true, message: "regenerate" });
    await runAssistantTurn(value);
    expect(state.deletedReplies).toHaveLength(1);
    expect(state.deletedReplies[0].conversationId).toBe("conv-1");
    expect(state.loopCalls[0].message).toBe("Old question");
    const historyText = JSON.stringify(state.loopCalls[0].history);
    expect(historyText).not.toContain("Old answer");
  });
});
