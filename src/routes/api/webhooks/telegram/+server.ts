import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "$lib/server/db";
import {
  groupTelegramSettings,
  loanGroups,
  telegramLinkTokens,
} from "$lib/server/db/schema";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { manilaTodayKey } from "$lib/calendar-sync-plan";
import { planUpcomingWeekHtml } from "$lib/group-notification-plan";
import { readTelegramConfig } from "$lib/server/telegram/config";
import { sendMessage } from "$lib/server/telegram/api";
import { normalizeTelegramChatId } from "$lib/server/telegram/normalize";
import { escapeHtml } from "$lib/server/telegram/format";
import { loadGroupLoansForNotifications } from "$lib/server/telegram/group-notifications";
import { env as publicEnv } from "$env/dynamic/public";

type TelegramUpdate = {
  message?: TelegramMessage;
  my_chat_member?: MyChatMemberUpdate;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string; title?: string };
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
};

type MyChatMemberUpdate = {
  chat: { id: number; type: string; title?: string };
  new_chat_member: { status: string };
  old_chat_member: { status: string };
};

function verifyWebhookSecret(header: string | null): boolean {
  const config = readTelegramConfig();
  if (!config || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(config.webhookSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readAppUrl(): string {
  const url = publicEnv.PUBLIC_APP_URL?.trim() || process.env.PUBLIC_APP_URL;
  return url?.replace(/\/$/, "") || "https://example.com";
}

function ok(): Response {
  return json({ ok: true });
}

function extractStartToken(text: string): string | null {
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+(\S+))?/i);
  return match?.[1] ?? null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function reply(chatId: string, html: string): Promise<void> {
  try {
    await sendMessage(chatId, html);
  } catch (err) {
    console.error("[telegram] webhook reply failed", err);
  }
}

async function handleStartLink(message: TelegramMessage, token: string) {
  const chatType = message.chat.type;
  if (chatType !== "group" && chatType !== "supergroup") {
    await reply(
      String(message.chat.id),
      "Open the group link from the app and add this bot to that group.",
    );
    return;
  }

  const tokenHash = hashToken(token);
  const linkRow = await db.query.telegramLinkTokens.findFirst({
    where: and(
      eq(telegramLinkTokens.tokenHash, tokenHash),
      isNull(telegramLinkTokens.usedAt),
      gt(telegramLinkTokens.expiresAt, new Date()),
    ),
  });

  if (!linkRow) {
    await reply(
      String(message.chat.id),
      "This link expired or was already used. Generate a new one in the app.",
    );
    return;
  }

  const chatId = normalizeTelegramChatId(message.chat.id);
  if (!chatId) return;

  const otherGroup = await db.query.groupTelegramSettings.findFirst({
    where: and(
      eq(groupTelegramSettings.chatId, chatId),
      ne(groupTelegramSettings.groupId, linkRow.groupId),
    ),
  });

  if (otherGroup) {
    await reply(
      chatId,
      "This chat is already linked to another group. Disconnect it there first.",
    );
    return;
  }

  const group = await db.query.loanGroups.findFirst({
    where: eq(loanGroups.id, linkRow.groupId),
    columns: { name: true },
  });

  const now = new Date();

  await db
    .insert(groupTelegramSettings)
    .values({
      groupId: linkRow.groupId,
      chatId,
      chatTitle: message.chat.title ?? null,
      chatType: chatType,
      status: "connected",
      linkedByUserId: linkRow.createdByUserId,
      linkedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: groupTelegramSettings.groupId,
      set: {
        chatId,
        chatTitle: message.chat.title ?? null,
        chatType: chatType,
        status: "connected",
        linkedByUserId: linkRow.createdByUserId,
        linkedAt: now,
        lastError: null,
        updatedAt: now,
      },
    });

  await db
    .update(telegramLinkTokens)
    .set({ usedAt: now })
    .where(eq(telegramLinkTokens.id, linkRow.id));

  const name = escapeHtml(group?.name ?? "your group");
  await reply(chatId, `✅ Connected to <b>${name}</b>`);
}

async function handlePrivateStart(chatId: string) {
  await reply(
    chatId,
    "Add me to a Telegram group using the link from Kame Lends group settings.",
  );
}

async function handleMyChatMember(update: MyChatMemberUpdate) {
  const chatId = normalizeTelegramChatId(update.chat.id);
  if (!chatId) return;

  const status = update.new_chat_member.status;
  if (status !== "kicked" && status !== "left") return;

  await db
    .update(groupTelegramSettings)
    .set({
      status: "bot_removed",
      lastError: "Bot removed from chat",
      updatedAt: new Date(),
    })
    .where(eq(groupTelegramSettings.chatId, chatId));
}

async function handleMigrate(message: TelegramMessage) {
  const newId = message.migrate_to_chat_id;
  if (newId == null) return;
  const fromId = normalizeTelegramChatId(message.migrate_from_chat_id);
  const toId = normalizeTelegramChatId(newId);
  if (!fromId || !toId) return;

  await db
    .update(groupTelegramSettings)
    .set({ chatId: toId, updatedAt: new Date() })
    .where(eq(groupTelegramSettings.chatId, fromId));
}

async function handleCommand(message: TelegramMessage) {
  const text = message.text?.trim() ?? "";
  const chatId = normalizeTelegramChatId(message.chat.id);
  if (!chatId) return;

  const settings = await db.query.groupTelegramSettings.findFirst({
    where: eq(groupTelegramSettings.chatId, chatId),
  });

  if (!settings || settings.status !== "connected") {
    await reply(chatId, "This chat is not linked to a group yet.");
    return;
  }

  if (text.startsWith("/help")) {
    await reply(
      chatId,
      "<b>Commands</b>\n/upcoming · next 7 days\n/help · this message",
    );
    return;
  }

  if (text.startsWith("/upcoming")) {
    const todayKey = manilaTodayKey();
    const loans = await loadGroupLoansForNotifications(settings.groupId);
    const html = planUpcomingWeekHtml(
      loans,
      todayKey,
      settings.includeAmounts,
      readAppUrl(),
      settings.groupId,
    );
    await reply(chatId, html);
  }
}

export const POST: RequestHandler = async (event) => {
  const secretHeader = event.request.headers.get(
    "x-telegram-bot-api-secret-token",
  );

  if (!verifyWebhookSecret(secretHeader)) {
    console.warn("[telegram] webhook rejected: bad secret");
    return ok();
  }

  let update: TelegramUpdate;
  try {
    update = (await event.request.json()) as TelegramUpdate;
  } catch {
    return ok();
  }

  try {
    if (update.my_chat_member) {
      await handleMyChatMember(update.my_chat_member);
    }

    const message = update.message;
    if (!message) return ok();

    if (message.migrate_to_chat_id != null) {
      await handleMigrate(message);
    }

    const chatId = normalizeTelegramChatId(message.chat.id);
    if (!chatId) return ok();

    const text = message.text?.trim() ?? "";
    if (text.startsWith("/start")) {
      const token = extractStartToken(text);
      if (token) {
        await handleStartLink(message, token);
      } else if (message.chat.type === "private") {
        await handlePrivateStart(chatId);
      }
      return ok();
    }

    if (text.startsWith("/help") || text.startsWith("/upcoming")) {
      await handleCommand(message);
    }
  } catch (err) {
    console.error("[telegram] webhook handler error", err);
  }

  return ok();
};
