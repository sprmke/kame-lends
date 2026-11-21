import { manilaTodayKey } from "$lib/calendar-sync-plan";
import { toDateKey } from "$lib/dates/business-date";
import {
  buildDigestPlan,
  daysSinceInvitation,
  planDueReminders,
  type PlannedDueReminder,
  type PlannedSigningReminder,
} from "$lib/email/reminder-plan";
import { resolveAppUrl } from "$lib/server/app-url";
import { db } from "$lib/server/db";
import {
  loanInvestors,
  loanSigningInvitations,
  loans,
  receivedPayments,
  users,
} from "$lib/server/db/schema";
import {
  isEmailNotificationsEnabled,
  sendNotificationEmail,
} from "$lib/server/email/index";
import {
  renderReminderDigest,
  type EmailRecipient,
} from "$lib/server/email/notifications";
import {
  defaultEmailPreferences,
  getEmailPreferencesByEmails,
} from "$lib/server/email/preferences";
import {
  filterRecipientsByRole,
  loadLoanEmailRecipientsForLoans,
} from "$lib/server/email/recipients";
import type { LoanWithInvestors } from "$lib/types";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

export type EmailReminderRunResult = {
  users: number;
  planned: number;
  sent: number;
  skipped: number;
  failed: number;
};

type RecipientBucket = {
  email: string;
  userId: string | null;
  name: string;
  roleLabels: string[];
  dueItems: PlannedDueReminder[];
  signingItems: PlannedSigningReminder[];
};

function bucketKey(email: string): string {
  return email.trim().toLowerCase();
}

function bucketFor(
  buckets: Map<string, RecipientBucket>,
  input: {
    email: string;
    userId?: string | null;
    name?: string;
    roleLabels?: string[];
  },
): RecipientBucket {
  const key = bucketKey(input.email);
  const existing = buckets.get(key);
  if (existing) {
    if (!existing.userId && input.userId) existing.userId = input.userId;
    if (!existing.name && input.name?.trim()) existing.name = input.name.trim();
    for (const label of input.roleLabels ?? []) {
      if (!existing.roleLabels.includes(label)) existing.roleLabels.push(label);
    }
    return existing;
  }

  const created: RecipientBucket = {
    email: key,
    userId: input.userId ?? null,
    name: input.name?.trim() ?? "",
    roleLabels: [...new Set(input.roleLabels ?? [])],
    dueItems: [],
    signingItems: [],
  };
  buckets.set(key, created);
  return created;
}

async function loadOpenLoans(): Promise<LoanWithInvestors[]> {
  const rows = await db.query.loans.findMany({
    where: isNull(loans.deletedAt),
    with: {
      borrower: true,
      loanInvestors: {
        where: isNull(loanInvestors.deletedAt),
        with: {
          investor: true,
          interestPeriods: true,
          receivedPayments: { where: isNull(receivedPayments.deletedAt) },
        },
      },
      loanWitnesses: { with: { witness: true } },
    },
  });
  return rows as unknown as LoanWithInvestors[];
}

type UnsignedInvitationRow = {
  invitationId: number;
  loanId: number;
  loanName: string;
  dueDate: Date;
  partyRole: string;
  investorId: number | null;
  witnessId: number | null;
  partyEmail: string | null;
  partyName: string;
  createdAt: Date;
};

async function loadUnsignedInvitations(): Promise<UnsignedInvitationRow[]> {
  return db
    .select({
      invitationId: loanSigningInvitations.id,
      loanId: loanSigningInvitations.loanId,
      loanName: loans.loanName,
      dueDate: loans.dueDate,
      partyRole: loanSigningInvitations.partyRole,
      investorId: loanSigningInvitations.investorId,
      witnessId: loanSigningInvitations.witnessId,
      partyEmail: loanSigningInvitations.partyEmail,
      partyName: loanSigningInvitations.partyName,
      createdAt: loanSigningInvitations.createdAt,
    })
    .from(loanSigningInvitations)
    .innerJoin(loans, eq(loanSigningInvitations.loanId, loans.id))
    .where(
      and(
        isNull(loanSigningInvitations.signedAt),
        isNull(loans.deletedAt),
        ne(loans.status, "Completed"),
        sql`${loanSigningInvitations.partyEmail} IS NOT NULL`,
        sql`btrim(${loanSigningInvitations.partyEmail}) <> ''`,
        sql`(${loanSigningInvitations.expiresAt} IS NULL OR ${loanSigningInvitations.expiresAt} > NOW())`,
      ),
    );
}

/**
 * Daily email reminder digest.
 *
 * One email per recipient, sent only when the digest fingerprint changes. A D-3
 * reminder sends once, a due-today item sends once, and an overdue item repeats
 * on the recipient's configured cadence.
 */
export async function runEmailReminderDigests(options?: {
  todayKey?: string;
  dryRun?: boolean;
}): Promise<EmailReminderRunResult> {
  const result: EmailReminderRunResult = {
    users: 0,
    planned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (!options?.dryRun && !isEmailNotificationsEnabled()) {
    return result;
  }

  const todayKey = options?.todayKey ?? manilaTodayKey();
  const appUrl = resolveAppUrl();

  const [openLoans, invitations] = await Promise.all([
    loadOpenLoans(),
    loadUnsignedInvitations(),
  ]);

  const dueItems = planDueReminders(openLoans, todayKey);
  const dueByLoan = new Map<number, PlannedDueReminder[]>();
  for (const item of dueItems) {
    const list = dueByLoan.get(item.loanId) ?? [];
    list.push(item);
    dueByLoan.set(item.loanId, list);
  }

  const activePartiesByLoan = new Map<
    number,
    { investorIds: Set<number>; witnessIds: Set<number> }
  >();
  for (const loan of openLoans) {
    activePartiesByLoan.set(loan.id, {
      investorIds: new Set(loan.loanInvestors.map((row) => row.investorId)),
      witnessIds: new Set(
        (loan.loanWitnesses ?? []).map((row) => row.witnessId),
      ),
    });
  }

  const buckets = new Map<string, RecipientBucket>();

  const recipientsByLoan = await loadLoanEmailRecipientsForLoans([
    ...dueByLoan.keys(),
  ]);

  for (const [loanId, items] of dueByLoan) {
    const recipients = filterRecipientsByRole(
      recipientsByLoan.get(loanId) ?? [],
      ["owner", "borrower", "investor"],
    );
    for (const recipient of recipients) {
      const bucket = bucketFor(buckets, {
        email: recipient.email,
        userId: recipient.userId,
        name: recipient.name,
        roleLabels: recipient.roleLabels,
      });
      bucket.dueItems.push(...items);
    }
  }

  for (const invitation of invitations) {
    const email = invitation.partyEmail?.trim().toLowerCase();
    if (!email) continue;

    const active = activePartiesByLoan.get(invitation.loanId);
    if (
      invitation.partyRole === "lender" &&
      invitation.investorId != null &&
      !active?.investorIds.has(invitation.investorId)
    ) {
      continue;
    }
    if (
      (invitation.partyRole === "witness_1" ||
        invitation.partyRole === "witness_2") &&
      invitation.witnessId != null &&
      !active?.witnessIds.has(invitation.witnessId)
    ) {
      continue;
    }

    const item: PlannedSigningReminder = {
      invitationId: invitation.invitationId,
      loanId: invitation.loanId,
      loanName: invitation.loanName,
      dueDateKey: toDateKey(invitation.dueDate),
      partyEmail: email,
      partyName: invitation.partyName,
      createdAt: invitation.createdAt,
      daysSinceCreated: daysSinceInvitation(invitation.createdAt, todayKey),
    };
    const bucket = bucketFor(buckets, {
      email,
      name: invitation.partyName,
    });
    bucket.signingItems.push(item);
  }

  const emails = [...buckets.keys()];
  const [prefsByEmail, userRows] = await Promise.all([
    getEmailPreferencesByEmails(emails),
    emails.length > 0
      ? db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(inArray(sql`lower(${users.email})`, emails))
      : Promise.resolve([]),
  ]);
  const userByEmail = new Map(
    userRows.map((row) => [bucketKey(row.email), row]),
  );

  for (const bucket of buckets.values()) {
    const user = userByEmail.get(bucket.email);
    const userId = bucket.userId ?? user?.id ?? null;
    const prefs =
      prefsByEmail.get(bucket.email) ?? defaultEmailPreferences(userId);

    const plan = buildDigestPlan({
      dueItems: bucket.dueItems,
      signingItems: bucket.signingItems,
      prefs,
      appUrl,
      todayKey,
    });
    if (!plan) continue;

    result.users += 1;
    result.planned += plan.items.length;

    if (options?.dryRun) continue;

    const recipient: EmailRecipient = {
      email: bucket.email,
      userId,
      name: bucket.name || user?.name || "",
      roleLabels: bucket.roleLabels,
      preferences: prefs,
    };
    const built = renderReminderDigest({
      recipient,
      sections: plan.sections,
      appUrl,
    });

    const outcome = await sendNotificationEmail({
      to: bucket.email,
      userId,
      fingerprint: plan.fingerprint,
      kind: "reminder_digest",
      subject: built.subject,
      html: built.html,
    });

    if (outcome.status === "sent") result.sent += 1;
    else if (outcome.status === "skipped") result.skipped += 1;
    else {
      result.failed += 1;
      console.error("[email] reminder digest failed", {
        to: bucket.email,
        error: outcome.error,
      });
    }
  }

  console.info("[email] reminder digests", { todayKey, ...result });
  return result;
}
