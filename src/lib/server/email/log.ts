import { db } from "$lib/server/db";
import { emailNotificationLog } from "$lib/server/db/schema";
import { and, desc, eq, lt, sql } from "drizzle-orm";

export function normalizeRecipientEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type EmailDeliveryClaim = {
  id: number;
  attempts: number;
};

/**
 * Claim one (recipient, fingerprint) pair before sending.
 *
 * - First insert claims it immediately.
 * - A failed row can be retried by the same job or the next cron.
 * - A claimed row older than ten minutes is treated as a crashed worker and
 *   reclaimed, so a process exit cannot block a reminder forever.
 */
export async function claimEmailDelivery(input: {
  recipientEmail: string;
  fingerprint: string;
  kind: string;
  userId?: string | null;
}): Promise<EmailDeliveryClaim | null> {
  const email = normalizeRecipientEmail(input.recipientEmail);
  if (!email) return null;

  const result = await db.execute(sql`
    INSERT INTO email_notification_log (
      user_id,
      recipient_email,
      fingerprint,
      kind,
      status,
      attempts
    )
    VALUES (
      ${input.userId ?? null},
      ${email},
      ${input.fingerprint},
      ${input.kind},
      'claimed',
      1
    )
    ON CONFLICT (recipient_email, fingerprint)
    DO UPDATE SET
      status = 'claimed',
      attempts = email_notification_log.attempts + 1,
      error = NULL,
      created_at = NOW(),
      sent_at = NULL
    WHERE email_notification_log.status = 'failed'
       OR (
         email_notification_log.status = 'claimed'
         AND email_notification_log.created_at < NOW() - INTERVAL '10 minutes'
       )
    RETURNING id, attempts
  `);

  const rows =
    (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ??
    (Array.isArray(result) ? (result as Array<Record<string, unknown>>) : []);
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    attempts: Number(row.attempts ?? 1),
  };
}

export async function markEmailSent(id: number): Promise<void> {
  await db
    .update(emailNotificationLog)
    .set({ status: "sent", sentAt: new Date(), error: null })
    .where(eq(emailNotificationLog.id, id));
}

export async function markEmailFailed(
  id: number,
  error: string,
): Promise<void> {
  await db
    .update(emailNotificationLog)
    .set({
      status: "failed",
      error: error.slice(0, 500),
      sentAt: null,
    })
    .where(eq(emailNotificationLog.id, id));
}

export async function pruneEmailNotificationLog(
  olderThanDays = 180,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(emailNotificationLog)
    .where(lt(emailNotificationLog.createdAt, cutoff))
    .returning();
  return result.length;
}

/** Last sent time for a reminder family, used for diagnostics and tests. */
export async function lastEmailSentAt(
  recipientEmail: string,
  kind: string,
): Promise<Date | null> {
  const row = await db.query.emailNotificationLog.findFirst({
    where: and(
      eq(
        emailNotificationLog.recipientEmail,
        normalizeRecipientEmail(recipientEmail),
      ),
      eq(emailNotificationLog.kind, kind),
      eq(emailNotificationLog.status, "sent"),
    ),
    orderBy: [desc(emailNotificationLog.sentAt)],
  });
  return row?.sentAt ?? null;
}
