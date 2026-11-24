/**
 * One assistant turn: guards → conversation → tools → verify → persist.
 *
 * The model never sees a session it can widen, never writes, and never types a
 * number. A failed verification regenerates once, then falls back to tables and
 * stats built from tool facts.
 */
import { createHash } from "node:crypto";
import type {
  AssistantEvent,
  AssistantPin,
  SourceRef,
  ToolArtifact,
} from "$lib/assistant/types";
import {
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_CHARS,
  MAX_PINS,
} from "$lib/assistant/types";
import { todayKey } from "$lib/dates/business-date";
import { estimateCostUsd, resolveFeatureRoute } from "../features";
import { assertFeatureEnabled } from "../client";
import { isAiGatewayError, type AiErrorCode } from "../errors";
import { getAssistantLimits, isAssistantRolloutAllowed } from "../config";
import { countAssistantTurns, getDailyCostUsd, recordAiUsage } from "../usage";
import {
  hasInvestorContactViewAccess,
  hasWitnessContactViewAccess,
} from "$lib/server/access-control";
import {
  MAX_RECEIPT_IMAGE_BYTES,
  decodeImageDataUrl,
  extractReceipt,
} from "../receipt-extraction";
import { findRecordedReferences } from "$lib/server/receipt-references";
import { receiptTransactions } from "$lib/receipt-extraction-types";
import { receiptSanityWarnings } from "$lib/receipt-scan/sanity";
import { resolveReceiptScanParties } from "$lib/server/receipt-scan-context";
import type { ViewerData } from "$lib/server/assistant/viewer-data";
import { FactStore, looksLikeInjection } from "./facts";
import {
  createToolContext,
  type AssistantReceiptContext,
  type ToolContext,
} from "./context";
import { runAssistantLoop, type LoopResult } from "./loop";
import { assistantRegistry } from "../tools";
import { buildThreadHistory, titleFromMessage } from "./memory";
import {
  ASSISTANT_SYSTEM_PROMPT,
  PROMPT_CANARY,
} from "../prompts/assistant-chat";
import {
  buildBlocks,
  fallbackBlocks,
  fallbackText,
  sanitizeMarkdown,
  verifyAnswer,
} from "./verify";
import {
  AssistantStoreUnavailable,
  addToolCall,
  createConversation,
  deleteAssistantRepliesAfter,
  getConversation,
  latestAssistantMessage,
  listMessages,
  maybePurgeExpired,
  newMessage,
  setMessageFeedback,
  touchConversation,
  updateConversationPins,
  updateMessage,
} from "../assistant/store";

export class AssistantRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AssistantRequestError";
  }
}

export interface TurnInput {
  userId: string;
  email: string | null;
  role: string | null;
  displayName: string;
  message: string;
  pins?: Array<{ type: SourceRef["type"]; id: number | string }>;
  page: string | null;
  imageDataUrl?: string;
  conversationId?: string;
  regenerate?: boolean;
  signal?: AbortSignal;
  emit: (event: AssistantEvent) => void | Promise<void>;
}

export interface TurnOutput {
  conversationId: string;
  messageId: string;
}

const ALLOWED_PAGE =
  /^\/(?:dashboard|loans|borrowers|investors|witnesses|debts|groups|settings|transactions|assistant)(?:\/\d+)?\/?$/;

/** Page context is display-only and can never carry free text into the prompt. */
function cleanPage(raw: string | null): string | null {
  if (!raw) return null;
  const path = raw.split("?")[0]?.split("#")[0] ?? "";
  return ALLOWED_PAGE.test(path) ? path : null;
}

function cleanMessage(raw: string): string {
  return (
    raw
      .normalize("NFC")
      // eslint-disable-next-line no-control-regex -- strip control characters from user text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
  );
}

function detectLanguage(message: string): "English" | "Taglish" {
  return /\b(magkano|ilan|sino|utang|bayad|tubo|kailan|saan|paano|meron|wala|ako|iyong|niya)\b/i.test(
    message,
  )
    ? "Taglish"
    : "English";
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function resolvePins(
  viewer: ViewerData,
  pins: NonNullable<TurnInput["pins"]>,
): Promise<SourceRef[]> {
  const result: SourceRef[] = [];
  for (const pin of pins.slice(0, MAX_PINS)) {
    const id = Number(pin.id);
    if (!Number.isFinite(id)) continue;
    if (pin.type === "loan") {
      const loan = await viewer.loanById(id);
      if (loan) {
        result.push({
          type: "loan",
          id: loan.id,
          label: loan.loanName,
          href: `/loans/${loan.id}`,
        });
      }
    } else if (pin.type === "borrower") {
      const borrower = (await viewer.borrowers()).find((row) => row.id === id);
      if (borrower) {
        result.push({
          type: "borrower",
          id,
          label: borrower.name,
          href: `/borrowers/${id}`,
        });
      }
    } else if (pin.type === "investor") {
      if (await hasInvestorContactViewAccess(id, viewer.userId)) {
        const investor = (await viewer.investors()).find(
          (row) => row.id === id,
        );
        result.push({
          type: "investor",
          id,
          label: investor?.name ?? `Investor #${id}`,
          href: `/investors/${id}`,
        });
      }
    } else if (pin.type === "witness") {
      if (await hasWitnessContactViewAccess(id, viewer.userId)) {
        result.push({
          type: "witness",
          id,
          label: `Witness #${id}`,
          href: "/witnesses",
        });
      }
    } else if (pin.type === "debt") {
      const debt = (await viewer.debts()).find((row) => row.id === id);
      if (debt)
        result.push({
          type: "debt",
          id,
          label: debt.name,
          href: `/debts/${id}`,
        });
    } else if (pin.type === "group") {
      const group = await viewer.groupById(id);
      if (group)
        result.push({
          type: "group",
          id,
          label: group.name,
          href: `/groups/${id}`,
        });
    }
  }
  return result;
}

async function buildReceiptContext(
  userId: string,
  imageDataUrl: string | undefined,
  page: string | null,
): Promise<{
  receipt?: AssistantReceiptContext;
  attachment?: { kind: "image"; mimeType: string; size: number };
}> {
  if (!imageDataUrl) return {};
  const image = decodeImageDataUrl(imageDataUrl);
  if (!image) {
    throw new AssistantRequestError(
      "unsupported_input",
      "Attach a JPEG, PNG, WebP, or GIF image.",
      400,
    );
  }
  const size = Math.floor((image.base64.length * 3) / 4);
  if (size > MAX_IMAGE_BYTES || size > MAX_RECEIPT_IMAGE_BYTES) {
    throw new AssistantRequestError(
      "too_large",
      "That image is too large. Use one under 3 MB.",
      413,
    );
  }
  const loanMatch = page ? /^\/loans\/(\d+)/.exec(page) : null;
  const parties = await resolveReceiptScanParties(userId, {
    loanId: loanMatch ? Number(loanMatch[1]) : undefined,
  }).catch(() => ({ lenderNames: [], borrowerName: null }));
  const extracted = await extractReceipt({
    userId,
    image,
    purpose: "fund_transfer",
    lenderNames: parties.lenderNames,
    borrowerName: parties.borrowerName,
  });
  if (!extracted.success) {
    return {
      attachment: { kind: "image", mimeType: image.mimeType, size },
      receipt: {
        summary: "The image could not be read automatically.",
        fields: {},
        references: [],
        recorded: [],
        warnings: [extracted.error],
      },
    };
  }
  const data = extracted.data;
  const references = receiptTransactions(data)
    .map((transaction) => transaction.referenceNumber)
    .filter((reference): reference is string => Boolean(reference));
  const recorded = await findRecordedReferences(userId, references).catch(
    () => [],
  );
  const warnings: string[] = receiptSanityWarnings(data).map(
    (warning) => warning.code,
  );
  for (const match of recorded) {
    warnings.push(
      `already_recorded: ${match.referenceNumber} on ${match.loanName}`,
    );
  }
  return {
    attachment: { kind: "image", mimeType: image.mimeType, size },
    receipt: {
      summary: data.summary,
      fields: {
        amount: data.amount == null ? "" : String(data.amount),
        date: data.transactionDate ?? "",
        reference: data.referenceNumber ?? "",
        sender: [data.senderName, data.senderBank].filter(Boolean).join(" / "),
        receiver: [data.receiverName, data.receiverBank]
          .filter(Boolean)
          .join(" / "),
        verdict: data.verdict,
      },
      references,
      recorded,
      warnings,
    },
  };
}

function chunks(text: string, size = 90): string[] {
  const result: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    if (rest.length <= size) {
      result.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(" ", size);
    if (cut < size * 0.55) cut = size;
    result.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return result;
}

async function emitText(text: string, emit: TurnInput["emit"]): Promise<void> {
  await emit({ type: "text_start" });
  for (const part of chunks(text)) {
    await emit({ type: "text_delta", text: part });
  }
}

function aiMessage(code: AiErrorCode | "unavailable"): string {
  switch (code) {
    case "not_configured":
      return "The assistant is not configured yet.";
    case "disabled":
      return "The assistant is turned off right now.";
    case "quota_exceeded":
      return "You reached today's assistant limit. Try again tomorrow.";
    case "rate_limited":
      return "The assistant is busy. Try again in a minute.";
    case "timeout":
      return "That took too long. Try a narrower question.";
    case "aborted":
      return "Stopped.";
    case "unsupported_input":
      return "I could not use that input. Try a text question or a smaller image.";
    case "unavailable":
      return "The assistant is unavailable right now.";
    default:
      return "The assistant could not answer that. Try again.";
  }
}

export async function runAssistantTurn(input: TurnInput): Promise<TurnOutput> {
  assertFeatureEnabled("assistant_chat");
  if (!isAssistantRolloutAllowed(input.role)) {
    throw new AssistantRequestError(
      "rollout",
      "The assistant is not available for this account yet.",
      403,
    );
  }

  const page = cleanPage(input.page);
  const limits = getAssistantLimits();
  const turnsToday = await countAssistantTurns(input.userId);
  if (limits.dailyTurns > 0 && turnsToday >= limits.dailyTurns) {
    throw new AssistantRequestError(
      "quota_exceeded",
      `You reached today's limit of ${limits.dailyTurns} questions.`,
      429,
    );
  }
  if (limits.dailyCostUsd > 0) {
    const cost = await getDailyCostUsd(input.userId);
    if (cost >= limits.dailyCostUsd) {
      throw new AssistantRequestError(
        "quota_exceeded",
        "You reached today's assistant usage limit.",
        429,
      );
    }
  }

  const message = cleanMessage(input.message);
  if (!message) {
    throw new AssistantRequestError(
      "bad_request",
      "Type a question first.",
      400,
    );
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    throw new AssistantRequestError(
      "too_long",
      `Keep the question under ${MAX_MESSAGE_CHARS} characters.`,
      400,
    );
  }
  if (input.pins && input.pins.length > MAX_PINS) {
    throw new AssistantRequestError(
      "bad_pins",
      `Pin at most ${MAX_PINS} items.`,
      400,
    );
  }
  if (looksLikeInjection(message)) {
    console.warn(
      JSON.stringify({
        level: "warn",
        kind: "ai.assistant_chat.injection_heuristic",
        userId: input.userId,
        conversationId: input.conversationId ?? null,
      }),
    );
  }

  const today = todayKey();
  const { receipt, attachment } = await buildReceiptContext(
    input.userId,
    input.imageDataUrl,
    page,
  );

  let conversationId = input.conversationId;
  let isNew = false;
  let pinsInput: NonNullable<TurnInput["pins"]> = input.pins ?? [];
  if (conversationId) {
    const existing = await getConversation(input.userId, conversationId);
    if (!existing) {
      throw new AssistantRequestError(
        "not_found",
        "Conversation not found.",
        404,
      );
    }
    if (input.pins === undefined && existing.pinnedContext?.length) {
      pinsInput = existing.pinnedContext.map((pin) => ({
        type: pin.type,
        id: pin.id,
      }));
    }
  } else {
    const created = await createConversation(
      input.userId,
      titleFromMessage(message),
      (input.pins ?? []) as SourceRef[],
    );
    conversationId = created.id;
    isNew = true;
  }

  const before = await listMessages(input.userId, conversationId, 200);
  let userMessageId: string;
  let effectiveMessage = message;
  let historyMessages = before;
  if (input.regenerate) {
    const lastUserIndex = before.findLastIndex((row) => row.role === "user");
    if (lastUserIndex < 0) {
      throw new AssistantRequestError(
        "bad_request",
        "Nothing to regenerate.",
        400,
      );
    }
    const lastUser = before[lastUserIndex];
    effectiveMessage = lastUser.text;
    userMessageId = lastUser.id;
    // Replace, not append: drop the previous answer(s) for this question and
    // keep them out of the model's history.
    historyMessages = before.slice(0, lastUserIndex + 1);
    await deleteAssistantRepliesAfter(
      input.userId,
      conversationId,
      lastUser.createdAt ? new Date(lastUser.createdAt) : new Date(),
    ).catch(() => 0);
  } else {
    const userRow = await newMessage({
      conversationId,
      userId: input.userId,
      role: "user",
      text: message,
      attachments: attachment ? [attachment] : [],
    });
    userMessageId = userRow.id;
  }

  const assistantRow = await newMessage({
    conversationId,
    userId: input.userId,
    role: "assistant",
    status: "streaming",
  });

  await input.emit({
    type: "turn_started",
    conversationId,
    messageId: assistantRow.id,
    userMessageId,
  });

  const previous = historyMessages.filter(
    (row) => row.id !== assistantRow.id && row.id !== userMessageId,
  );
  const history = buildThreadHistory(previous);
  const deadlineAt = Date.now() + limits.deadlineMs;
  let pins: SourceRef[] = [];
  let baseSystem = "";

  const promptCtx = {
    displayName: input.displayName,
    roles: input.role ? [input.role] : [],
    today,
    page,
    pins,
    language: detectLanguage(effectiveMessage),
    toolNames: assistantRegistry.names(),
    receiptAttached: Boolean(receipt),
  };

  // Resolve pins against the viewer once; the same ViewerData is reused by
  // every retry so a regenerate does not reload the portfolio.
  const contextSeed = createToolContext({
    userId: input.userId,
    email: input.email,
    role: input.role,
    page,
    pins: [],
    facts: new FactStore(),
    deadlineAt,
    signal: input.signal,
    today,
    receipt,
  });
  pins = await resolvePins(contextSeed.viewer, pinsInput);
  if (input.pins !== undefined) {
    await updateConversationPins(input.userId, conversationId, pins).catch(
      () => {},
    );
  }
  baseSystem = ASSISTANT_SYSTEM_PROMPT.build({ ...promptCtx, pins });

  const runAttempt = async (
    facts: FactStore,
    suffix?: string,
  ): Promise<{ loop: LoopResult; ctx: ToolContext }> => {
    const ctx = createToolContext({
      userId: input.userId,
      email: input.email,
      role: input.role,
      page,
      pins,
      facts,
      locale: promptCtx.language === "Taglish" ? "fil" : "en",
      receipt,
      viewer: contextSeed.viewer,
      deadlineAt,
      signal: input.signal,
      today,
    });
    input.emit({ type: "phase", phase: "understanding" });
    const loop = await runAssistantLoop({
      ctx,
      registry: assistantRegistry,
      system: suffix ? `${baseSystem}\n\n${suffix}` : baseSystem,
      history,
      message: effectiveMessage,
      image: undefined,
      maxRounds: limits.maxRounds,
      maxToolsPerRound: limits.maxToolsPerRound,
      tokenCeiling: limits.tokenCeiling,
      deadlineAt,
      signal: input.signal,
      onPhase: (phase) => input.emit({ type: "phase", phase }),
      onToolStart: (step) =>
        input.emit({
          type: "tool_start",
          id: step.id,
          name: step.name,
          label: step.label,
        }),
      onToolDone: (step) =>
        input.emit({
          type: "tool_done",
          id: step.id,
          name: step.name,
          label: step.label,
          ok: step.ok,
          ms: step.ms,
          rows: step.rows,
          reason: step.reason,
        }),
    });
    return { loop, ctx };
  };

  const startedAt = Date.now();
  let guardMode: "ok" | "regenerated" | "fallback" = "ok";
  let facts = new FactStore();
  let attempt: { loop: LoopResult; ctx: ToolContext } | null;
  let verify: { ok: boolean; text: string; violations: string[] };
  let modelMs: number[];
  let toolMs: number[];

  try {
    attempt = await runAttempt(facts);
    modelMs = attempt.loop.modelMs;
    toolMs = attempt.loop.toolMs;
    verify = verifyAnswer({
      text: attempt.loop.text,
      facts,
      artifacts: attempt.loop.artifacts,
    });

    if (!verify.ok && !attempt.loop.exhausted && !input.signal?.aborted) {
      guardMode = "regenerated";
      const violationNote = `Verification note: the previous answer used values that no tool supplied (${verify.violations
        .slice(0, 3)
        .join(
          "; ",
        )}). Write the answer again using only {{fN}} tokens for every number. Do not type digits.`;
      facts = new FactStore();
      const retry = await runAttempt(facts, violationNote);
      modelMs = [...modelMs, ...retry.loop.modelMs];
      toolMs = [...toolMs, ...retry.loop.toolMs];
      attempt = retry;
      verify = verifyAnswer({
        text: retry.loop.text,
        facts,
        artifacts: retry.loop.artifacts,
      });
    }

    input.emit({ type: "phase", phase: "checking" });
    if (verify.ok && verify.text.length > limits.maxOutputChars) {
      verify = {
        ok: false,
        text: verify.text,
        violations: ["answer was longer than the output limit"],
      };
    }

    if (!verify.ok || !verify.text.trim()) {
      guardMode = "fallback";
      const text = fallbackText(attempt.loop.artifacts);
      const blocks = fallbackBlocks(attempt.loop.artifacts, facts.all());
      verify = { ok: true, text, violations: verify.violations };
      await emitText(text, input.emit);
      await input.emit({ type: "phase", phase: "writing" });
      const sources = mergeSourceList(attempt.loop.artifacts);
      await input.emit({
        type: "blocks",
        blocks,
        text,
        guardMode,
        sources,
        title: isNew ? titleFromMessage(message) : undefined,
      });
      await persist(input, {
        conversationId,
        messageId: assistantRow.id,
        userMessageId,
        text,
        blocks,
        steps: attempt.loop.steps,
        guardMode,
        loop: attempt.loop,
        facts,
        modelMs,
        toolMs,
        startedAt,
        violations: verify.violations,
      });
      return { conversationId, messageId: assistantRow.id };
    }

    await input.emit({ type: "phase", phase: "writing" });
    await emitText(sanitizeMarkdown(verify.text), input.emit);
    const blocks = buildBlocks(attempt.loop.artifacts, facts.all());
    const sources = mergeSourceList(attempt.loop.artifacts);
    await input.emit({
      type: "blocks",
      blocks,
      text: verify.text,
      guardMode,
      sources,
      title: isNew ? titleFromMessage(message) : undefined,
    });
    await persist(input, {
      conversationId,
      messageId: assistantRow.id,
      userMessageId,
      text: verify.text,
      blocks,
      steps: attempt.loop.steps,
      guardMode,
      loop: attempt.loop,
      facts,
      modelMs,
      toolMs,
      startedAt,
      violations: [],
    });
    return { conversationId, messageId: assistantRow.id };
  } catch (error) {
    const gatewayCode = isAiGatewayError(error)
      ? error.code
      : error instanceof AssistantStoreUnavailable
        ? "unavailable"
        : "provider_error";
    const aborted = gatewayCode === "aborted" || Boolean(input.signal?.aborted);
    await updateMessage(assistantRow.id, input.userId, {
      status: aborted ? "aborted" : "error",
      text: aborted ? "" : aiMessage(gatewayCode),
    }).catch(() => {});
    await input.emit({
      type: "error",
      code: aborted ? "aborted" : gatewayCode,
      message: aiMessage(gatewayCode),
      aborted,
    });
    if (isAiGatewayError(error) && error.code !== "aborted") {
      console.warn(
        JSON.stringify({
          level: "warn",
          kind: "ai.assistant_chat.error",
          code: error.code,
          userId: input.userId,
          conversationId,
        }),
      );
    }
    return { conversationId, messageId: assistantRow.id };
  }
}

function mergeSourceList(artifacts: ToolArtifact[]): SourceRef[] {
  const seen = new Set<string>();
  const result: SourceRef[] = [];
  for (const artifact of artifacts) {
    for (const source of artifact.sources ?? []) {
      const key = `${source.type}:${source.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(source);
    }
  }
  return result.slice(0, 8);
}

async function persist(
  input: TurnInput,
  args: {
    conversationId: string;
    messageId: string;
    userMessageId: string;
    text: string;
    blocks: ReturnType<typeof buildBlocks>;
    steps: LoopResult["steps"];
    guardMode: "ok" | "regenerated" | "fallback";
    loop: LoopResult;
    facts: FactStore;
    modelMs: number[];
    toolMs: number[];
    startedAt: number;
    violations: string[];
  },
): Promise<void> {
  const route = resolveFeatureRoute("assistant_chat");
  const cost = estimateCostUsd(route, "gemini", {
    inputTokens: args.loop.tokensIn,
    outputTokens: args.loop.tokensOut,
  });
  const totalMs = Date.now() - args.startedAt;

  await updateMessage(args.messageId, input.userId, {
    status: "complete",
    text: args.text,
    blocks: args.blocks,
    toolTrace: args.steps,
    promptId: ASSISTANT_SYSTEM_PROMPT.id,
    promptVersion: ASSISTANT_SYSTEM_PROMPT.version,
    model: args.loop.model,
    provider: args.loop.provider,
    rounds: args.loop.rounds,
    tokensIn: args.loop.tokensIn,
    tokensOut: args.loop.tokensOut,
    estCostUsd: cost,
    latencyBreakdown: {
      modelMs: args.modelMs,
      toolMs: args.toolMs,
      total: totalMs,
    },
    guardMode: args.guardMode,
  });

  for (const step of args.steps) {
    await addToolCall({
      messageId: args.messageId,
      userId: input.userId,
      tool: step.name,
      argsHash: hash(`${step.name}:${step.id}`),
      ok: step.ok,
      errorCode: step.ok ? null : (step.code ?? "tool_error"),
      rowCount: step.rows,
      latencyMs: step.ms,
    });
  }

  await recordAiUsage({
    userId: input.userId,
    feature: "assistant_chat",
    provider: "gemini",
    model: args.loop.model,
    promptId: ASSISTANT_SYSTEM_PROMPT.id,
    promptVersion: ASSISTANT_SYSTEM_PROMPT.version,
    inputTokens: args.loop.tokensIn,
    outputTokens: args.loop.tokensOut,
    estCostUsd: cost,
    latencyMs: totalMs,
    status: "success",
    errorCode: null,
    fallbackUsed: false,
    cacheHit: false,
    conversationId: args.conversationId,
    messageId: args.messageId,
    rounds: args.loop.rounds,
    toolCalls: args.steps.length,
  });

  await touchConversation(input.userId, args.conversationId);
  void maybePurgeExpired();

  console.info(
    JSON.stringify({
      level: "info",
      kind: "ai.assistant_chat.ok",
      conversationId: args.conversationId,
      messageId: args.messageId,
      rounds: args.loop.rounds,
      tools: args.steps.length,
      guardMode: args.guardMode,
      tokensIn: args.loop.tokensIn,
      tokensOut: args.loop.tokensOut,
      usd: cost,
      ms: totalMs,
      violations: args.violations.length,
    }),
  );
}

export { setMessageFeedback, latestAssistantMessage };
