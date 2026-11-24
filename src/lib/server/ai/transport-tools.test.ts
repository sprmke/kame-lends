import { beforeEach, describe, expect, it, vi } from "vitest";

const keys = vi.hoisted(() => ({ value: ["k1", "k2"] as string[] }));

vi.mock("./config", () => ({
  getGeminiApiKeys: () => keys.value,
  getGroqApiKey: () => null,
}));

import { AI_FEATURE_ROUTES } from "./features";
import {
  callModelWithTools,
  resetKeyRotationForTests,
  streamModelWithTools,
  type GeminiContent,
  type TransportDeps,
  type ToolTransportRequest,
} from "./transport";
import { AiGatewayError } from "./errors";

const route = AI_FEATURE_ROUTES.assistant_chat;

function deps(fetchImpl: typeof fetch): TransportDeps {
  return {
    fetch: fetchImpl,
    sleep: async () => undefined,
    now: () => Date.now(),
    random: () => 0.5,
  };
}

function bodyOf(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

function toolRequest(): ToolTransportRequest {
  const contents: GeminiContent[] = [
    { role: "user", parts: [{ text: "How much is outstanding?" }] },
  ];
  return {
    route,
    system: "system",
    contents,
    tools: [
      {
        name: "get_loan",
        description: "One loan",
        parameters: {
          type: "object",
          properties: { loanId: { type: "number" } },
        },
      },
    ],
    toolMode: "AUTO",
    deadlineMs: 30_000,
  };
}

function toolReply() {
  return {
    candidates: [
      {
        content: {
          parts: [
            { text: "thinking", thought: true, thoughtSignature: "sig-1" },
            {
              functionCall: {
                id: "call-1",
                name: "get_loan",
                args: { loanId: 1 },
              },
            },
          ],
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 21,
      candidatesTokenCount: 8,
      thoughtsTokenCount: 3,
    },
  };
}

beforeEach(() => {
  keys.value = ["k1", "k2"];
  resetKeyRotationForTests();
});

describe("callModelWithTools", () => {
  it("sends function declarations, the tool mode, and the key in a header", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        captured = { url: String(input), init: init ?? {} };
        return new Response(JSON.stringify(toolReply()), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    ) as unknown as typeof fetch;

    const result = await callModelWithTools(toolRequest(), deps(fetchMock));

    expect(result.text).toBe("");
    expect(result.parts[0].thoughtSignature).toBe("sig-1");
    expect(result.parts[1].functionCall).toEqual({
      id: "call-1",
      name: "get_loan",
      args: { loanId: 1 },
    });
    expect(result.usage).toEqual({ inputTokens: 21, outputTokens: 11 });
    expect(result.finishReason).toBe("STOP");

    const headers = new Headers(captured!.init.headers);
    expect(headers.get("x-goog-api-key")).toBeTruthy();
    expect(captured!.url).not.toContain("key=");
    const body = bodyOf(captured!.init);
    expect(body.tools).toEqual([
      {
        functionDeclarations: [
          {
            name: "get_loan",
            description: "One loan",
            parameters: {
              type: "object",
              properties: { loanId: { type: "number" } },
            },
          },
        ],
      },
    ]);
    expect(body.toolConfig).toEqual({
      functionCallingConfig: { mode: "AUTO" },
    });
  });

  it("retries a 429 with the next key and returns the success", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      if (urls.length === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return new Response(JSON.stringify(toolReply()), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await callModelWithTools(toolRequest(), deps(fetchMock));
    expect(result.parts.length).toBe(2);
    expect(urls.length).toBeGreaterThanOrEqual(2);
  });

  it("rotates on an auth failure and then succeeds", async () => {
    let count = 0;
    const fetchMock = vi.fn(async () => {
      count += 1;
      if (count === 1) {
        return new Response(
          JSON.stringify({ error: { message: "API_KEY_INVALID" } }),
          {
            status: 400,
          },
        );
      }
      return new Response(JSON.stringify(toolReply()), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await callModelWithTools(toolRequest(), deps(fetchMock));
    expect(result.provider).toBe("gemini");
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("throws aborted when the signal is already set", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      callModelWithTools(
        { ...toolRequest(), signal: controller.signal },
        deps(async () => new Response("{}") as never),
      ),
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("throws aborted when the caller aborts during fetch", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    }) as unknown as typeof fetch;
    await expect(
      callModelWithTools(
        { ...toolRequest(), signal: controller.signal },
        deps(fetchMock),
      ),
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("throws not_configured without a Gemini key", async () => {
    keys.value = [];
    await expect(
      callModelWithTools(
        toolRequest(),
        deps(async () => new Response("{}") as never),
      ),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("rejects an empty candidate list", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(
      callModelWithTools(toolRequest(), deps(fetchMock)),
    ).rejects.toBeInstanceOf(AiGatewayError);
  });
});

describe("streamModelWithTools", () => {
  function sseBody(chunks: string[]): Response {
    const encoder = new TextEncoder();
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }

  const events = [
    {
      candidates: [
        {
          content: {
            parts: [{ text: "The balance is ", thoughtSignature: "sig-2" }],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 30 },
    },
    {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  id: "call-2",
                  name: "get_loan",
                  args: { loanId: 1 },
                },
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { candidatesTokenCount: 12, thoughtsTokenCount: 2 },
    },
  ];

  it("streams deltas and returns the full parts and usage", async () => {
    const sse = events
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");
    // Split mid-event to prove the buffer holds a partial SSE block.
    const cut = Math.floor(sse.length / 2);
    const fetchMock = vi.fn(async () =>
      sseBody([sse.slice(0, cut), sse.slice(cut)]),
    ) as unknown as typeof fetch;

    const deltas: string[] = [];
    const result = await streamModelWithTools(
      { ...toolRequest(), tools: undefined, toolMode: undefined },
      {
        onDelta: (delta) => {
          deltas.push(delta.text);
        },
      },
      deps(fetchMock),
    );

    expect(deltas.join("")).toBe("The balance is ");
    expect(result.text).toBe("The balance is ");
    expect(result.parts[0].thoughtSignature).toBe("sig-2");
    expect(result.parts[1].functionCall?.name).toBe("get_loan");
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 14 });
    expect(result.finishReason).toBe("STOP");
  });

  it("throws not_configured without a key", async () => {
    keys.value = [];
    await expect(
      streamModelWithTools(
        toolRequest(),
        { onDelta: () => undefined },
        deps(async () => sseBody([])),
      ),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("throws aborted when the caller aborts mid-stream", async () => {
    const controller = new AbortController();
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                candidates: [{ content: { parts: [{ text: "partial" }] } }],
              })}\n\n`,
            ),
          );
          controller.signal.addEventListener("abort", () => {
            streamController.error(new DOMException("Aborted", "AbortError"));
          });
        },
      });
      return new Response(stream, { status: 200 });
    }) as unknown as typeof fetch;

    const run = streamModelWithTools(
      { ...toolRequest(), signal: controller.signal },
      { onDelta: () => controller.abort() },
      deps(fetchMock),
    );
    await expect(run).rejects.toMatchObject({ code: "aborted" });
  });
});
