import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ToolError,
  ToolRegistry,
  defineTool,
  toolParameters,
  type ToolDefinition,
} from "./registry";
import type { ToolContext } from "./context";
import { assistantRegistry } from "../tools";

const ctx = { disabledTools: new Set<string>() } as unknown as ToolContext;

const readTool = defineTool({
  name: "demo_read",
  description: "demo",
  capability: "read",
  args: z.object({ id: z.number().int().positive() }).strict(),
  label: () => "demo",
  run: async (args) => ({ notes: [`id ${args.id}`] }),
});

describe("defineTool", () => {
  it("refuses a write tool at definition time", () => {
    expect(() =>
      defineTool({
        name: "bad",
        description: "bad",
        capability: "write",
        args: z.object({}),
        label: () => "bad",
        run: async () => ({}),
      }),
    ).toThrow(/only registers read tools/);
  });
});

describe("ToolRegistry", () => {
  it("refuses a write definition in the constructor", () => {
    const write = {
      name: "write_thing",
      description: "x",
      capability: "write",
      args: z.object({}),
      label: () => "x",
      run: async () => ({}),
    } as unknown as ToolDefinition<unknown>;
    expect(() => new ToolRegistry([write])).toThrow(/Refusing/);
  });

  it("rejects duplicate names", () => {
    expect(
      () => new ToolRegistry([readTool as never, readTool as never]),
    ).toThrow(/Duplicate/);
  });

  it("validates args strictly and returns a hint", async () => {
    const registry = new ToolRegistry([readTool as never]);
    await expect(
      registry.run("demo_read", { id: 0 }, ctx),
    ).rejects.toMatchObject({
      code: "bad_args",
    });
    await expect(
      registry.run("demo_read", { id: 1, extra: true }, ctx),
    ).rejects.toBeInstanceOf(ToolError);
  });

  it("does not run a disabled tool", async () => {
    const registry = new ToolRegistry([readTool as never]);
    const disabled = {
      ...ctx,
      disabledTools: new Set(["demo_read"]),
    } as unknown as ToolContext;
    await expect(
      registry.run("demo_read", { id: 1 }, disabled),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("runs a valid read and returns its result", async () => {
    const registry = new ToolRegistry([readTool as never]);
    await expect(registry.run("demo_read", { id: 4 }, ctx)).resolves.toEqual({
      notes: ["id 4"],
    });
  });
});

describe("toolParameters", () => {
  it("strips keys Gemini rejects", () => {
    const schema = toolParameters(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["a", "b"]).optional(),
      }),
    );
    expect(schema.$schema).toBeUndefined();
    expect(schema.additionalProperties).toBeUndefined();
    expect(JSON.stringify(schema)).toContain("enum");
  });
});

describe("assistant registry", () => {
  it("registers every catalog tool as read-only", () => {
    expect(assistantRegistry.names()).toEqual(
      expect.arrayContaining([
        "resolve_period",
        "find_party",
        "get_borrower_position",
        "list_loans",
        "get_loan",
        "get_portfolio_summary",
        "get_upcoming_dues",
        "list_overdue",
        "get_loan_schedule",
        "get_loan_payments",
        "list_payments",
        "get_investor_position",
        "get_interest_summary",
        "get_cashflow",
        "list_debts",
        "get_debt",
        "list_groups",
        "get_group_summary",
        "get_commission_summary",
        "get_data_health",
        "simulate_interest",
        "calculate",
        "open_page",
        "search_help",
        "read_receipt_image",
      ]),
    );
    expect(assistantRegistry.declarations().length).toBeGreaterThan(20);
  });

  it("has no tool with a non-read capability", () => {
    for (const name of assistantRegistry.names()) {
      const tool = assistantRegistry.get(name);
      expect(tool?.capability).toBe("read");
    }
  });
});
