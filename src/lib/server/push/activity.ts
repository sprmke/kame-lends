import type { ActivityEvent } from "$lib/server/jobs/queue";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { getUserPushPreferences } from "$lib/server/push/preferences";
import { sendPushToUser } from "$lib/server/push/web-push";
import { eq, inArray } from "drizzle-orm";

const SUMMARY_MAP: Record<string, string> = {
  loan_added: "Loan added to group",
  loan_updated: "Loan updated",
  loan_created: "Loan created",
  disbursement: "Disbursement recorded",
  payment_received: "Payment received",
  interest_paid: "Interest paid",
  interest_extended: "Interest extended",
  loan_completed: "Loan completed",
};

export async function sendUserActivityPush(
  userIds: string[],
  event: ActivityEvent,
): Promise<void> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const updatedAt = event.updatedAt ?? new Date().toISOString();
  const summary =
    event.summary?.trim() ||
    SUMMARY_MAP[event.type] ||
    event.type.replaceAll("_", " ");
  const path = event.loanId ? `/loans/${event.loanId}` : "/loans";
  const fingerprint = `activity:${event.type}:${event.entityId}:${updatedAt}`;

  for (const userId of uniqueIds) {
    const prefs = await getUserPushPreferences(userId);
    if (!prefs.notifyActivity) continue;

    await sendPushToUser(
      userId,
      {
        title: "Kame Lends",
        body: summary,
        path,
        tag: fingerprint,
      },
      { fingerprint: `${fingerprint}:${userId}`, kind: "activity" },
    );
  }
}

export async function resolveLoanActivityUserIds(
  loanOwnerUserId: string,
  participantEmails: string[],
): Promise<string[]> {
  const emails = [
    ...new Set(
      participantEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  const ids = new Set<string>([loanOwnerUserId]);

  if (emails.length > 0) {
    const matched = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, emails));
    for (const row of matched) ids.add(row.id);
  }

  return [...ids];
}

export async function enqueuePushForLoanActivity(
  loanOwnerUserId: string,
  participantEmails: string[],
  event: ActivityEvent,
): Promise<void> {
  const userIds = await resolveLoanActivityUserIds(
    loanOwnerUserId,
    participantEmails,
  );
  await sendUserActivityPush(userIds, event);
}
