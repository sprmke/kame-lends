import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { emailNotificationLog, users } from "$lib/server/db/schema";
import {
  claimEmailDelivery,
  markEmailFailed,
  markEmailSent,
  normalizeRecipientEmail,
  pruneEmailNotificationLog,
} from "$lib/server/email/log";

let userId: string;
let email: string;

beforeEach(async () => {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  userId = `test-email-log-${tag}`;
  email = `Email-Log-${tag}@Example.Test`;
  await db.insert(users).values({
    id: userId,
    name: "Email Log Fixture",
    email: email.toLowerCase(),
  });
});

afterEach(async () => {
  await db
    .delete(emailNotificationLog)
    .where(eq(emailNotificationLog.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
});

describe("email notification log", () => {
  it("claims a fingerprint once", async () => {
    const fingerprint = `test:${userId}:once`;
    const first = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    expect(first).not.toBeNull();
    expect(first?.attempts).toBe(1);

    const second = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    expect(second).toBeNull();
  });

  it("allows a failed send to retry", async () => {
    const fingerprint = `test:${userId}:retry`;
    const first = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    await markEmailFailed(first!.id, "smtp down");

    const retry = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    expect(retry).not.toBeNull();
    expect(retry?.attempts).toBe(2);
  });

  it("does not resend a sent fingerprint", async () => {
    const fingerprint = `test:${userId}:sent`;
    const first = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    await markEmailSent(first!.id);

    const second = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    expect(second).toBeNull();
  });

  it("reclaims a stale claimed row", async () => {
    const fingerprint = `test:${userId}:stale`;
    const first = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    await db
      .update(emailNotificationLog)
      .set({ createdAt: new Date(Date.now() - 20 * 60 * 1000) })
      .where(eq(emailNotificationLog.id, first!.id));

    const retry = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    expect(retry).not.toBeNull();
    expect(retry?.attempts).toBe(2);
  });

  it("normalizes recipient emails", () => {
    expect(normalizeRecipientEmail("  Ada@Example.COM ")).toBe(
      "ada@example.com",
    );
  });

  it("prunes old rows", async () => {
    const fingerprint = `test:${userId}:prune`;
    const first = await claimEmailDelivery({
      recipientEmail: email,
      fingerprint,
      kind: "activity",
      userId,
    });
    await db
      .update(emailNotificationLog)
      .set({ createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) })
      .where(eq(emailNotificationLog.id, first!.id));

    const pruned = await pruneEmailNotificationLog(180);
    expect(pruned).toBeGreaterThanOrEqual(1);
  });
});
