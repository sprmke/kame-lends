import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { QUICK_TOOLS, starterPrompts } from "$lib/assistant/quick-tools";
import { assistantRegistry } from "$lib/server/ai/tools";
import { selectionSchema } from "../../../scripts/evals/run-assistant-evals";

const dataset = readFileSync(
  join(process.cwd(), "evals/assistant/tool-selection.jsonl"),
  "utf8",
)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => selectionSchema.parse(JSON.parse(line)));

describe("quick tools", () => {
  it("has a unique id, label, and prompt for every tool", () => {
    expect(new Set(QUICK_TOOLS.map((tool) => tool.id)).size).toBe(
      QUICK_TOOLS.length,
    );
    for (const tool of QUICK_TOOLS) {
      expect(tool.label.trim().length).toBeGreaterThan(0);
      expect(tool.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("covers every quick tool with a tool-selection eval case", () => {
    const questions = new Set(
      dataset.map((item) => item.question.toLowerCase()),
    );
    for (const tool of QUICK_TOOLS) {
      expect(
        questions.has(tool.prompt.toLowerCase()),
        `missing eval case for quick tool ${tool.id}`,
      ).toBe(true);
    }
  });

  it("gives every page a non-empty starter set", () => {
    for (const page of [
      null,
      "/loans/12",
      "/borrowers/4",
      "/investors/9",
      "/dashboard",
    ]) {
      const starters = starterPrompts({ page, isOwner: true });
      expect(starters.length).toBeGreaterThanOrEqual(4);
      for (const starter of starters) {
        expect(starter.label.trim().length).toBeGreaterThan(0);
        expect(starter.prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("tool catalog contracts", () => {
  it("rejects unknown arguments for every tool", () => {
    for (const name of assistantRegistry.names()) {
      const tool = assistantRegistry.get(name);
      expect(tool, name).toBeDefined();
      const parsed = (tool!.args as z.ZodType<unknown>).safeParse({
        __unexpected: true,
      });
      expect(parsed.success, `${name} accepted an unknown argument`).toBe(
        false,
      );
    }
  });

  it("declares an object schema with a name and description", () => {
    for (const declaration of assistantRegistry.declarations()) {
      expect(declaration.name).toMatch(/^[a-z][a-z_]+$/);
      expect(declaration.description.length).toBeGreaterThan(20);
      expect(declaration.parameters.type).toBe("object");
    }
  });
});
