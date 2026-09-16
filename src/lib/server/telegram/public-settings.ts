import type { groupTelegramSettings } from "$lib/server/db/schema";
import { mergeGroupTelegramTemplates } from "$lib/groups/group-telegram-templates";
import {
  hasEnvTelegramBotToken,
  isTelegramBotAvailable,
  isTelegramConfigured,
} from "$lib/server/telegram/config";

export function publicTelegramSettings(
  row: typeof groupTelegramSettings.$inferSelect,
  canManage: boolean,
) {
  const botTokenConfigured =
    Boolean(row.botToken?.trim()) || hasEnvTelegramBotToken();

  const base = {
    status: row.status,
    enabled: row.enabled,
    notifyUpcoming: row.notifyUpcoming,
    reminderDays: row.reminderDays,
    notifyDueToday: row.notifyDueToday,
    notifyOverdue: row.notifyOverdue,
    overdueRepeatEveryDays: row.overdueRepeatEveryDays,
    notifyDailyDigest: row.notifyDailyDigest,
    notifyActivity: row.notifyActivity,
    includeAmounts: row.includeAmounts,
    chatTitle: row.chatTitle,
    chatType: row.chatType,
    linkedAt: row.linkedAt,
    lastSentAt: row.lastSentAt,
    lastError: row.lastError,
    botTokenConfigured,
  };

  if (!canManage) {
    return {
      status: row.status,
      chatTitle: row.chatTitle,
      chatType: row.chatType,
      linkedAt: row.linkedAt,
    };
  }

  return {
    ...base,
    templates: mergeGroupTelegramTemplates(row.templates),
  };
}

export function telegramApiMeta(
  row?: typeof groupTelegramSettings.$inferSelect,
) {
  return {
    configured: isTelegramBotAvailable(row?.botToken),
    startGroupAvailable: isTelegramConfigured(),
  };
}
