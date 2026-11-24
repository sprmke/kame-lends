import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authorized: true,
  health: {
    availability: "ok" as "ok" | "unavailable",
    windowHours: 24,
    messages: 10,
    fallback: 1,
    fallbackRate: 0.1,
    costUsd: 1,
    toolCalls: 8,
    toolErrors: 1,
    toolErrorRate: 0.125,
    forbidden: 0,
  },
  emails: [] as Array<{ subject: string }>,
  emailConfigured: true,
}));

vi.mock("$lib/server/cron-auth", () => ({
  isCronAuthorized: () => state.authorized,
}));
vi.mock("$lib/server/assistant/health", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("$lib/server/assistant/health")>();
  return {
    ...actual,
    queryAssistantHealth: async () => state.health,
    getAssistantAlertThresholds: () => ({
      costUsd: 5,
      fallbackRate: 0.15,
      toolErrorRate: 0.1,
      forbidden: 20,
    }),
  };
});
vi.mock("$lib/server/email/send-email", () => ({
  isTransactionalEmailConfigured: () => state.emailConfigured,
  sendTransactionalEmail: async (input: { subject: string }) => {
    state.emails.push(input);
  },
}));
vi.mock("$lib/server/workspace-owner", () => ({
  WORKSPACE_OWNER_EMAIL: "owner@example.test",
}));

import { GET } from "./+server";

function call() {
  return GET({
    request: new Request("http://localhost/api/cron/assistant-health"),
  } as never);
}

beforeEach(() => {
  state.authorized = true;
  state.health.availability = "ok";
  state.health.toolErrors = 1;
  state.emails = [];
  state.emailConfigured = true;
});

describe("GET /api/cron/assistant-health", () => {
  it("rejects an unauthorized cron call", async () => {
    state.authorized = false;
    const response = await call();
    expect(response.status).toBe(401);
  });

  it("skips when the assistant tables are unavailable", async () => {
    state.health.availability = "unavailable";
    const response = await call();
    expect(await response.json()).toMatchObject({ skipped: true });
    expect(state.emails).toHaveLength(0);
  });

  it("emails the owner when a threshold is crossed", async () => {
    state.health.toolErrors = 8;
    state.health.toolErrorRate = 1;
    const response = await call();
    const body = (await response.json()) as {
      alerts: string[];
      emailed: boolean;
    };
    expect(body.alerts.length).toBeGreaterThan(0);
    expect(body.emailed).toBe(true);
    expect(state.emails[0].subject).toContain("Assistant health");
  });
});
