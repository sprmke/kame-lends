import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { userEmailPreferences, users } from "$lib/server/db/schema";
import {
  defaultEmailPreferences,
  getEmailPreferencesByEmails,
  getEmailPreferencesByUserIds,
  getUserEmailPreferences,
  updateUserEmailPreferences,
} from "$lib/server/email/preferences";

let userIds: string[] = [];
let email: string;

beforeEach(async () => {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  email = `email-prefs-${tag}@example.test`;
  userIds = [`test-email-prefs-${tag}`];
  await db.insert(users).values({
    id: userIds[0]!,
    name: "Email Prefs Fixture",
    email,
  });
});

afterEach(async () => {
  if (userIds.length > 0) {
    await db
      .delete(userEmailPreferences)
      .where(inArray(userEmailPreferences.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});

describe("email preferences", () => {
  it("creates the default row on first read", async () => {
    const prefs = await getUserEmailPreferences(userIds[0]!);
    expect(prefs.emailEnabled).toBe(true);
    expect(prefs.notifyActivity).toBe(true);
    expect(prefs.reminderDays).toEqual([3, 1]);
    expect(prefs.signingReminderFirstAfterDays).toBe(3);

    const rows = await db
      .select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userIds[0]!));
    expect(rows).toHaveLength(1);
  });

  it("persists updates", async () => {
    const updated = await updateUserEmailPreferences(userIds[0]!, {
      notifyActivity: false,
      reminderDays: [7, 1],
      signingReminderFirstAfterDays: 5,
      includeAmounts: false,
    });

    expect(updated.notifyActivity).toBe(false);
    expect(updated.reminderDays).toEqual([7, 1]);
    expect(updated.signingReminderFirstAfterDays).toBe(5);
    expect(updated.includeAmounts).toBe(false);
  });

  it("batch resolves defaults for users without a row", async () => {
    const secondId = `${userIds[0]}-two`;
    const secondEmail = `email-prefs-two-${Date.now()}@example.test`;
    userIds.push(secondId);
    await db.insert(users).values({
      id: secondId,
      name: "Second",
      email: secondEmail,
    });

    await updateUserEmailPreferences(userIds[0]!, { notifyOverdue: false });

    const map = await getEmailPreferencesByUserIds([userIds[0]!, secondId]);
    expect(map.get(userIds[0]!)?.notifyOverdue).toBe(false);
    expect(map.get(secondId)?.notifyOverdue).toBe(
      defaultEmailPreferences(secondId).notifyOverdue,
    );
  });

  it("resolves preferences by normalized email", async () => {
    await updateUserEmailPreferences(userIds[0]!, { notifyDueToday: false });

    const map = await getEmailPreferencesByEmails([
      email.toUpperCase(),
      "unknown@example.test",
    ]);
    expect(map.get(email.toLowerCase())?.notifyDueToday).toBe(false);
    expect(map.get("unknown@example.test")?.notifyDueToday).toBe(true);
  });
});
