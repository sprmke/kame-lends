import { type SigningPartyRole, normalizeEmail } from "$lib/loan-signing";
import { resolveAppUrl } from "$lib/server/app-url";
import {
  isEmailNotificationsEnabled,
  sendNotificationEmail,
} from "$lib/server/email/index";
import { getEmailPreferencesByEmails } from "$lib/server/email/preferences";
import { renderEventEmail } from "$lib/server/email/notifications";

export type LoanCreatedEmailRecipient = {
  partyRole: SigningPartyRole;
  partyName: string;
  partyEmail: string | null;
  invitationId?: number | null;
};

export function signingPartyRoleLabel(role: SigningPartyRole): string {
  switch (role) {
    case "borrower":
      return "Borrower";
    case "lender":
      return "Investor";
    case "witness_1":
    case "witness_2":
      return "Witness";
    default:
      return "Party";
  }
}

type GroupedRecipient = {
  email: string;
  partyName: string;
  partyRoles: SigningPartyRole[];
  invitationIds: number[];
};

export function groupLoanCreatedEmailRecipients(
  recipients: LoanCreatedEmailRecipient[],
): { groups: GroupedRecipient[]; skippedWithoutEmail: number } {
  const byEmail = new Map<string, GroupedRecipient>();
  let skippedWithoutEmail = 0;

  for (const recipient of recipients) {
    const email = normalizeEmail(recipient.partyEmail);
    if (!email) {
      skippedWithoutEmail += 1;
      continue;
    }

    const existing = byEmail.get(email);
    if (existing) {
      existing.partyRoles.push(recipient.partyRole);
      if (recipient.invitationId != null) {
        existing.invitationIds.push(recipient.invitationId);
      }
      if (!existing.partyName.trim() && recipient.partyName.trim()) {
        existing.partyName = recipient.partyName;
      }
      continue;
    }

    byEmail.set(email, {
      email,
      partyName: recipient.partyName,
      partyRoles: [recipient.partyRole],
      invitationIds:
        recipient.invitationId != null ? [recipient.invitationId] : [],
    });
  }

  return { groups: [...byEmail.values()], skippedWithoutEmail };
}

export async function sendLoanCreatedSigningEmails(input: {
  loanId: number;
  loanName: string;
  dueDate?: Date | string | null;
  loanType?: string;
  loanStatus?: string;
  borrowerName?: string;
  principal?: number;
  investorNames?: string[];
  recipients: LoanCreatedEmailRecipient[];
}): Promise<{ sent: number; skipped: number; failed: number }> {
  const { groups, skippedWithoutEmail } = groupLoanCreatedEmailRecipients(
    input.recipients,
  );

  try {
    const { sendSigningPushForEmails } =
      await import("$lib/server/push/signing");
    await sendSigningPushForEmails({
      loanId: input.loanId,
      loanName: input.loanName,
      emails: groups.map((group) => group.email),
    });
  } catch (error) {
    console.error("[push] loan-created fanout failed", {
      loanId: input.loanId,
      error,
    });
  }

  if (!isEmailNotificationsEnabled()) {
    return {
      sent: 0,
      skipped: skippedWithoutEmail + groups.length,
      failed: 0,
    };
  }

  const preferences = await getEmailPreferencesByEmails(
    groups.map((group) => group.email),
  );

  const origin = resolveAppUrl();
  const loanContext = {
    id: input.loanId,
    loanName: input.loanName,
    type: input.loanType ?? "",
    status: input.loanStatus ?? "",
    dueDate: input.dueDate ?? null,
    borrowerName: input.borrowerName ?? "",
    principal: input.principal ?? 0,
    investorNames: input.investorNames ?? [],
  };

  let sent = 0;
  let skipped = skippedWithoutEmail;
  let failed = 0;

  for (const group of groups) {
    const prefs = preferences.get(group.email);
    if (!prefs || !prefs.emailEnabled || !prefs.notifySigningRequests) {
      skipped += 1;
      continue;
    }

    const built = renderEventEmail({
      event: {
        type: "loan_created",
        loan: loanContext,
        appUrl: origin,
      },
      recipient: {
        email: group.email,
        userId: prefs.userId,
        name: group.partyName,
        roleLabels: group.partyRoles.map(signingPartyRoleLabel),
        preferences: prefs,
      },
    });

    const invitationKey =
      group.invitationIds.length > 0
        ? [...group.invitationIds].sort((a, b) => a - b).join("-")
        : group.email;
    const outcome = await sendNotificationEmail({
      to: group.email,
      userId: prefs.userId,
      fingerprint: `signing_request:${input.loanId}:${invitationKey}:${group.email}`,
      kind: "signing_request",
      subject: built.subject,
      html: built.html,
    });

    if (outcome.status === "sent") {
      sent += 1;
    } else if (outcome.status === "skipped") {
      skipped += 1;
    } else {
      failed += 1;
      console.error("[email] loan-created send failed", {
        loanId: input.loanId,
        to: group.email,
        roles: group.partyRoles,
        error: outcome.error,
      });
    }
  }

  return { sent, skipped, failed };
}
