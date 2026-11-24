import {
  claimEmailDelivery,
  markEmailFailed,
  markEmailSent,
  normalizeRecipientEmail,
} from "$lib/server/email/log";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "$lib/server/email/send-email";

export {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "$lib/server/email/send-email";

export type EmailSendOutcome = {
  status: "sent" | "skipped" | "failed";
  error?: string;
};

/** Notification email kill switch. Ops mail such as backups is not affected. */
export function emailNotificationsDisabled(): boolean {
  const value = process.env.EMAIL_NOTIFICATIONS_DISABLED?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function isEmailNotificationsEnabled(): boolean {
  return isTransactionalEmailConfigured() && !emailNotificationsDisabled();
}

export function emailNotificationKillSwitchState(): {
  configured: boolean;
  disabled: boolean;
} {
  return {
    configured: isTransactionalEmailConfigured(),
    disabled: emailNotificationsDisabled(),
  };
}

/**
 * Claim, send, and log one notification email.
 *
 * Never throws for expected delivery failures. Callers decide whether a failed
 * batch should fail the job so it retries. A duplicate fingerprint returns
 * `skipped` even if the first send is still in flight.
 */
export async function sendNotificationEmail(input: {
  to: string;
  userId?: string | null;
  fingerprint: string;
  kind: string;
  subject: string;
  html: string;
}): Promise<EmailSendOutcome> {
  if (!isEmailNotificationsEnabled()) {
    return { status: "skipped" };
  }

  const to = normalizeRecipientEmail(input.to);
  if (!to) return { status: "skipped" };

  const claim = await claimEmailDelivery({
    recipientEmail: to,
    fingerprint: input.fingerprint,
    kind: input.kind,
    userId: input.userId ?? null,
  });
  if (!claim) return { status: "skipped" };

  try {
    await sendTransactionalEmail({
      to,
      subject: input.subject,
      html: input.html,
    });
    await markEmailSent(claim.id);
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markEmailFailed(claim.id, message);
    return { status: "failed", error: message };
  }
}
