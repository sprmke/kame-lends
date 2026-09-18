import { manilaTodayKey } from "$lib/calendar-sync-plan";
import {
  planGroupNotifications,
  type GroupNotificationSettings,
} from "$lib/group-notification-plan";
import { db } from "$lib/server/db";
import { pushSubscriptions } from "$lib/server/db/schema";
import { getCachedLoans } from "$lib/server/cached-data";
import { resolveAppUrl } from "$lib/server/app-url";
import { getUserPushPreferences } from "$lib/server/push/preferences";
import { sendPushToUser } from "$lib/server/push/web-push";
import type { LoanWithInvestors } from "$lib/types";
import { isNull } from "drizzle-orm";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Deep link for user-scoped push reminders (not group Telegram). */
export function pushReminderPath(kind: string): string {
  return kind === "overdue" ? "/loans?scope=commissioned" : "/dashboard";
}

function settingsFromPreferences(
  prefs: Awaited<ReturnType<typeof getUserPushPreferences>>,
): GroupNotificationSettings {
  return {
    notifyUpcoming: prefs.notifyUpcoming,
    reminderDays: prefs.reminderDays ?? [3, 1],
    notifyDueToday: prefs.notifyDueToday,
    notifyOverdue: prefs.notifyOverdue,
    overdueRepeatEveryDays: 1,
    notifyDailyDigest: false,
    includeAmounts: true,
  };
}

export async function runUserPushDailyReminders(
  todayKey: string = manilaTodayKey(),
): Promise<{ users: number; planned: number; sent: number; skipped: number }> {
  const result = { users: 0, planned: 0, sent: 0, skipped: 0 };
  const appUrl = resolveAppUrl();

  const rows = await db
    .selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(isNull(pushSubscriptions.disabledAt));

  for (const { userId } of rows) {
    result.users += 1;
    const prefs = await getUserPushPreferences(userId);
    const loans = (await getCachedLoans(userId, "list")) as LoanWithInvestors[];
    const notifications = planGroupNotifications(
      loans,
      settingsFromPreferences(prefs),
      todayKey,
      { appUrl, groupId: 0 },
    );

    result.planned += notifications.length;

    for (const notification of notifications) {
      const outcome = await sendPushToUser(
        userId,
        {
          title: "Kame Lends",
          body: stripHtml(notification.html),
          path: pushReminderPath(notification.kind),
          tag: notification.fingerprint,
        },
        { fingerprint: notification.fingerprint, kind: notification.kind },
      );
      if (outcome.skipped) result.skipped += 1;
      else if (outcome.sent > 0) result.sent += 1;
    }
  }

  console.info("[push] daily reminders", result);
  return result;
}
