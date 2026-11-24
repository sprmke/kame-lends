/**
 * Read-only tool registry.
 *
 * v1 refuses to register anything that is not `capability: "read"`. The check
 * script `scripts/check-ai-tools.mjs` also rejects writes, network, fs, and env
 * access inside `src/lib/server/ai/tools/`.
 */
import { z } from "zod";
import type {
  CalcTrace,
  ChartPoint,
  SourceRef,
  TableColumn,
  TableRow,
} from "$lib/assistant/types";
import type { ToolContext } from "./context";

export type ToolCapability = "read" | "propose" | "write";

export interface ToolResult {
  rows?: TableRow[];
  columns?: TableColumn[];
  chart?: ChartPoint[];
  calc?: CalcTrace;
  sources?: SourceRef[];
  notes?: string[];
  truncated?: boolean;
  asOf?: string;
  /** Optional one-line summary used by the deterministic fallback. */
  summary?: string;
}

export interface ToolDefinition<A = unknown> {
  name: string;
  description: string;
  args: z.ZodType<A>;
  capability: ToolCapability;
  /** Human step shown while the tool runs. */
  label: (args: A, ctx: ToolContext) => string;
  run: (args: A, ctx: ToolContext) => Promise<ToolResult>;
}

export const TOOL_ERROR_CODES = [
  "bad_args",
  "not_found",
  "ambiguous",
  "forbidden",
  "too_broad",
  "no_data",
  "unavailable",
] as const;

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

export class ToolError extends Error {
  readonly code: ToolErrorCode;
  readonly hint: string | null;

  constructor(code: ToolErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.hint = hint ?? null;
  }

  toModelResponse(): Record<string, unknown> {
    return {
      error: this.code,
      message: this.message,
      ...(this.hint ? { hint: this.hint } : {}),
    };
  }
}

export function defineTool<A>(
  definition: ToolDefinition<A>,
): ToolDefinition<A> {
  if (definition.capability !== "read") {
    throw new Error(
      `Tool ${definition.name} is ${definition.capability}; v1 only registers read tools.`,
    );
  }
  return definition;
}

/** Gemini accepts an OpenAPI subset; strip keys that make it reject a schema. */
function sanitizeSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeSchema);
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(input)) {
    if (
      key === "$schema" ||
      key === "$defs" ||
      key === "definitions" ||
      key === "additionalProperties" ||
      key === "default" ||
      key === "examples" ||
      key === "const"
    ) {
      continue;
    }
    output[key] = sanitizeSchema(child);
  }
  return output;
}

export function toolParameters(
  schema: z.ZodType<unknown>,
): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as
    Record<string, unknown> | undefined;
  const sanitized = sanitizeSchema(json ?? { type: "object", properties: {} });
  return sanitized as Record<string, unknown>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<never>>();

  constructor(definitions: ToolDefinition<unknown>[]) {
    for (const definition of definitions) {
      if (definition.capability !== "read") {
        throw new Error(
          `Refusing to register non-read tool ${definition.name}`,
        );
      }
      if (this.tools.has(definition.name)) {
        throw new Error(`Duplicate tool ${definition.name}`);
      }
      this.tools.set(
        definition.name,
        definition as unknown as ToolDefinition<never>,
      );
    }
  }

  get(name: string): ToolDefinition<never> | undefined {
    return this.tools.get(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  declarations(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: toolParameters(tool.args as z.ZodType<unknown>),
    }));
  }

  async run(
    name: string,
    rawArgs: unknown,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(
        "bad_args",
        `Unknown tool ${name}`,
        "Use only the declared tools.",
      );
    }
    if (ctx.disabledTools.has(name)) {
      throw new ToolError(
        "unavailable",
        `${name} is turned off by the operator`,
        "Answer with the tools that remain, or say it is unavailable.",
      );
    }
    const parsed = tool.args.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ToolError(
        "bad_args",
        `Invalid arguments${issue ? `: ${issue.path.join(".")} ${issue.message}` : ""}`,
        "Fix the arguments and call again once.",
      );
    }
    return tool.run(parsed.data as never, ctx);
  }
}
