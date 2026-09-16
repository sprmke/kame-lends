import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupTelegramSettings } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import {
  hasGroupManageAccess,
  hasGroupViewAccess,
} from "$lib/server/group-access";
import { resolveGroupBotToken } from "$lib/server/telegram/config";
import { parseJsonBody, updateTelegramBodySchema } from "$lib/group-validation";
import { leaveChat } from "$lib/server/telegram/api";
import {
  publicTelegramSettings,
  telegramApiMeta,
} from "$lib/server/telegram/public-settings";

const defaultDisconnectedSettings = {
  status: "disconnected" as const,
  enabled: true,
  notifyUpcoming: true,
  reminderDays: [3, 1],
  notifyDueToday: true,
  notifyOverdue: true,
  overdueRepeatEveryDays: 1,
  notifyDailyDigest: false,
  notifyActivity: true,
  includeAmounts: true,
  botTokenConfigured: false,
};

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupViewAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const canManage = await hasGroupManageAccess(groupId, session.user.id);
    const settings = await db.query.groupTelegramSettings.findFirst({
      where: eq(groupTelegramSettings.groupId, groupId),
    });

    const meta = telegramApiMeta(settings);

    return json({
      ...meta,
      canManage,
      settings: settings
        ? publicTelegramSettings(settings, canManage)
        : {
            ...defaultDisconnectedSettings,
            botTokenConfigured: meta.configured,
          },
    });
  } catch (error) {
    console.error("[telegram] GET settings", error);
    return json({ error: "Failed to load Telegram settings" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const existing = await db.query.groupTelegramSettings.findFirst({
      where: eq(groupTelegramSettings.groupId, groupId),
    });

    const body = await event.request.json();
    const parsed = parseJsonBody(updateTelegramBodySchema, body);
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }

    const { templates: templatePatch, ...rest } = parsed.data;
    const patch = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    ) as Omit<typeof parsed.data, "templates">;

    const effectiveToken = resolveGroupBotToken(
      patch.botToken !== undefined ? patch.botToken : existing?.botToken,
    );
    if (!effectiveToken) {
      return json(
        { error: "Add a bot token or set TELEGRAM_BOT_TOKEN" },
        { status: 503 },
      );
    }

    const mergedTemplates =
      templatePatch && Object.keys(templatePatch).length > 0
        ? {
            ...(existing?.templates ?? {}),
            ...templatePatch,
          }
        : undefined;

    const dbPatch: Record<string, unknown> = {
      ...patch,
      updatedAt: new Date(),
    };
    if (mergedTemplates) {
      dbPatch.templates = mergedTemplates;
    }
    if (patch.botToken !== undefined) {
      dbPatch.botToken = patch.botToken?.trim() || null;
    }

    const [updated] = await db
      .insert(groupTelegramSettings)
      .values({ groupId, ...dbPatch })
      .onConflictDoUpdate({
        target: groupTelegramSettings.groupId,
        set: dbPatch,
      })
      .returning();

    return json(publicTelegramSettings(updated, true));
  } catch (error) {
    console.error("[telegram] PUT settings", error);
    return json(
      { error: "Failed to update Telegram settings" },
      { status: 500 },
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const existing = await db.query.groupTelegramSettings.findFirst({
      where: eq(groupTelegramSettings.groupId, groupId),
    });

    if (existing?.chatId) {
      const botToken = resolveGroupBotToken(existing.botToken);
      if (botToken) {
        try {
          await leaveChat(existing.chatId, botToken);
        } catch (err) {
          console.warn("[telegram] leaveChat failed", err);
        }
      }
    }

    await db
      .insert(groupTelegramSettings)
      .values({
        groupId,
        status: "disconnected",
        chatId: null,
        chatTitle: null,
        chatType: null,
        linkedByUserId: null,
        linkedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: groupTelegramSettings.groupId,
        set: {
          status: "disconnected",
          chatId: null,
          chatTitle: null,
          chatType: null,
          linkedByUserId: null,
          linkedAt: null,
          updatedAt: new Date(),
        },
      });

    return json({ success: true });
  } catch (error) {
    console.error("[telegram] DELETE disconnect", error);
    return json({ error: "Failed to disconnect Telegram" }, { status: 500 });
  }
};
