import { describe, expect, it } from "vitest";
import { assistantAlerts, type AssistantHealth } from "./health";

const base: AssistantHealth = {
  availability: "ok",
  windowHours: 24,
  messages: 100,
  fallback: 5,
  fallbackRate: 0.05,
  costUsd: 1,
  toolCalls: 80,
  toolErrors: 2,
  toolErrorRate: 0.025,
  forbidden: 0,
};

const thresholds = {
  costUsd: 5,
  fallbackRate: 0.15,
  toolErrorRate: 0.1,
  forbidden: 20,
};

describe("assistantAlerts", () => {
  it("stays quiet below every threshold", () => {
    expect(assistantAlerts(base, thresholds)).toEqual([]);
  });

  it("reports cost, fallback, tool errors, and forbidden probes", () => {
    const alerts = assistantAlerts(
      {
        ...base,
        costUsd: 9,
        fallbackRate: 0.4,
        fallback: 40,
        toolErrorRate: 0.5,
        toolErrors: 40,
        forbidden: 50,
      },
      thresholds,
    );
    expect(alerts).toHaveLength(4);
    expect(alerts.join(" ")).toContain("Estimated cost");
    expect(alerts.join(" ")).toContain("Fallback rate");
    expect(alerts.join(" ")).toContain("Tool error rate");
    expect(alerts.join(" ")).toContain("forbidden tool calls");
  });

  it("does not divide by zero on an idle day", () => {
    expect(
      assistantAlerts(
        {
          ...base,
          messages: 0,
          fallback: 0,
          fallbackRate: 0,
          toolCalls: 0,
          toolErrors: 0,
          toolErrorRate: 0,
        },
        thresholds,
      ),
    ).toEqual([]);
  });

  it("skips when the assistant tables are unavailable", () => {
    expect(
      assistantAlerts({ ...base, availability: "unavailable" }, thresholds),
    ).toEqual([]);
  });
});
