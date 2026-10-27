import { db } from "$lib/server/db";
import {
  groupNotificationLog,
  groupTelegramSettings,
  loanGroupLoans,
  loanGroups,
  loanInvestors,
  loanSigningInvitations,
  loans,
} from "$lib/server/db/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { manilaTodayKey } from "$lib/calendar-sync-plan";
import {
  buildGroupTelegramActivityHtml,
  buildGroupTelegramTestHtml,
  planGroupNotifications,
  type GroupNotificationSettings,
} from "$lib/group-notification-plan";
import {
  planUnsignedSigningReminder,
  signingReminderSlot,
  type UnsignedLoanInput,
  type UnsignedSigningSettings,
} from "$lib/groups/unsigned-signing-reminder";
import type { ActivityEvent } from "$lib/server/jobs/queue";
import {
  sendMessage,
  TelegramBotKickedError,
  formatTelegramNetworkError,
} from "$lib/server/telegram/api";
import { resolveGroupBotToken } from "$lib/server/telegram/config";
import { env as publicEnv } from "$env/dynamic/public";

const MAX_FAILED_ATTEMPTS = 3;

function readAppUrl(): string {
  const url = publicEnv.PUBLIC_APP_URL?.trim() || process.env.PUBLIC_APP_URL;
  return url?.replace(/\/$/, "") || "https://example.com";
}

import type { LoanWithInvestors } from "$lib/types";

const loanQueryShape = {
  with: {
    borrower: true,
    loanWitnesses: { with: { witness: true } },
    loanInvestors: {
      with: {
        investor: true,
        interestPeriods: true,
        receivedPayments: { columns: { amount: true } },
      },
    },
  },
} as const;

async function loadGroupName(groupId: number): Promise<string> {
  const row = await db.query.loanGroups.findFirst({
    where: eq(loanGroups.id, groupId),
    columns: { name: true },
  });
  return row?.name?.trim() ?? "";
}

export async function loadLoanForTelegram(
  loanId: number,
): Promise<LoanWithInvestors | null> {
  const row = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    ...loanQueryShape,
  });
  return (row as unknown as LoanWithInvestors) ?? null;
}

export async function loadGroupLoansForNotifications(
  groupId: number,
): Promise<LoanWithInvestors[]> {
  const links = await db
    .select({ loanId: loanGroupLoans.loanId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.groupId, groupId));

  if (links.length === 0) return [];

  return (await db.query.loans.findMany({
    where: inArray(
      loans.id,
      links.map((row) => row.loanId),
    ),
    ...loanQueryShape,
  })) as unknown as LoanWithInvestors[];
}

function settingsFromRow(
  row: typeof groupTelegramSettings.$inferSelect,
): GroupNotificationSettings {
  return {
    notifyUpcoming: row.notifyUpcoming,
    reminderDays: row.reminderDays ?? [3, 1],
    notifyDueToday: row.notifyDueToday,
    notifyOverdue: row.notifyOverdue,
    overdueRepeatEveryDays: row.overdueRepeatEveryDays,
    notifyDailyDigest: row.notifyDailyDigest,
    includeAmounts: row.includeAmounts,
  };
}

async function markBotRemoved(groupId: number, error: string): Promise<void> {
  await db
    .update(groupTelegramSettings)
    .set({
      status: "bot_removed",
      lastError: error,
      updatedAt: new Date(),
    })
    .where(eq(groupTelegramSettings.groupId, groupId));
}

async function updateChatId(groupId: number, chatId: string): Promise<void> {
  await db
    .update(groupTelegramSettings)
    .set({ chatId, updatedAt: new Date() })
    .where(eq(groupTelegramSettings.groupId, groupId));
}

export async function sendGroupNotification(input: {
  groupId: number;
  chatId: string;
  fingerprint: string;
  kind: string;
  html: string;
  botToken?: string | null;
  /** When set, skip INSERT and send for an existing failed log row. */
  logId?: number;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const botToken = input.botToken?.trim() || null;
  if (!botToken) {
    return { sent: false, error: "Telegram bot token not configured" };
  }

  let logId = input.logId;

  if (!logId) {
    const inserted = await db
      .insert(groupNotificationLog)
      .values({
        groupId: input.groupId,
        fingerprint: input.fingerprint,
        kind: input.kind,
        status: "claimed",
      })
      .onConflictDoNothing()
      .returning();

    if (!inserted[0]) {
      return { sent: false, skipped: true };
    }
    logId = inserted[0].id;
  }

  try {
    const result = await sendMessage(input.chatId, input.html, {
      botToken,
      onMigrate: (newChatId) => updateChatId(input.groupId, newChatId),
    });
    const messageId = result.messageIds[0] ?? null;
    const now = new Date();

    await db
      .update(groupNotificationLog)
      .set({
        status: "sent",
        telegramMessageId: messageId,
        sentAt: now,
        error: null,
      })
      .where(eq(groupNotificationLog.id, logId));

    await db
      .update(groupTelegramSettings)
      .set({
        lastSentAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(groupTelegramSettings.groupId, input.groupId));

    return { sent: true };
  } catch (err) {
    const message = formatTelegramNetworkError(err);
    if (err instanceof TelegramBotKickedError) {
      await markBotRemoved(input.groupId, message);
    }

    await db
      .update(groupNotificationLog)
      .set({
        status: "failed",
        error: message,
        attempts: sql`${groupNotificationLog.attempts} + 1`,
      })
      .where(eq(groupNotificationLog.id, logId));

    await db
      .update(groupTelegramSettings)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(groupTelegramSettings.groupId, input.groupId));

    return { sent: false, error: message };
  }
}

export async function sendGroupActivityNotification(
  groupId: number,
  event: unknown,
): Promise<void> {
  const settings = await db.query.groupTelegramSettings.findFirst({
    where: eq(groupTelegramSettings.groupId, groupId),
  });

  if (
    !settings ||
    settings.status !== "connected" ||
    !settings.enabled ||
    !settings.notifyActivity ||
    !settings.chatId
  ) {
    return;
  }

  const botToken = resolveGroupBotToken(settings.botToken);
  if (!botToken) return;

  const activity = event as ActivityEvent;
  const updatedAt = activity.updatedAt ?? new Date().toISOString();
  const fingerprint = `activity:${activity.type}:${activity.entityId}:${updatedAt}`;
  const appUrl = readAppUrl();
  const summary = activity.summary?.trim() || formatActivitySummary(activity);
  const loanId = activity.loanId ?? null;
  const loan = loanId != null ? await loadLoanForTelegram(loanId) : null;
  const html = buildGroupTelegramActivityHtml({
    type: activity.type,
    summary,
    loan,
    appUrl,
    groupId,
    groupName: await loadGroupName(groupId),
    includeAmounts: settings.includeAmounts !== false,
    templates: settings.templates,
    detail: activity.detail,
    loanId,
  });

  await sendGroupNotification({
    groupId,
    chatId: settings.chatId,
    fingerprint,
    kind: "activity",
    html,
    botToken,
  });
}

function formatActivitySummary(activity: ActivityEvent): string {
  const map: Record<string, string> = {
    loan_added: "Loan added",
    loan_updated: "Loan updated",
    loan_created: "New loan",
    disbursement: "Disbursement recorded",
    payment_received: "Payment received",
    interest_paid: "Payment received",
    interest_extended: "Interest extended",
    loan_completed: "Loan completed",
    loan_removed: "Loan removed",
    contract_signed: "Contract signed",
  };
  return map[activity.type] ?? activity.type.replaceAll("_", " ");
}

export type DailyReminderResult = {
  groups: number;
  planned: number;
  sent: number;
  skipped: number;
  failed: number;
  retried: number;
};

/** Daily cron entry: reminders, digest, and failed retries. */
export async function runGroupTelegramDailyReminders(
  todayKey: string = manilaTodayKey(),
): Promise<DailyReminderResult> {
  const result: DailyReminderResult = {
    groups: 0,
    planned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    retried: 0,
  };

  const connected = await db.query.groupTelegramSettings.findMany({
    where: and(
      eq(groupTelegramSettings.status, "connected"),
      eq(groupTelegramSettings.enabled, true),
    ),
  });

  const appUrl = readAppUrl();

  for (const settings of connected) {
    if (!settings.chatId) continue;
    const botToken = resolveGroupBotToken(settings.botToken);
    if (!botToken) continue;

    result.groups += 1;

    const groupLoans = await loadGroupLoansForNotifications(settings.groupId);
    const groupName = await loadGroupName(settings.groupId);
    const notifications = planGroupNotifications(
      groupLoans,
      settingsFromRow(settings),
      todayKey,
      {
        appUrl,
        groupId: settings.groupId,
        groupName,
        templates: settings.templates,
      },
    );

    result.planned += notifications.length;

    for (const notification of notifications) {
      const outcome = await sendGroupNotification({
        groupId: settings.groupId,
        chatId: settings.chatId,
        fingerprint: notification.fingerprint,
        kind: notification.kind,
        html: notification.html,
        botToken,
      });
      if (outcome.skipped) result.skipped += 1;
      else if (outcome.sent) result.sent += 1;
      else result.failed += 1;
    }
  }

  const failedRows = await db.query.groupNotificationLog.findMany({
    where: and(
      eq(groupNotificationLog.status, "failed"),
      lt(groupNotificationLog.attempts, MAX_FAILED_ATTEMPTS),
    ),
    limit: 50,
  });

  for (const row of failedRows) {
    const settings = await db.query.groupTelegramSettings.findFirst({
      where: eq(groupTelegramSettings.groupId, row.groupId),
    });
    if (
      !settings?.chatId ||
      settings.status !== "connected" ||
      !settings.enabled
    ) {
      continue;
    }

    const botToken = resolveGroupBotToken(settings.botToken);
    if (!botToken) continue;

    const groupLoans = await loadGroupLoansForNotifications(row.groupId);
    const match = planGroupNotifications(
      groupLoans,
      settingsFromRow(settings),
      todayKey,
      {
        appUrl,
        groupId: row.groupId,
        groupName: await loadGroupName(row.groupId),
        templates: settings.templates,
      },
    ).find((n) => n.fingerprint === row.fingerprint);

    if (!match?.html) continue;

    result.retried += 1;
    const outcome = await sendGroupNotification({
      groupId: row.groupId,
      chatId: settings.chatId,
      fingerprint: row.fingerprint,
      kind: row.kind,
      html: match.html,
      botToken,
      logId: row.id,
    });
    if (outcome.sent) result.sent += 1;
    else result.failed += 1;
  }

  console.info("[telegram] daily reminders", result);
  return result;
}

function unsignedSettingsFromRow(
  row: typeof groupTelegramSettings.$inferSelect,
): UnsignedSigningSettings {
  return {
    notifyUnsigned: row.notifyUnsigned,
    intervalHours: row.signingReminderIntervalHours,
    requireBorrower: row.requireBorrowerSignature,
    requireInvestor: row.requireInvestorSignature,
    requireWitness: row.requireWitnessSignature,
  };
}

async function loadGroupLoansForSigningReminders(
  groupId: number,
): Promise<UnsignedLoanInput[]> {
  const links = await db
    .select({ loanId: loanGroupLoans.loanId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.groupId, groupId));
  if (links.length === 0) return [];

  const loanIds = links.map((row) => row.loanId);
  const [loanRows, invitations, amounts] = await Promise.all([
    db
      .select({
        id: loans.id,
        loanName: loans.loanName,
        status: loans.status,
        type: loans.type,
        dueDate: loans.dueDate,
      })
      .from(loans)
      .where(inArray(loans.id, loanIds)),
    db
      .select({
        loanId: loanSigningInvitations.loanId,
        partyRole: loanSigningInvitations.partyRole,
        partyName: loanSigningInvitations.partyName,
        signedAt: loanSigningInvitations.signedAt,
      })
      .from(loanSigningInvitations)
      .where(inArray(loanSigningInvitations.loanId, loanIds)),
    db
      .select({
        loanId: loanInvestors.loanId,
        amount: loanInvestors.amount,
      })
      .from(loanInvestors)
      .where(inArray(loanInvestors.loanId, loanIds)),
  ]);

  return loanRows.map((loan) => ({
    id: loan.id,
    loanName: loan.loanName,
    status: loan.status,
    loanType: loan.type,
    dueDate: loan.dueDate,
    principal: amounts
      .filter((row) => row.loanId === loan.id)
      .reduce((sum, row) => sum + (Number.parseFloat(row.amount) || 0), 0),
    invitations: invitations
      .filter((invitation) => invitation.loanId === loan.id)
      .map((invitation) => ({
        partyRole: invitation.partyRole,
        partyName: invitation.partyName,
        signedAt: invitation.signedAt,
      })),
  }));
}

export type SigningReminderResult = {
  groups: number;
  planned: number;
  sent: number;
  skipped: number;
  failed: number;
};

/** Hourly cron entry: one digest per group for contracts still waiting on signatures. */
export async function runGroupTelegramSigningReminders(
  now: Date = new Date(),
): Promise<SigningReminderResult> {
  const result: SigningReminderResult = {
    groups: 0,
    planned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  const connected = await db.query.groupTelegramSettings.findMany({
    where: and(
      eq(groupTelegramSettings.status, "connected"),
      eq(groupTelegramSettings.enabled, true),
      eq(groupTelegramSettings.notifyUnsigned, true),
    ),
  });

  const appUrl = readAppUrl();

  for (const settings of connected) {
    if (!settings.chatId) continue;
    const botToken = resolveGroupBotToken(settings.botToken);
    if (!botToken) continue;
    if (!signingReminderSlot(now, settings.signingReminderIntervalHours)) {
      continue;
    }

    const groupLoans = await loadGroupLoansForSigningReminders(
      settings.groupId,
    );
    const notification = planUnsignedSigningReminder(
      groupLoans,
      unsignedSettingsFromRow(settings),
      now,
      {
        appUrl,
        groupId: settings.groupId,
        groupName: await loadGroupName(settings.groupId),
        includeAmounts: settings.includeAmounts,
        templates: settings.templates,
      },
    );
    if (!notification) continue;

    result.groups += 1;
    result.planned += 1;

    let outcome = await sendGroupNotification({
      groupId: settings.groupId,
      chatId: settings.chatId,
      fingerprint: notification.fingerprint,
      kind: notification.kind,
      html: notification.html,
      botToken,
    });

    if (outcome.skipped) {
      const existing = await db.query.groupNotificationLog.findFirst({
        where: and(
          eq(groupNotificationLog.groupId, settings.groupId),
          eq(groupNotificationLog.fingerprint, notification.fingerprint),
        ),
      });
      if (
        existing?.status === "failed" &&
        existing.attempts < MAX_FAILED_ATTEMPTS
      ) {
        outcome = await sendGroupNotification({
          groupId: settings.groupId,
          chatId: settings.chatId,
          fingerprint: notification.fingerprint,
          kind: notification.kind,
          html: notification.html,
          botToken,
          logId: existing.id,
        });
      }
    }

    if (outcome.skipped) result.skipped += 1;
    else if (outcome.sent) result.sent += 1;
    else result.failed += 1;
  }

  console.info("[telegram] signing reminders", result);
  return result;
}

export async function sendGroupTelegramTestMessage(
  groupId: number,
): Promise<{ ok: boolean; error?: string; messageIds?: string[] }> {
  const settings = await db.query.groupTelegramSettings.findFirst({
    where: eq(groupTelegramSettings.groupId, groupId),
  });

  if (!settings?.chatId || settings.status !== "connected") {
    return { ok: false, error: "Telegram is not connected for this group" };
  }

  const botToken = resolveGroupBotToken(settings.botToken);
  if (!botToken) {
    return { ok: false, error: "Telegram bot token not configured" };
  }

  const appUrl = readAppUrl();
  const html = buildGroupTelegramTestHtml(
    appUrl,
    groupId,
    settings.templates,
    await loadGroupName(groupId),
  );

  try {
    const result = await sendMessage(settings.chatId, html, {
      botToken,
      onMigrate: (newChatId) => updateChatId(groupId, newChatId),
    });
    await db
      .update(groupTelegramSettings)
      .set({ lastSentAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(groupTelegramSettings.groupId, groupId));
    return { ok: true, messageIds: result.messageIds };
  } catch (err) {
    const message = formatTelegramNetworkError(err);
    if (err instanceof TelegramBotKickedError) {
      await markBotRemoved(groupId, message);
    }
    await db
      .update(groupTelegramSettings)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(groupTelegramSettings.groupId, groupId));
    return { ok: false, error: message };
  }
}
