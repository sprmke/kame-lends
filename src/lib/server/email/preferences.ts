import { db } from "$lib/server/db";
import { userEmailPreferences, users } from "$lib/server/db/schema";
import type { EmailPreferencesPatch } from "$lib/schemas/email-preferences";
import {
  DEFAULT_REMINDER_DAYS,
  normalizeReminderDays,
} from "$lib/schemas/email-preferences";
import { eq, inArray, sql } from "drizzle-orm";

export type ResolvedEmailPreferences = {
  userId: string | null;
  emailEnabled: boolean;
  notifyActivity: boolean;
  notifySigningRequests: boolean;
  notifySigningReminders: boolean;
  signingReminderFirstAfterDays: number;
  signingReminderRepeatEveryDays: number;
  notifyDueReminders: boolean;
  reminderDays: number[];
  notifyDueToday: boolean;
  notifyOverdue: boolean;
  overdueRepeatEveryDays: number;
  includeAmounts: boolean;
};

export function defaultEmailPreferences(
  userId: string | null = null,
): ResolvedEmailPreferences {
  return {
    userId,
    emailEnabled: true,
    notifyActivity: true,
    notifySigningRequests: true,
    notifySigningReminders: true,
    signingReminderFirstAfterDays: 3,
    signingReminderRepeatEveryDays: 3,
    notifyDueReminders: true,
    reminderDays: [...DEFAULT_REMINDER_DAYS],
    notifyDueToday: true,
    notifyOverdue: true,
    overdueRepeatEveryDays: 3,
    includeAmounts: true,
  };
}

export function resolveEmailPreferencesFromRow(
  row: typeof userEmailPreferences.$inferSelect | null | undefined,
  userId: string | null = null,
): ResolvedEmailPreferences {
  if (!row) return defaultEmailPreferences(userId);
  return {
    userId: row.userId,
    emailEnabled: row.emailEnabled,
    notifyActivity: row.notifyActivity,
    notifySigningRequests: row.notifySigningRequests,
    notifySigningReminders: row.notifySigningReminders,
    signingReminderFirstAfterDays: row.signingReminderFirstAfterDays,
    signingReminderRepeatEveryDays: row.signingReminderRepeatEveryDays,
    notifyDueReminders: row.notifyDueReminders,
    reminderDays: normalizeReminderDays(row.reminderDays),
    notifyDueToday: row.notifyDueToday,
    notifyOverdue: row.notifyOverdue,
    overdueRepeatEveryDays: row.overdueRepeatEveryDays,
    includeAmounts: row.includeAmounts,
  };
}

/** Read preferences for one user, creating the default row on first read. */
export async function getUserEmailPreferences(
  userId: string,
): Promise<ResolvedEmailPreferences> {
  const row = await db.query.userEmailPreferences.findFirst({
    where: eq(userEmailPreferences.userId, userId),
  });
  if (row) return resolveEmailPreferencesFromRow(row, userId);

  const inserted = await db
    .insert(userEmailPreferences)
    .values({ userId })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) {
    return resolveEmailPreferencesFromRow(inserted[0], userId);
  }

  const fallback = await db.query.userEmailPreferences.findFirst({
    where: eq(userEmailPreferences.userId, userId),
  });
  return resolveEmailPreferencesFromRow(fallback, userId);
}

/**
 * Batch read for crons. Missing rows resolve to defaults and are not written,
 * so a large account does not create a row for every party on every run.
 */
export async function getEmailPreferencesByUserIds(
  userIds: string[],
): Promise<Map<string, ResolvedEmailPreferences>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ResolvedEmailPreferences>();
  if (unique.length === 0) return map;

  const rows = await db
    .select()
    .from(userEmailPreferences)
    .where(inArray(userEmailPreferences.userId, unique));

  for (const row of rows) {
    map.set(row.userId, resolveEmailPreferencesFromRow(row, row.userId));
  }
  for (const userId of unique) {
    if (!map.has(userId)) {
      map.set(userId, defaultEmailPreferences(userId));
    }
  }
  return map;
}

/** Batch read keyed by normalized email for party emails. */
export async function getEmailPreferencesByEmails(
  emails: string[],
): Promise<Map<string, ResolvedEmailPreferences>> {
  const normalized = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  const map = new Map<string, ResolvedEmailPreferences>();
  if (normalized.length === 0) return map;

  const rows = await db
    .select({
      email: users.email,
      id: users.id,
    })
    .from(users)
    .where(inArray(sql`lower(${users.email})`, normalized));

  const byUserId = await getEmailPreferencesByUserIds(
    rows.map((row) => row.id),
  );
  for (const row of rows) {
    const prefs = byUserId.get(row.id) ?? defaultEmailPreferences(row.id);
    map.set(row.email.trim().toLowerCase(), { ...prefs, userId: row.id });
  }
  for (const email of normalized) {
    if (!map.has(email)) {
      map.set(email, defaultEmailPreferences(null));
    }
  }
  return map;
}

export async function updateUserEmailPreferences(
  userId: string,
  patch: EmailPreferencesPatch,
): Promise<ResolvedEmailPreferences> {
  await getUserEmailPreferences(userId);

  const values: Partial<typeof userEmailPreferences.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.emailEnabled !== undefined)
    values.emailEnabled = patch.emailEnabled;
  if (patch.notifyActivity !== undefined) {
    values.notifyActivity = patch.notifyActivity;
  }
  if (patch.notifySigningRequests !== undefined) {
    values.notifySigningRequests = patch.notifySigningRequests;
  }
  if (patch.notifySigningReminders !== undefined) {
    values.notifySigningReminders = patch.notifySigningReminders;
  }
  if (patch.signingReminderFirstAfterDays !== undefined) {
    values.signingReminderFirstAfterDays = patch.signingReminderFirstAfterDays;
  }
  if (patch.signingReminderRepeatEveryDays !== undefined) {
    values.signingReminderRepeatEveryDays =
      patch.signingReminderRepeatEveryDays;
  }
  if (patch.notifyDueReminders !== undefined) {
    values.notifyDueReminders = patch.notifyDueReminders;
  }
  if (patch.reminderDays !== undefined) {
    values.reminderDays = normalizeReminderDays(patch.reminderDays);
  }
  if (patch.notifyDueToday !== undefined) {
    values.notifyDueToday = patch.notifyDueToday;
  }
  if (patch.notifyOverdue !== undefined) {
    values.notifyOverdue = patch.notifyOverdue;
  }
  if (patch.overdueRepeatEveryDays !== undefined) {
    values.overdueRepeatEveryDays = patch.overdueRepeatEveryDays;
  }
  if (patch.includeAmounts !== undefined) {
    values.includeAmounts = patch.includeAmounts;
  }

  const updated = await db
    .update(userEmailPreferences)
    .set(values)
    .where(eq(userEmailPreferences.userId, userId))
    .returning();

  return resolveEmailPreferencesFromRow(updated[0], userId);
}
