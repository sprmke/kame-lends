/**
 * Conversation persistence. Reads and writes always filter by the session
 * user; a conversation id alone is never trusted. Missing tables fail soft so
 * a deploy before migrate leaves the rest of the app untouched.
 */
import { and, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
  aiConversations,
  aiMessages,
  aiToolCalls,
} from "$lib/server/db/schema";
import type {
  AssistantAttachment,
  AssistantBlock,
  AssistantConversationDto,
  AssistantMessageDto,
  SourceRef,
  ToolStep,
} from "$lib/assistant/types";
import { getAssistantLimits } from "../config";

export class AssistantStoreUnavailable extends Error {
  constructor() {
    super("Assistant storage is not available");
    this.name = "AssistantStoreUnavailable";
  }
}

function toConversation(row: {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  pinnedContext?: unknown;
}): AssistantConversationDto {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pinnedContext: (row.pinnedContext as SourceRef[] | null) ?? [],
  };
}

function toMessage(row: {
  id: string;
  role: string;
  status: string;
  text: string;
  blocks: unknown;
  attachments: unknown;
  toolTrace: unknown;
  createdAt: Date;
  feedback: number | null;
}): AssistantMessageDto {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    status: (row.status as AssistantMessageDto["status"]) ?? "complete",
    text: row.text,
    blocks: (row.blocks as AssistantBlock[]) ?? [],
    attachments: (row.attachments as AssistantAttachment[]) ?? [],
    createdAt: row.createdAt.toISOString(),
    feedback: row.feedback ?? null,
    toolTrace: (row.toolTrace as ToolStep[]) ?? [],
  };
}

export async function createConversation(
  userId: string,
  title: string,
  pins: SourceRef[],
): Promise<AssistantConversationDto> {
  try {
    const [row] = await db
      .insert(aiConversations)
      .values({ userId, title, pinnedContext: pins })
      .returning();
    return toConversation(row);
  } catch (error) {
    console.warn(
      "[ai.assistant] create conversation failed",
      (error as Error).message,
    );
    throw new AssistantStoreUnavailable();
  }
}

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<AssistantConversationDto | null> {
  try {
    const row = await db.query.aiConversations.findFirst({
      where: and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
        isNull(aiConversations.deletedAt),
      ),
    });
    return row ? toConversation(row) : null;
  } catch (error) {
    console.warn(
      "[ai.assistant] get conversation failed",
      (error as Error).message,
    );
    return null;
  }
}

export async function listConversations(
  userId: string,
  options: { query?: string; before?: Date; limit?: number } = {},
): Promise<AssistantConversationDto[]> {
  const limit = Math.min(options.limit ?? 20, 50);
  try {
    const rows = await db.query.aiConversations.findMany({
      where: and(
        eq(aiConversations.userId, userId),
        isNull(aiConversations.deletedAt),
        isNull(aiConversations.archivedAt),
        options.before
          ? lt(aiConversations.updatedAt, options.before)
          : undefined,
        options.query
          ? sql`${aiConversations.title} ILIKE ${`%${options.query}%`}`
          : undefined,
      ),
      orderBy: (table, { desc: descending }) => [descending(table.updatedAt)],
      limit,
    });
    return rows.map(toConversation);
  } catch (error) {
    console.warn(
      "[ai.assistant] list conversations failed",
      (error as Error).message,
    );
    return [];
  }
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string,
): Promise<boolean> {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!clean) return false;
  const rows = await db
    .update(aiConversations)
    .set({ title: clean, updatedAt: new Date() })
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
      ),
    )
    .returning();
  return rows.length > 0;
}

export async function archiveConversation(
  userId: string,
  conversationId: string,
  archived: boolean,
): Promise<boolean> {
  const rows = await db
    .update(aiConversations)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
      ),
    )
    .returning();
  return rows.length > 0;
}

export async function deleteConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const rows = await db
    .update(aiConversations)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
      ),
    )
    .returning();
  return rows.length > 0;
}

export async function deleteAllConversations(userId: string): Promise<number> {
  const rows = await db
    .update(aiConversations)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(aiConversations.userId, userId),
        isNull(aiConversations.deletedAt),
      ),
    )
    .returning();
  return rows.length;
}

/**
 * Regenerate replaces the last answer. Assistant rows created after the last
 * user message are removed so a reload never shows two answers to one question.
 * Tool audit rows cascade.
 */
export async function deleteAssistantRepliesAfter(
  userId: string,
  conversationId: string,
  after: Date,
): Promise<number> {
  const rows = await db
    .delete(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        eq(aiMessages.userId, userId),
        eq(aiMessages.role, "assistant"),
        gte(aiMessages.createdAt, after),
      ),
    )
    .returning();
  return rows.length;
}

export async function newMessage(input: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  status?: AssistantMessageDto["status"];
  text?: string;
  blocks?: AssistantBlock[];
  attachments?: AssistantAttachment[];
  toolTrace?: ToolStep[];
}): Promise<AssistantMessageDto> {
  const [row] = await db
    .insert(aiMessages)
    .values({
      conversationId: input.conversationId,
      userId: input.userId,
      role: input.role,
      status: input.status ?? "complete",
      text: input.text ?? "",
      blocks: (input.blocks ?? []) as never,
      attachments: (input.attachments ?? []) as never,
      toolTrace: (input.toolTrace ?? []) as never,
    })
    .returning();
  return toMessage(row);
}

export async function updateMessage(
  messageId: string,
  userId: string,
  patch: {
    status?: AssistantMessageDto["status"];
    text?: string;
    blocks?: AssistantBlock[];
    toolTrace?: ToolStep[];
    promptId?: string;
    promptVersion?: string;
    model?: string;
    provider?: string;
    rounds?: number;
    tokensIn?: number;
    tokensOut?: number;
    estCostUsd?: number;
    latencyBreakdown?: unknown;
    guardMode?: "ok" | "regenerated" | "fallback";
  },
): Promise<void> {
  await db
    .update(aiMessages)
    .set({
      ...patch,
      blocks: patch.blocks as never,
      toolTrace: patch.toolTrace as never,
      latencyBreakdown: patch.latencyBreakdown as never,
      estCostUsd:
        patch.estCostUsd === undefined
          ? undefined
          : patch.estCostUsd.toFixed(6),
    })
    .where(and(eq(aiMessages.id, messageId), eq(aiMessages.userId, userId)));
}

export async function listMessages(
  userId: string,
  conversationId: string,
  limit = 100,
): Promise<AssistantMessageDto[]> {
  try {
    const rows = await db.query.aiMessages.findMany({
      where: and(
        eq(aiMessages.conversationId, conversationId),
        eq(aiMessages.userId, userId),
      ),
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit,
    });
    return rows.map(toMessage);
  } catch (error) {
    console.warn(
      "[ai.assistant] list messages failed",
      (error as Error).message,
    );
    return [];
  }
}

export async function updateConversationPins(
  userId: string,
  conversationId: string,
  pins: SourceRef[],
): Promise<void> {
  await db
    .update(aiConversations)
    .set({ pinnedContext: pins as never, updatedAt: new Date() })
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
      ),
    );
}

export async function touchConversation(
  userId: string,
  conversationId: string,
): Promise<void> {
  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
      ),
    );
}

export async function setMessageFeedback(
  userId: string,
  messageId: string,
  value: 1 | -1,
  reason?: string,
): Promise<boolean> {
  const rows = await db
    .update(aiMessages)
    .set({ feedback: value, feedbackReason: reason?.slice(0, 500) ?? null })
    .where(and(eq(aiMessages.id, messageId), eq(aiMessages.userId, userId)))
    .returning();
  return rows.length > 0;
}

export async function addToolCall(input: {
  messageId: string;
  userId: string;
  tool: string;
  argsHash: string;
  ok: boolean;
  errorCode?: string | null;
  rowCount?: number;
  truncated?: boolean;
  latencyMs?: number;
}): Promise<void> {
  try {
    await db.insert(aiToolCalls).values({
      messageId: input.messageId,
      userId: input.userId,
      tool: input.tool,
      argsHash: input.argsHash,
      ok: input.ok,
      errorCode: input.errorCode ?? null,
      rowCount: input.rowCount ?? 0,
      truncated: input.truncated ?? false,
      latencyMs: input.latencyMs ?? 0,
    });
  } catch (error) {
    console.warn("[ai.assistant] tool audit failed", (error as Error).message);
  }
}

/** 5% lazy sweep, no cron dependency (matches `ai_response_cache`). */
export async function maybePurgeExpired(): Promise<void> {
  if (Math.random() > 0.05) return;
  const { retentionDays } = getAssistantLimits();
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const softDeletedCutoff = new Date(Date.now() - 7 * 86_400_000);
  try {
    await db
      .delete(aiConversations)
      .where(
        or(
          lt(aiConversations.updatedAt, cutoff),
          and(lt(aiConversations.deletedAt, softDeletedCutoff)),
        ),
      );
  } catch (error) {
    console.warn(
      "[ai.assistant] retention sweep failed",
      (error as Error).message,
    );
  }
}

export async function conversationExists(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  return (await getConversation(userId, conversationId)) !== null;
}

export async function latestAssistantMessage(
  userId: string,
  conversationId: string,
): Promise<AssistantMessageDto | null> {
  const rows = await db.query.aiMessages.findMany({
    where: and(
      eq(aiMessages.conversationId, conversationId),
      eq(aiMessages.userId, userId),
      eq(aiMessages.role, "assistant"),
    ),
    orderBy: [desc(aiMessages.createdAt)],
    limit: 1,
  });
  return rows[0] ? toMessage(rows[0]) : null;
}
