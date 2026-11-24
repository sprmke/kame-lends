import { describe, expect, it } from "vitest";
import { FactStore } from "../agent/facts";
import type { ToolContext } from "../agent/context";
import { resolvePeriodTool } from "./resolve-period";

function ctx(today = "2026-11-21"): ToolContext {
  return {
    today,
    facts: new FactStore(),
    viewer: {},
  } as unknown as ToolContext;
}

async function range(phrase: string, today = "2026-11-21") {
  const result = await resolvePeriodTool.run({ phrase }, ctx(today));
  return result.notes?.[0] ?? "";
}

describe("resolve_period", () => {
  it("resolves today, yesterday, and tomorrow", async () => {
    expect(await range("today")).toContain("2026-11-21 to 2026-11-21");
    expect(await range("yesterday")).toContain("2026-11-20 to 2026-11-20");
    expect(await range("tomorrow")).toContain("2026-11-22 to 2026-11-22");
  });

  it("resolves this week as Monday to Sunday", async () => {
    // 2026-11-21 is a Saturday.
    expect(await range("this week")).toContain("2026-11-16 to 2026-11-22");
    expect(await range("last week")).toContain("2026-11-09 to 2026-11-15");
  });

  it("resolves months with clamping", async () => {
    expect(await range("this month")).toContain("2026-11-01 to 2026-11-30");
    expect(await range("last month")).toContain("2026-10-01 to 2026-10-31");
    expect(await range("last month", "2027-03-31")).toContain(
      "2027-02-01 to 2027-02-28",
    );
  });

  it("resolves quarters and named months", async () => {
    expect(await range("Q3")).toContain("2026-07-01 to 2026-09-30");
    expect(await range("q1 2027")).toContain("2027-01-01 to 2027-03-31");
    expect(await range("march")).toContain("2026-03-01 to 2026-03-31");
  });

  it("resolves relative windows and since phrases", async () => {
    expect(await range("last 7 days")).toContain("2026-11-15 to 2026-11-21");
    expect(await range("since march")).toContain("2026-03-01 to 2026-11-21");
  });

  it("resolves ISO ranges and rejects inverted ranges", async () => {
    expect(await range("2026-11-01..2026-11-30")).toContain(
      "2026-11-01 to 2026-11-30",
    );
    await expect(range("2026-12-01..2026-11-01")).rejects.toMatchObject({
      code: "bad_args",
    });
  });

  it("rejects ranges over a year and unknown phrases", async () => {
    await expect(range("2020-01-01..2026-01-01")).rejects.toMatchObject({
      code: "too_broad",
    });
    await expect(range("sometime soon")).rejects.toMatchObject({
      code: "bad_args",
    });
  });

  it("registers date facts", async () => {
    const context = ctx();
    await resolvePeriodTool.run({ phrase: "this month" }, context);
    expect(context.facts.all().map((fact) => fact.display)).toEqual([
      "2026-11-01",
      "2026-11-30",
    ]);
  });
});
