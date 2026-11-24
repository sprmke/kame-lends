import { describe, expect, it } from "vitest";
import { createToolContext } from "./context";
import { FactStore } from "./facts";

describe("createToolContext", () => {
  it("registers an as-of date fact once", () => {
    const facts = new FactStore();
    const context = createToolContext({
      userId: "u1",
      email: null,
      role: "admin",
      page: null,
      pins: [],
      facts,
      today: "2026-11-21",
      deadlineAt: Date.now() + 1_000,
    });
    const asOf = facts.all().filter((fact) => fact.label === "As of");
    expect(asOf).toHaveLength(1);
    expect(asOf[0].value).toBe("2026-11-21");
    expect(asOf[0].display).toBe("Nov 21, 2026");
    expect(context.facts).toBe(facts);
    expect(context.viewer.userId).toBe("u1");
  });
});
