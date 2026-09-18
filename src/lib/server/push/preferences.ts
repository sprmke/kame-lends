import { db } from "$lib/server/db";
import { userPushPreferences } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

export type UserPushPreferences = typeof userPushPreferences.$inferSelect;

export async function getUserPushPreferences(
  userId: string,
): Promise<UserPushPreferences> {
  const row = await db.query.userPushPreferences.findFirst({
    where: eq(userPushPreferences.userId, userId),
  });
  if (row) return row;

  const inserted = await db
    .insert(userPushPreferences)
    .values({ userId })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) return inserted[0];

  const fallback = await db.query.userPushPreferences.findFirst({
    where: eq(userPushPreferences.userId, userId),
  });
  if (!fallback) {
    throw new Error("Failed to load push preferences");
  }
  return fallback;
}

export async function updateUserPushPreferences(
  userId: string,
  input: Partial<
    Pick<
      UserPushPreferences,
      | "notifyUpcoming"
      | "reminderDays"
      | "notifyDueToday"
      | "notifyOverdue"
      | "notifyActivity"
      | "notifySigning"
    >
  >,
): Promise<UserPushPreferences> {
  await getUserPushPreferences(userId);
  const updated = await db
    .update(userPushPreferences)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(userPushPreferences.userId, userId))
    .returning();
  return updated[0];
}
