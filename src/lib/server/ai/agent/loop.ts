/**
 * Bounded agent loop (ADR-1). Non-streaming planning rounds execute read tools,
 * then the final prose is emitted through the SSE pipeline. Every ceiling is
 * enforced here: rounds, tools per round, wall clock, tokens, abort.
 */
import { AiGatewayError } from "../errors";
import {
  callModelWithTools,
  type GeminiContent,
  type GeminiPart,
  type ToolTransportResult,
} from "../transport";
import { resolveFeatureRoute } from "../features";
import type {
  AssistantPhase,
  Fact,
  ToolArtifact,
  ToolStep,
} from "$lib/assistant/types";
import type { ToolContext } from "./context";
import { ToolError, type ToolRegistry } from "./registry";

export interface LoopOptions {
  ctx: ToolContext;
  registry: ToolRegistry;
  system: string;
  history: GeminiContent[];
  message: string;
  image?: { mimeType: string; base64: string };
  maxRounds: number;
  maxToolsPerRound: number;
  tokenCeiling: number;
  deadlineAt: number;
  signal?: AbortSignal;
  onPhase?: (phase: AssistantPhase) => void;
  onToolStart?: (step: ToolStep) => void;
  onToolDone?: (step: ToolStep) => void;
}

export interface LoopResult {
  text: string;
  rounds: number;
  tokensIn: number;
  tokensOut: number;
  modelMs: number[];
  toolMs: number[];
  steps: ToolStep[];
  artifacts: ToolArtifact[];
  exhausted: boolean;
  finishReason: string | null;
  provider: string;
  model: string;
}

function currentUserContent(
  message: string,
  image?: { mimeType: string; base64: string },
): GeminiContent {
  const parts: GeminiPart[] = [
    {
      text: `<untrusted_data>${message}</untrusted_data>`,
    },
  ];
  if (image) {
    parts.push({
      inlineData: { mimeType: image.mimeType, data: image.base64 },
    });
  }
  return { role: "user", parts };
}

function functionCallsOf(result: ToolTransportResult): Array<{
  id?: string;
  name: string;
  args: Record<string, unknown>;
}> {
  return result.parts
    .map((part) => part.functionCall)
    .filter((call): call is NonNullable<typeof call> => Boolean(call))
    .map((call) => ({
      id: call.id,
      name: call.name,
      args: (call.args ?? {}) as Record<string, unknown>,
    }));
}

function clipText(value: string, max = 240): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

/** Database and image text is data, never instructions. */
function fence(value: string): string {
  return `<untrusted_data>${value}</untrusted_data>`;
}

function compactToolResponse(
  artifact: ToolArtifact,
  facts: Fact[],
): Record<string, unknown> {
  const clippedRows = (artifact.rows ?? [])
    .slice(0, 8)
    .map((row) =>
      Object.fromEntries(
        Object.entries(row.cells).map(([key, value]) => [
          key,
          typeof value === "string" ? fence(clipText(value)) : value,
        ]),
      ),
    );
  return {
    summary: fence(clipText(artifact.notes?.[0] ?? `${artifact.label} done`)),
    // The model can only write {{fN}} when it knows the ids. These are the
    // facts this tool (plus any parallel sibling) registered.
    facts: facts.slice(0, 60).map((fact) => ({
      id: fact.id,
      label: fact.label ?? fact.kind,
      display: fact.display,
      kind: fact.kind,
      ...(fact.source
        ? { source: `${fact.source.type} ${fact.source.id}` }
        : {}),
    })),
    rows: clippedRows,
    columns: (artifact.columns ?? []).map((column) => column.label),
    notes: (artifact.notes ?? [])
      .slice(0, 5)
      .map((note) => fence(clipText(note, 400))),
    calc: artifact.calc
      ? {
          title: fence(clipText(artifact.calc.title)),
          total: artifact.calc.totalDisplay,
          definition: artifact.calc.definition,
        }
      : undefined,
  };
}

const COMPUTE_TOOLS = new Set(["calculate", "simulate_interest"]);

export async function runAssistantLoop(
  options: LoopOptions,
): Promise<LoopResult> {
  const route = resolveFeatureRoute("assistant_chat");
  const contents: GeminiContent[] = [
    ...options.history,
    currentUserContent(options.message, options.image),
  ];
  const steps: ToolStep[] = [];
  const modelMs: number[] = [];
  const toolMs: number[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let text = "";
  let exhausted = false;
  let finishReason: string | null = null;
  let provider = "gemini";
  let model = route.geminiModel;
  let rounds = 0;

  for (let round = 1; round <= options.maxRounds; round += 1) {
    if (options.signal?.aborted) {
      throw new AiGatewayError("aborted", "Turn aborted");
    }
    if (Date.now() >= options.deadlineAt) {
      exhausted = true;
      break;
    }
    if (tokensIn + tokensOut >= options.tokenCeiling) {
      exhausted = true;
      break;
    }

    rounds = round;
    options.onPhase?.(round === 1 ? "understanding" : "looking_up");
    let result: ToolTransportResult;
    try {
      result = await callModelWithTools({
        route,
        system: options.system,
        contents,
        tools: options.registry.declarations(),
        toolMode: "AUTO",
        deadlineMs: Math.max(1_000, options.deadlineAt - Date.now()),
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) {
        throw new AiGatewayError("aborted", "Turn aborted");
      }
      throw error;
    }
    provider = result.provider;
    model = result.model;
    finishReason = result.finishReason;
    tokensIn += result.usage.inputTokens;
    tokensOut += result.usage.outputTokens;
    modelMs.push(result.latencyMs);

    contents.push({ role: "model", parts: result.parts });
    const calls = functionCallsOf(result);
    const textSoFar = result.text.trim();

    if (calls.length === 0) {
      text = textSoFar;
      break;
    }

    if (Date.now() >= options.deadlineAt) {
      exhausted = true;
      text = textSoFar;
      break;
    }

    const accepted = calls.slice(0, options.maxToolsPerRound);
    const rejected = calls.slice(options.maxToolsPerRound);
    const responses: GeminiPart[] = [];

    if (accepted.some((call) => COMPUTE_TOOLS.has(call.name))) {
      options.onPhase?.("computing");
    } else {
      options.onPhase?.("looking_up");
    }

    const started = accepted.map((call) => {
      const step: ToolStep = {
        id: `${round}-${call.name}-${Math.random().toString(36).slice(2, 8)}`,
        name: call.name,
        label: call.name.replace(/_/g, " "),
        ok: true,
        ms: 0,
        rows: 0,
      };
      options.onToolStart?.(step);
      return step;
    });

    const results = await Promise.allSettled(
      accepted.map(async (call, index) => {
        const step = started[index];
        const toolStartedAt = Date.now();
        const factStart = options.ctx.facts.all().length;
        try {
          const definition = options.registry.get(call.name);
          if (definition) {
            step.label = definition.label(call.args as never, options.ctx);
          }
          const artifact = await options.registry.run(
            call.name,
            call.args,
            options.ctx,
          );
          step.ok = true;
          step.rows = artifact.rows?.length ?? 0;
          step.ms = Date.now() - toolStartedAt;
          toolMs.push(step.ms);
          const labelled: ToolArtifact = {
            ...artifact,
            name: call.name,
            label: step.label,
          };
          options.ctx.addArtifact(labelled);
          options.onToolDone?.(step);
          const allFacts = options.ctx.facts.all();
          const asOf = allFacts.find((fact) => fact.label === "As of");
          const newFacts = allFacts
            .slice(factStart)
            .filter((fact) => fact !== asOf);
          return {
            name: call.name,
            id: call.id,
            response: compactToolResponse(
              labelled,
              asOf ? [asOf, ...newFacts] : newFacts,
            ),
          };
        } catch (error) {
          step.ok = false;
          step.ms = Date.now() - toolStartedAt;
          toolMs.push(step.ms);
          if (error instanceof ToolError) {
            step.reason = error.message;
            step.code = error.code;
            options.onToolDone?.(step);
            return {
              name: call.name,
              response: {
                ...error.toModelResponse(),
              },
            };
          }
          step.reason = "Tool failed";
          options.onToolDone?.(step);
          return {
            name: call.name,
            response: {
              error: "unavailable",
              message: "The tool failed.",
              hint: "Do not retry with different ids. Tell the user this part is unavailable.",
            },
          };
        }
      }),
    );

    for (const settled of results) {
      if (settled.status === "fulfilled") {
        responses.push({
          functionResponse: {
            name: settled.value.name,
            ...(settled.value.id ? { id: settled.value.id } : {}),
            response: settled.value.response,
          },
        });
      }
    }
    for (const call of rejected) {
      responses.push({
        functionResponse: {
          name: call.name,
          ...(call.id ? { id: call.id } : {}),
          response: {
            error: "too_many_tools",
            message: "Too many tool calls in one round.",
            hint: "Call fewer tools next round.",
          },
        },
      });
    }

    contents.push({ role: "user", parts: responses });
    steps.push(...started);

    if (tokensIn + tokensOut >= options.tokenCeiling) {
      exhausted = true;
      break;
    }
  }

  if (!text && rounds >= options.maxRounds) exhausted = true;
  if (!text) exhausted = true;
  return {
    text,
    rounds,
    tokensIn,
    tokensOut,
    modelMs,
    toolMs,
    steps,
    artifacts: options.ctx.artifacts,
    exhausted,
    finishReason,
    provider,
    model,
  };
}
