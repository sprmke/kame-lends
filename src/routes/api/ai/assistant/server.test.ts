import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: {
    user: {
      id: "u1",
      email: "u1@example.test",
      name: "Owner",
      role: "admin",
    },
  } as { user: Record<string, unknown> } | null,
  captured: null as Record<string, unknown> | null,
  turnError: null as Error | null,
  gate: null as Promise<void> | null,
}));

vi.mock("$lib/server/session", () => ({
  getSession: vi.fn(async () => state.session),
}));
vi.mock("$lib/server/ai/client", () => ({
  runAgentTurn: vi.fn(async (input: Record<string, unknown>) => {
    state.captured = input;
    if (state.gate) await state.gate;
    if (state.turnError) throw state.turnError;
    await (input.emit as (event: unknown) => void)({ type: "text_start" });
    await (input.emit as (event: unknown) => void)({
      type: "text_delta",
      text: "Hello",
    });
  }),
}));
vi.mock("$lib/server/ai/agent/turn", () => {
  class AssistantRequestError extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly status = 400,
    ) {
      super(message);
      this.name = "AssistantRequestError";
    }
  }
  return { AssistantRequestError };
});
vi.mock("$lib/server/idempotency", () => ({
  claimIdempotencyKey: vi.fn(async () => true),
  idempotencyKeyOf: vi.fn(() => null),
  purgeExpiredIdempotencyKeys: vi.fn(),
}));

import { POST } from "./+server";
import * as idempotency from "$lib/server/idempotency";

const URL_BASE = "http://localhost/api/ai/assistant";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(URL_BASE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function event(fetchRequest: Request) {
  return { request: fetchRequest, url: new URL(URL_BASE) } as never;
}

const valid = { message: "How much is outstanding?" };

beforeEach(() => {
  state.session = {
    user: {
      id: "u1",
      email: "u1@example.test",
      name: "Owner",
      role: "admin",
    },
  };
  state.captured = null;
  state.turnError = null;
  state.gate = null;
  vi.mocked(idempotency.claimIdempotencyKey).mockResolvedValue(true);
  vi.mocked(idempotency.idempotencyKeyOf).mockReturnValue(null);
});

describe("POST /api/ai/assistant", () => {
  it("rejects an unauthenticated request", async () => {
    state.session = null;
    const response = await POST(event(request(valid)));
    expect(response.status).toBe(401);
  });

  it("rejects a cross-origin request before running a turn", async () => {
    const response = await POST(
      event(request(valid, { origin: "https://evil.example" })),
    );
    expect(response.status).toBe(403);
    expect(state.captured).toBeNull();
  });

  it("rejects an invalid body", async () => {
    const response = await POST(event(request({ message: "" })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "bad_request" });
  });

  it("returns SSE events and the parsed request context", async () => {
    const response = await POST(event(request(valid)));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain('data: {"type":"text_start"}');
    expect(body).toContain('data: {"type":"text_delta","text":"Hello"}');
    expect(state.captured).toMatchObject({
      userId: "u1",
      role: "admin",
      message: "How much is outstanding?",
      pins: undefined,
      page: null,
    });
  });

  it("turns a duplicate idempotency key into a 409", async () => {
    vi.mocked(idempotency.idempotencyKeyOf).mockReturnValue("duplicate-key");
    vi.mocked(idempotency.claimIdempotencyKey).mockResolvedValue(false);
    const response = await POST(event(request(valid)));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "duplicate" });
  });

  it("allows one live stream per user", async () => {
    let release: () => void = () => undefined;
    state.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = await POST(event(request(valid)));
    const second = await POST(event(request(valid)));
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({ code: "busy" });
    release();
    expect(await first.text()).toContain('"type":"text_start"');
  });

  it("emits a typed error event when the turn rejects", async () => {
    const { AssistantRequestError } = await import("$lib/server/ai/agent/turn");
    state.turnError = new AssistantRequestError(
      "quota_exceeded",
      "Daily limit reached",
      429,
    );
    const response = await POST(event(request(valid)));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('"code":"quota_exceeded"');
    expect(body).toContain('"message":"Daily limit reached"');
  });
});
