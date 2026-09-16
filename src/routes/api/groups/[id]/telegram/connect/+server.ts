import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupTelegramSettings } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { hasGroupManageAccess } from "$lib/server/group-access";
import {
  connectTelegramBodySchema,
  parseJsonBody,
} from "$lib/group-validation";
import { getChat, getMe, TelegramApiError } from "$lib/server/telegram/api";
import { resolveGroupBotToken } from "$lib/server/telegram/config";
import {
  publicTelegramSettings,
  telegramApiMeta,
} from "$lib/server/telegram/public-settings";
import { normalizeTelegramChatId } from "$lib/server/telegram/normalize";

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const body = await event.request.json();
    const parsed = parseJsonBody(connectTelegramBodySchema, body);
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }

    const existing = await db.query.groupTelegramSettings.findFirst({
      where: eq(groupTelegramSettings.groupId, groupId),
    });

    const tokenToUse = resolveGroupBotToken(
      parsed.data.botToken ?? existing?.botToken,
    );
    if (!tokenToUse) {
      return json(
        { error: "Add a bot token or set TELEGRAM_BOT_TOKEN" },
        { status: 503 },
      );
    }

    const normalizedChatId = normalizeTelegramChatId(parsed.data.chatId);
    if (!normalizedChatId) {
      return json({ error: "Invalid chat id" }, { status: 400 });
    }

    try {
      await getMe(tokenToUse);
      const chat = await getChat(normalizedChatId, tokenToUse);
      const chatId = String(chat.id);
      const now = new Date();

      const botTokenPatch =
        parsed.data.botToken !== undefined
          ? parsed.data.botToken?.trim() || null
          : undefined;

      const [updated] = await db
        .insert(groupTelegramSettings)
        .values({
          groupId,
          ...(botTokenPatch !== undefined ? { botToken: botTokenPatch } : {}),
          chatId,
          chatTitle: chat.title ?? chat.username ?? null,
          chatType: chat.type,
          status: "connected",
          linkedByUserId: session.user.id,
          linkedAt: now,
          lastError: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: groupTelegramSettings.groupId,
          set: {
            ...(botTokenPatch !== undefined ? { botToken: botTokenPatch } : {}),
            chatId,
            chatTitle: chat.title ?? chat.username ?? null,
            chatType: chat.type,
            status: "connected",
            linkedByUserId: session.user.id,
            linkedAt: now,
            lastError: null,
            updatedAt: now,
          },
        })
        .returning();

      const meta = telegramApiMeta(updated);
      return json({
        ...meta,
        settings: publicTelegramSettings(updated, true),
      });
    } catch (err) {
      const message =
        err instanceof TelegramApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Telegram verify failed";
      return json({ error: message }, { status: 502 });
    }
  } catch (error) {
    console.error("[telegram] connect", error);
    return json({ error: "Failed to connect Telegram" }, { status: 500 });
  }
};
