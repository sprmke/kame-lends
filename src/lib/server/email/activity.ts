import type { ActivityEvent } from "$lib/server/jobs/queue";
import { db } from "$lib/server/db";
import { loanInvestors, loans } from "$lib/server/db/schema";
import {
  getEmailPreferencesByEmails,
  type ResolvedEmailPreferences,
} from "$lib/server/email/preferences";
import {
  isEmailNotificationsEnabled,
  sendNotificationEmail,
} from "$lib/server/email/index";
import {
  renderEventEmail,
  type EmailEventContext,
  type EmailEventType,
  type EmailRecipient,
  type LoanEmailContext,
} from "$lib/server/email/notifications";
import {
  excludeActorRecipients,
  loadActorIdentity,
  loadGroupEmailRecipients,
  loadLoanEmailRecipients,
  mergeEmailRecipients,
  withRoleLabels,
  type EmailRecipientSeed,
} from "$lib/server/email/recipients";
import { resolveAppUrl } from "$lib/server/app-url";
import { eq, isNull } from "drizzle-orm";

const ACTIVITY_EVENT_TYPES = new Set<EmailEventType>([
  "loan_updated",
  "loan_deleted",
  "loan_completed",
  "loan_added",
  "loan_removed",
  "disbursement",
  "payment_received",
  "payment_removed",
  "interest_paid",
  "interest_extended",
  "contract_signed",
]);

export type ActivityEmailResult = {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function emptyResult(): ActivityEmailResult {
  return { sent: 0, skipped: 0, failed: 0, errors: [] };
}

function isEmailActivityType(type: string): type is EmailEventType {
  return ACTIVITY_EVENT_TYPES.has(type as EmailEventType);
}

function activityFingerprint(event: ActivityEvent): string {
  return `activity:${event.type}:${event.entityId}:${event.updatedAt ?? ""}`;
}

function toPreferences(result: {
  prefs: ResolvedEmailPreferences;
  recipient: EmailRecipientSeed;
}): EmailRecipient {
  return {
    email: result.recipient.email,
    userId: result.recipient.userId,
    name: result.recipient.name,
    roleLabels: withRoleLabels([result.recipient])[0]?.roleLabels ?? [],
    preferences: result.prefs,
  };
}

async function loadLoanEmailContext(
  loanId: number,
): Promise<LoanEmailContext | null> {
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    with: {
      borrower: true,
      loanInvestors: {
        where: isNull(loanInvestors.deletedAt),
        with: { investor: true },
      },
      loanWitnesses: { with: { witness: true } },
    },
  });
  if (!loan) return null;

  const principal = loan.loanInvestors.reduce((sum, row) => {
    const amount = Number.parseFloat(row.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return {
    id: loan.id,
    loanName: loan.loanName,
    type: loan.type,
    status: loan.status,
    dueDate: loan.dueDate,
    borrowerName: loan.borrower?.name ?? "No borrower",
    principal,
    investorNames: loan.loanInvestors
      .map((row) => row.investor?.name?.trim())
      .filter((name): name is string => Boolean(name)),
  };
}

function applyCategoryPreference(prefs: ResolvedEmailPreferences): boolean {
  return prefs.emailEnabled && prefs.notifyActivity;
}

async function sendToRecipients(input: {
  recipients: EmailRecipientSeed[];
  event: EmailEventContext;
  fingerprint: string;
  kind: string;
}): Promise<ActivityEmailResult> {
  const result = emptyResult();
  if (input.recipients.length === 0) return result;

  const prefsByEmail = await getEmailPreferencesByEmails(
    input.recipients.map((recipient) => recipient.email),
  );

  for (const recipient of input.recipients) {
    const prefs =
      prefsByEmail.get(recipient.email) ??
      prefsByEmail.get(recipient.email.trim().toLowerCase());
    if (!prefs || !applyCategoryPreference(prefs)) {
      result.skipped += 1;
      continue;
    }

    const built = renderEventEmail({
      event: input.event,
      recipient: toPreferences({ prefs, recipient }),
    });

    const outcome = await sendNotificationEmail({
      to: recipient.email,
      userId: recipient.userId,
      fingerprint: input.fingerprint,
      kind: input.kind,
      subject: built.subject,
      html: built.html,
    });

    if (outcome.status === "sent") result.sent += 1;
    else if (outcome.status === "skipped") result.skipped += 1;
    else {
      result.failed += 1;
      if (outcome.error) result.errors.push(outcome.error);
    }
  }

  return result;
}

/**
 * Immediate activity email for a loan event. The actor is never emailed.
 * Returns a result instead of throwing so the mutation response is never
 * affected. The job handler can inspect `failed` to decide on a retry.
 */
export async function sendLoanActivityEmails(input: {
  loanId: number;
  event: ActivityEvent;
  actorUserId?: string | null;
  actorEmail?: string | null;
}): Promise<ActivityEmailResult> {
  if (!isEmailActivityType(input.event.type)) return emptyResult();
  if (!isEmailNotificationsEnabled()) return emptyResult();

  const [loan, actor] = await Promise.all([
    loadLoanEmailContext(input.loanId),
    loadActorIdentity(input.actorUserId),
  ]);
  if (!loan) return emptyResult();

  const recipients = excludeActorRecipients(
    await loadLoanEmailRecipients(input.loanId),
    {
      actorUserId: actor.userId,
      actorEmail: input.actorEmail ?? actor.email,
    },
  );

  const eventContext: EmailEventContext = {
    type: input.event.type,
    loan,
    detail: input.event.detail
      ? {
          amount: input.event.detail.amount,
          date: input.event.detail.date,
          previousDate: input.event.detail.previousDate,
          partyName: input.event.detail.signerName,
          partyRole: input.event.detail.signerRole,
          investorName: input.event.detail.investorName,
          signedCount: input.event.detail.signedCount,
          signerTotal: input.event.detail.signerTotal,
        }
      : undefined,
    actorName: actor.name ?? undefined,
    appUrl: resolveAppUrl(),
  };

  return sendToRecipients({
    recipients,
    event: eventContext,
    fingerprint: activityFingerprint(input.event),
    kind: "activity",
  });
}

/**
 * Group membership email. Recipients are the group creator, current members,
 * and the loan parties. The actor is excluded.
 */
export async function sendGroupLoanActivityEmails(input: {
  groupId: number;
  loanId: number;
  groupName: string;
  event: ActivityEvent;
  actorUserId?: string | null;
  actorEmail?: string | null;
}): Promise<ActivityEmailResult> {
  if (!isEmailActivityType(input.event.type)) return emptyResult();
  if (!isEmailNotificationsEnabled()) return emptyResult();

  const [loan, groupRecipients, loanRecipients, actor] = await Promise.all([
    loadLoanEmailContext(input.loanId),
    loadGroupEmailRecipients(input.groupId),
    loadLoanEmailRecipients(input.loanId),
    loadActorIdentity(input.actorUserId),
  ]);
  if (!loan) return emptyResult();

  const recipients = excludeActorRecipients(
    mergeEmailRecipients(groupRecipients, loanRecipients),
    {
      actorUserId: actor.userId,
      actorEmail: input.actorEmail ?? actor.email,
    },
  );

  const eventContext: EmailEventContext = {
    type: input.event.type,
    loan,
    group: { id: input.groupId, name: input.groupName },
    actorName: actor.name ?? undefined,
    appUrl: resolveAppUrl(),
  };

  return sendToRecipients({
    recipients,
    event: eventContext,
    fingerprint: `group:${input.groupId}:${activityFingerprint(input.event)}`,
    kind: "group_activity",
  });
}
