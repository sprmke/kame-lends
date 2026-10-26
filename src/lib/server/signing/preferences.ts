import { db } from "$lib/server/db";
import { userSigningPreferences } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

export type UserSigningPreferences = typeof userSigningPreferences.$inferSelect;

export async function getUserSigningPreferences(
  userId: string,
): Promise<UserSigningPreferences> {
  const row = await db.query.userSigningPreferences.findFirst({
    where: eq(userSigningPreferences.userId, userId),
  });
  if (row) return row;

  const inserted = await db
    .insert(userSigningPreferences)
    .values({ userId })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) return inserted[0];

  const fallback = await db.query.userSigningPreferences.findFirst({
    where: eq(userSigningPreferences.userId, userId),
  });
  if (!fallback) {
    throw new Error("Failed to load signing preferences");
  }
  return fallback;
}

export async function updateUserSigningPreferences(
  userId: string,
  input: Pick<UserSigningPreferences, "autoAttachSignature">,
): Promise<UserSigningPreferences> {
  await getUserSigningPreferences(userId);
  const updated = await db
    .update(userSigningPreferences)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(userSigningPreferences.userId, userId))
    .returning();
  return updated[0];
}

export async function isAutoAttachSignatureEnabled(
  userId: string,
): Promise<boolean> {
  const prefs = await getUserSigningPreferences(userId);
  return prefs.autoAttachSignature === true;
}
