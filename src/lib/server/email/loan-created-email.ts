import { format } from "date-fns";
import { APP_NAME } from "$lib/brand";
import {
  buildAuthenticatedSigningUrl,
  type SigningPartyRole,
  normalizeEmail,
} from "$lib/loan-signing";
import { resolveAppUrl } from "$lib/server/app-url";
import {
  buildEmailCtaHtml,
  renderBrandedEmailShell,
} from "./branded-email-shell";
import { escapeHtml } from "./email-html";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./send-email";

export type LoanCreatedEmailRecipient = {
  partyRole: SigningPartyRole;
  partyName: string;
  partyEmail: string | null;
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

export function formatSigningRoleLabels(roles: SigningPartyRole[]): string {
  const labels = [...new Set(roles.map((role) => signingPartyRoleLabel(role)))];
  if (labels.length <= 1) return labels[0] ?? "Party";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function formatLoanDueDate(dueDate: Date | string | null | undefined): string {
  if (!dueDate) return "";
  const date = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "MMMM d, yyyy");
}

export function buildLoanCreatedEmailBodyHtml(input: {
  partyName: string;
  partyRoles: SigningPartyRole[];
  partyEmail: string;
  loanName: string;
  dueDateLabel: string;
  signingUrl: string;
}): string {
  const roleLabel = formatSigningRoleLabels(input.partyRoles);
  const greetingName = input.partyName.trim() || roleLabel;
  const cta = buildEmailCtaHtml("Sign contract", input.signingUrl);

  const metaRows = [
    ["Loan", input.loanName],
    ["Your role", roleLabel],
    ...(input.dueDateLabel ? [["Due date", input.dueDateLabel] as const] : []),
  ];

  const metaTable = `<table role="presentation" class="data-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 4px 0;">
${metaRows
  .map(
    ([label, value]) => `  <tr class="meta-row">
    <td>${escapeHtml(label)}</td>
    <td>${escapeHtml(value)}</td>
  </tr>`,
  )
  .join("\n")}
</table>`;

  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Hi ${escapeHtml(greetingName)},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">A loan contract is ready for your signature.</p>
<p class="section-label">Contract details</p>
${metaTable}
<p style="margin:20px 0 0 0;font-size:15px;line-height:1.6;color:#333333;">Sign in with Google using <strong>${escapeHtml(input.partyEmail)}</strong>, then open the contract.</p>
${cta}
<p style="margin:16px 0 0 0;font-size:13px;line-height:1.55;color:#64748b;">If the button does not work, copy this link:<br /><a href="${escapeHtml(input.signingUrl)}" style="color:#475569;word-break:break-all;">${escapeHtml(input.signingUrl)}</a></p>`;
}

export function buildLoanCreatedEmailSubject(loanName: string): string {
  const name = loanName.trim() || "loan";
  return `${APP_NAME}: Sign contract for ${name}`;
}

type GroupedRecipient = {
  email: string;
  partyName: string;
  partyRoles: SigningPartyRole[];
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
      if (!existing.partyName.trim() && recipient.partyName.trim()) {
        existing.partyName = recipient.partyName;
      }
      continue;
    }

    byEmail.set(email, {
      email,
      partyName: recipient.partyName,
      partyRoles: [recipient.partyRole],
    });
  }

  return { groups: [...byEmail.values()], skippedWithoutEmail };
}

export async function sendLoanCreatedSigningEmails(input: {
  loanId: number;
  loanName: string;
  dueDate?: Date | string | null;
  recipients: LoanCreatedEmailRecipient[];
}): Promise<{ sent: number; skipped: number }> {
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

  if (!isTransactionalEmailConfigured()) {
    return {
      sent: 0,
      skipped: skippedWithoutEmail + groups.length,
    };
  }

  const origin = resolveAppUrl();
  const signingUrl = buildAuthenticatedSigningUrl(input.loanId, origin);
  const dueDateLabel = formatLoanDueDate(input.dueDate);
  const subject = buildLoanCreatedEmailSubject(input.loanName);

  let sent = 0;
  let skipped = skippedWithoutEmail;

  for (const group of groups) {
    const bodyHtml = buildLoanCreatedEmailBodyHtml({
      partyName: group.partyName,
      partyRoles: group.partyRoles,
      partyEmail: group.email,
      loanName: input.loanName,
      dueDateLabel,
      signingUrl,
    });

    const html = renderBrandedEmailShell({
      emailTitle: "Contract ready to sign",
      unitLabel: input.loanName.trim() || APP_NAME,
      bodyHtml,
    });

    try {
      await sendTransactionalEmail({
        to: group.email,
        subject,
        html,
      });
      sent += 1;
    } catch (error) {
      skipped += 1;
      console.error("[email] loan-created send failed", {
        loanId: input.loanId,
        to: group.email,
        roles: group.partyRoles,
        error,
      });
    }
  }

  return { sent, skipped };
}
