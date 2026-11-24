import { format } from "date-fns";
import { APP_NAME } from "$lib/brand";
import { formatCalendarCurrency } from "$lib/calendar-events";
import { dateKeyToUtcMidnight, toDateKey } from "$lib/dates/business-date";
import type {
  ReminderDigestItem,
  ReminderDigestSections,
} from "$lib/email/reminder-types";
import { resolveAppUrl } from "$lib/server/app-url";
import type { ResolvedEmailPreferences } from "$lib/server/email/preferences";
import {
  buildEmailCtaHtml,
  renderBrandedEmailShell,
} from "./branded-email-shell";
import { escapeHtml } from "./email-html";

export type {
  ReminderDigestItem,
  ReminderDigestSections,
} from "$lib/email/reminder-types";

export type EmailEventType =
  | "loan_created"
  | "loan_updated"
  | "loan_deleted"
  | "loan_completed"
  | "loan_added"
  | "loan_removed"
  | "disbursement"
  | "payment_received"
  | "payment_removed"
  | "interest_paid"
  | "interest_extended"
  | "contract_signed";

export type EmailRecipient = {
  email: string;
  userId: string | null;
  name: string;
  roleLabels: string[];
  preferences: ResolvedEmailPreferences;
};

export type LoanEmailContext = {
  id: number;
  loanName: string;
  type: string;
  status: string;
  dueDate: Date | string | null;
  borrowerName: string;
  principal: number;
  investorNames: string[];
};

export type GroupEmailContext = {
  id: number;
  name: string;
};

export type EmailEventDetail = {
  amount?: number;
  date?: string;
  previousDate?: string;
  partyName?: string;
  partyRole?: string;
  investorName?: string;
  signedCount?: number;
  signerTotal?: number;
};

export type EmailEventContext = {
  type: EmailEventType;
  loan?: LoanEmailContext | null;
  group?: GroupEmailContext | null;
  detail?: EmailEventDetail;
  actorName?: string;
  appUrl?: string;
};

type SummaryCard = {
  eyebrow: string;
  value: string;
  caption?: string;
};

type EventAction = {
  label: string;
  url: string;
};

const EMAIL_LINK_STYLE =
  "color:#475569;word-break:break-all;text-decoration:underline;";

const EMAIL_SECONDARY_CTA_STYLE =
  "display:inline-block;padding:12px 22px;border:1px solid #cbd5e1;border-radius:14px;color:#334155 !important;text-decoration:none;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;";

export function formatEmailMoney(amount: number): string {
  return formatCalendarCurrency(amount);
}

/** Format a business date key without depending on the server timezone. */
export function formatEmailDateKey(dateKey: string): string {
  if (!dateKey) return "";
  const date = dateKeyToUtcMidnight(dateKey);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatEmailDate(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  return formatEmailDateKey(toDateKey(value));
}

function loanPath(appUrl: string, loanId: number): string {
  return `${appUrl.replace(/\/$/, "")}/loans/${loanId}`;
}

function signingPath(appUrl: string, loanId: number): string {
  return `${appUrl.replace(/\/$/, "")}/loans/${loanId}/sign`;
}

function contractPath(appUrl: string, loanId: number): string {
  return `${appUrl.replace(/\/$/, "")}/loans/${loanId}?signing=1`;
}

function groupPath(appUrl: string, groupId: number): string {
  return `${appUrl.replace(/\/$/, "")}/groups/${groupId}`;
}

function greeting(recipient: EmailRecipient): string {
  const name = recipient.name.trim();
  return name ? `Hi ${escapeHtml(name)},` : "Hi,";
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#333333;">${text}</p>`;
}

function muted(text: string): string {
  return `<p style="margin:18px 0 0 0;font-size:13px;line-height:1.55;color:#64748b;">${text}</p>`;
}

function sectionLabel(text: string): string {
  return `<p class="section-label">${escapeHtml(text)}</p>`;
}

function formatRoleLabels(recipient: EmailRecipient): string {
  const labels = [...new Set(recipient.roleLabels)].filter(Boolean);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function amountValue(
  amount: number | null | undefined,
  prefs: ResolvedEmailPreferences,
): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  return prefs.includeAmounts ? formatEmailMoney(amount) : "Hidden";
}

/**
 * Light summary surface, same pattern as the Kame Homes booking summary card.
 * One value stands out, with a short line underneath.
 */
function summaryCard(card: SummaryCard): string {
  const caption = card.caption?.trim();
  return `<table role="presentation" class="summary-surface" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;margin:0 0 22px 0;"><tr><td style="padding:18px 20px;">
<p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(card.eyebrow)}</p>
<p style="margin:0;font-size:22px;font-weight:700;line-height:1.3;color:#111827;">${escapeHtml(card.value)}</p>
${caption ? `<p style="margin:6px 0 0 0;font-size:14px;line-height:1.55;color:#475569;">${escapeHtml(caption)}</p>` : ""}
</td></tr></table>`;
}

/**
 * Bordered detail table with tinted labels, matching the Kame Homes notify
 * tables. Rows with empty values are dropped.
 */
function detailTable(rows: Array<[string, string]>): string {
  const visible = rows.filter(([, value]) => value.trim().length > 0);
  if (visible.length === 0) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;table-layout:fixed;border:1px solid #e2e8f0;border-radius:16px;border-collapse:separate;border-spacing:0;overflow:hidden;font-size:14px;margin:0 0 22px 0;">
${visible
  .map(
    ([label, value], index) => `<tr>
  <td style="padding:12px 16px;background-color:#f8fafc;${index < visible.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}font-weight:600;color:#475569;vertical-align:top;width:38%;">${escapeHtml(label)}</td>
  <td style="padding:12px 16px;background-color:#ffffff;${index < visible.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}color:#333333;line-height:1.55;vertical-align:top;">${escapeHtml(value)}</td>
</tr>`,
  )
  .join("\n")}
</table>`;
}

function secondaryCtaHtml(label: string, url: string): string {
  if (!url.trim()) return "";
  return `<div class="cta-wrap" style="margin:10px 0 0 0;text-align:center;"><a class="cta-btn" style="${EMAIL_SECONDARY_CTA_STYLE}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></div>`;
}

function linkFallback(url: string): string {
  return muted(
    `If the button does not work, copy this link:<br /><a href="${escapeHtml(url)}" style="${EMAIL_LINK_STYLE}">${escapeHtml(url)}</a>`,
  );
}

function inlineLink(label: string, url: string): string {
  if (!url.trim()) return "";
  return `<a href="${escapeHtml(url)}" style="color:#b45309;text-decoration:underline;font-weight:600;">${escapeHtml(label)}</a>`;
}

function actorName(event: EmailEventContext): string | null {
  const name = event.actorName?.trim();
  return name ? escapeHtml(name) : null;
}

function loanName(event: EmailEventContext): string {
  return event.loan?.loanName?.trim() || "this loan";
}

function groupName(event: EmailEventContext): string {
  return event.group?.name?.trim() || "the group";
}

function eventSubject(event: EmailEventContext): string {
  const loan = loanName(event);
  const group = groupName(event);
  switch (event.type) {
    case "loan_created":
      return `${APP_NAME}: Sign contract for ${loan}`;
    case "loan_updated":
      return `${APP_NAME}: ${loan} was updated`;
    case "loan_deleted":
      return `${APP_NAME}: ${loan} was deleted`;
    case "loan_completed":
      return `${APP_NAME}: ${loan} was completed`;
    case "loan_added":
      return `${APP_NAME}: ${loan} was added to ${group}`;
    case "loan_removed":
      return `${APP_NAME}: ${loan} was removed from ${group}`;
    case "disbursement":
      return `${APP_NAME}: Disbursement recorded for ${loan}`;
    case "payment_received":
      return `${APP_NAME}: Payment received for ${loan}`;
    case "payment_removed":
      return `${APP_NAME}: Payment removed from ${loan}`;
    case "interest_paid":
      return `${APP_NAME}: Interest payment received for ${loan}`;
    case "interest_extended":
      return `${APP_NAME}: New interest due date for ${loan}`;
    case "contract_signed": {
      const signer = event.detail?.partyName?.trim() || "A party";
      return `${APP_NAME}: ${signer} signed ${loan}`;
    }
    default:
      return `${APP_NAME}: Loan update`;
  }
}

function eventTitle(event: EmailEventContext): string {
  switch (event.type) {
    case "loan_created":
      return "Your signature is needed";
    case "loan_updated":
      return "Loan details updated";
    case "loan_deleted":
      return "Loan deleted";
    case "loan_completed":
      return "Loan completed";
    case "loan_added":
      return "Loan added to group";
    case "loan_removed":
      return "Loan removed from group";
    case "disbursement":
      return "Disbursement recorded";
    case "payment_received":
      return "Payment received";
    case "payment_removed":
      return "Payment removed";
    case "interest_paid":
      return "Interest payment received";
    case "interest_extended":
      return "Interest due date extended";
    case "contract_signed":
      return "Contract signed";
    default:
      return "Loan update";
  }
}

function eventIntro(event: EmailEventContext): string {
  const actor = actorName(event);
  const loan = escapeHtml(loanName(event));
  const group = escapeHtml(groupName(event));
  const investor = event.detail?.investorName?.trim()
    ? escapeHtml(event.detail.investorName.trim())
    : "the investor";
  const party = event.detail?.partyName?.trim()
    ? escapeHtml(event.detail.partyName.trim())
    : "A party";

  switch (event.type) {
    case "loan_created":
      return `A contract for <strong>${loan}</strong> is ready for you to review and sign.`;
    case "loan_updated":
      return actor
        ? `${actor} updated <strong>${loan}</strong>.`
        : `The details for <strong>${loan}</strong> were updated.`;
    case "loan_deleted":
      return actor
        ? `${actor} deleted <strong>${loan}</strong>.`
        : `<strong>${loan}</strong> was deleted.`;
    case "loan_completed":
      return actor
        ? `${actor} marked <strong>${loan}</strong> completed.`
        : `<strong>${loan}</strong> is now completed.`;
    case "loan_added":
      return actor
        ? `${actor} added <strong>${loan}</strong> to ${group}.`
        : `<strong>${loan}</strong> was added to ${group}.`;
    case "loan_removed":
      return actor
        ? `${actor} removed <strong>${loan}</strong> from ${group}.`
        : `<strong>${loan}</strong> was removed from ${group}.`;
    case "disbursement":
      return actor
        ? `${actor} recorded a disbursement to ${investor}.`
        : `A disbursement to ${investor} was recorded.`;
    case "payment_received":
      return actor
        ? `${actor} recorded a payment from ${investor}.`
        : `A payment from ${investor} was recorded.`;
    case "payment_removed":
      return actor
        ? `${actor} removed a payment from ${investor}.`
        : `A payment from ${investor} was removed.`;
    case "interest_paid":
      return actor
        ? `${actor} recorded an interest payment from ${investor}.`
        : `An interest payment from ${investor} was recorded.`;
    case "interest_extended": {
      const previous = formatEmailDateKey(event.detail?.previousDate ?? "");
      const next = formatEmailDateKey(event.detail?.date ?? "");
      if (previous && next) {
        return actor
          ? `${actor} moved the interest due date for <strong>${loan}</strong> from ${previous} to ${next}.`
          : `The interest due date for <strong>${loan}</strong> moved from ${previous} to ${next}.`;
      }
      return actor
        ? `${actor} extended the interest due date for <strong>${loan}</strong>.`
        : `The interest due date for <strong>${loan}</strong> was extended.`;
    }
    case "contract_signed":
      return `${party} signed the contract for <strong>${loan}</strong>.`;
    default:
      return `There is an update on <strong>${loan}</strong>.`;
  }
}

function eventSummaryCard(
  event: EmailEventContext,
  recipient: EmailRecipient,
): SummaryCard {
  const prefs = recipient.preferences;
  const loan = event.loan;
  const detail = event.detail;

  switch (event.type) {
    case "loan_created": {
      const due = formatEmailDate(loan?.dueDate);
      return {
        eyebrow: "Contract to sign",
        value: loan?.loanName?.trim() || "Loan contract",
        caption: due ? `Due ${due}` : "",
      };
    }
    case "loan_updated":
      return {
        eyebrow: "Current status",
        value: loan?.status || "Updated",
        caption: formatEmailDate(loan?.dueDate)
          ? `Due ${formatEmailDate(loan?.dueDate)}`
          : "",
      };
    case "loan_deleted":
      return {
        eyebrow: "Borrower",
        value: loan?.borrowerName?.trim() || "Loan",
        caption: "The loan is no longer active.",
      };
    case "loan_completed":
      return {
        eyebrow: "Current status",
        value: "Completed",
        caption: "Loan closed",
      };
    case "loan_added":
    case "loan_removed":
      return {
        eyebrow: "Group",
        value: event.group?.name?.trim() || "Group",
        caption: loan?.loanName?.trim() || "",
      };
    case "disbursement":
      return {
        eyebrow: "Amount released",
        value: amountValue(detail?.amount, prefs) || "Disbursement",
        caption: [
          formatEmailDateKey(detail?.date ?? ""),
          detail?.investorName?.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "payment_received":
      return {
        eyebrow: "Amount received",
        value: amountValue(detail?.amount, prefs) || "Payment",
        caption: [
          formatEmailDateKey(detail?.date ?? ""),
          detail?.investorName?.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "payment_removed":
      return {
        eyebrow: "Payment removed",
        value: amountValue(detail?.amount, prefs) || "Payment",
        caption: [
          formatEmailDateKey(detail?.date ?? ""),
          detail?.investorName?.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "interest_paid":
      return {
        eyebrow: "Interest received",
        value: amountValue(detail?.amount, prefs) || "Interest payment",
        caption: [
          formatEmailDateKey(detail?.date ?? ""),
          detail?.investorName?.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "interest_extended": {
      const previous = formatEmailDateKey(detail?.previousDate ?? "");
      return {
        eyebrow: "New due date",
        value: formatEmailDateKey(detail?.date ?? "") || "Extended",
        caption: previous
          ? `Previous due date ${previous}`
          : (loan?.loanName ?? ""),
      };
    }
    case "contract_signed": {
      const signed = detail?.signedCount;
      const total = detail?.signerTotal;
      return {
        eyebrow: "Signatures",
        value:
          signed != null && total != null ? `${signed} of ${total}` : "Signed",
        caption: [detail?.partyName?.trim(), detail?.partyRole?.trim()]
          .filter(Boolean)
          .join(" · "),
      };
    }
    default:
      return {
        eyebrow: "Loan",
        value: loan?.loanName?.trim() || "Loan",
      };
  }
}

function eventDetailRows(
  event: EmailEventContext,
  recipient: EmailRecipient,
): Array<[string, string]> {
  const prefs = recipient.preferences;
  const loan = event.loan;
  const roles = formatRoleLabels(recipient);
  const principal = amountValue(loan?.principal, prefs);
  const dueDate = formatEmailDate(loan?.dueDate);
  const loanNameValue = loan?.loanName?.trim() || "";
  const borrower = loan?.borrowerName?.trim() || "";

  switch (event.type) {
    case "loan_created":
      return [
        ["Your role", roles],
        ["Borrower", borrower],
        ["Loan amount", principal],
      ];
    case "loan_updated":
      return [
        ["Borrower", borrower],
        ["Principal", principal],
      ];
    case "loan_completed":
      return [
        ["Borrower", borrower],
        ["Due date", dueDate],
        ["Principal", principal],
      ];
    case "loan_deleted":
      return [
        ["Status", loan?.status ?? ""],
        ["Principal", principal],
      ];
    case "loan_added":
    case "loan_removed":
      return [
        ["Borrower", borrower],
        ["Due date", dueDate],
        ["Principal", principal],
      ];
    case "disbursement":
      return [
        ["Loan", loanNameValue],
        ["Borrower", borrower],
      ];
    case "payment_received":
      return [
        ["Loan", loanNameValue],
        ["Borrower", borrower],
      ];
    case "payment_removed":
      return [
        ["Loan", loanNameValue],
        ["Borrower", borrower],
      ];
    case "interest_paid":
      return [
        ["Loan", loanNameValue],
        ["Borrower", borrower],
      ];
    case "interest_extended":
      return [
        ["Borrower", borrower],
        ["Status", loan?.status ?? ""],
      ];
    case "contract_signed":
      return [];
    default:
      return [
        ["Loan", loanNameValue],
        ["Borrower", borrower],
      ];
  }
}

function eventNote(
  event: EmailEventContext,
  recipient: EmailRecipient,
): string {
  const signed = event.detail?.signedCount;
  const total = event.detail?.signerTotal;
  switch (event.type) {
    case "loan_created":
      return paragraph(
        `Sign in with Google using <strong>${escapeHtml(recipient.email)}</strong>. This keeps the signature tied to your account.`,
      );
    case "loan_deleted":
      return muted(
        "If you did not expect this, contact the loan owner before making any payment.",
      );
    case "interest_extended":
      return muted("Payments already recorded are not affected.");
    case "payment_removed":
      return muted("The loan balance may have changed.");
    case "contract_signed":
      if (signed != null && total != null && signed < total) {
        const remaining = total - signed;
        return paragraph(
          `<strong>${remaining}</strong> signature${remaining === 1 ? " is" : "s are"} still needed.`,
        );
      }
      if (signed != null && total != null && signed >= total) {
        return paragraph("All parties have signed. The contract is complete.");
      }
      return "";
    default:
      return "";
  }
}

function eventActions(
  event: EmailEventContext,
  appUrl: string,
): { primary: EventAction | null; secondary: EventAction | null } {
  const loan = event.loan;

  if (event.type === "loan_created" && loan) {
    return {
      primary: { label: "Review and sign", url: signingPath(appUrl, loan.id) },
      secondary: { label: "View loan details", url: loanPath(appUrl, loan.id) },
    };
  }
  if (event.type === "contract_signed" && loan) {
    return {
      primary: { label: "View contract", url: contractPath(appUrl, loan.id) },
      secondary: { label: "View loan", url: loanPath(appUrl, loan.id) },
    };
  }
  if (event.type === "loan_deleted") {
    return {
      primary: {
        label: "Open loans",
        url: `${appUrl.replace(/\/$/, "")}/loans`,
      },
      secondary: null,
    };
  }
  if ((event.type === "loan_added" || event.type === "loan_removed") && loan) {
    return {
      primary: { label: "View loan", url: loanPath(appUrl, loan.id) },
      secondary: event.group
        ? { label: "Open group", url: groupPath(appUrl, event.group.id) }
        : null,
    };
  }
  if (loan) {
    return {
      primary: { label: "View loan", url: loanPath(appUrl, loan.id) },
      secondary: null,
    };
  }
  return {
    primary: {
      label: "Open loans",
      url: `${appUrl.replace(/\/$/, "")}/loans`,
    },
    secondary: null,
  };
}

export function renderEventEmail(input: {
  event: EmailEventContext;
  recipient: EmailRecipient;
}): { subject: string; html: string } {
  const { event, recipient } = input;
  const appUrl = event.appUrl ?? resolveAppUrl();
  const summary = eventSummaryCard(event, recipient);
  const detailRows = eventDetailRows(event, recipient);
  const note = eventNote(event, recipient);
  const actions = eventActions(event, appUrl);

  const parts: string[] = [
    paragraph(greeting(recipient)),
    paragraph(eventIntro(event)),
    summaryCard(summary),
    detailTable(detailRows),
    note,
  ];

  if (actions.primary) {
    parts.push(buildEmailCtaHtml(actions.primary.label, actions.primary.url));
  }
  if (actions.secondary) {
    parts.push(
      secondaryCtaHtml(actions.secondary.label, actions.secondary.url),
    );
  }
  if (actions.primary) {
    parts.push(linkFallback(actions.primary.url));
  }

  return {
    subject: eventSubject(event),
    html: renderBrandedEmailShell({
      emailTitle: eventTitle(event),
      unitLabel: event.loan?.loanName?.trim() || APP_NAME,
      bodyHtml: parts.filter(Boolean).join("\n"),
    }),
  };
}

function digestSectionTitle(title: string): string {
  return sectionLabel(title);
}

function digestItemLine(
  item: ReminderDigestItem,
  prefs: ResolvedEmailPreferences,
  appUrl: string,
): string {
  const due = formatEmailDateKey(item.dueDateKey);
  const amount =
    item.kind !== "signature" && prefs.includeAmounts
      ? ` · ${formatEmailMoney(item.totalAmount)}`
      : "";
  const timing =
    item.kind === "upcoming" && item.daysUntil != null
      ? ` · in ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"}`
      : item.kind === "overdue" && item.daysOverdue != null
        ? ` · ${item.daysOverdue} day${item.daysOverdue === 1 ? "" : "s"} overdue`
        : "";
  const dateLine =
    item.kind === "signature"
      ? " · signature needed"
      : due
        ? ` · due ${due}`
        : "";
  const action =
    item.kind === "signature"
      ? inlineLink("Sign", item.signingUrl ?? signingPath(appUrl, item.loanId))
      : inlineLink("View", loanPath(appUrl, item.loanId));

  return `<li style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#1e293b;"><strong>${escapeHtml(item.loanName || "Loan")}</strong>${escapeHtml(dateLine)}${escapeHtml(timing)}${escapeHtml(amount)}<br />${action}</li>`;
}

function digestSection(
  title: string,
  items: ReminderDigestItem[],
  prefs: ResolvedEmailPreferences,
  appUrl: string,
): string {
  if (items.length === 0) return "";
  return `${digestSectionTitle(title)}
<ul style="margin:8px 0 18px 0;padding-left:20px;">
${items.map((item) => digestItemLine(item, prefs, appUrl)).join("\n")}
</ul>`;
}

function digestSummaryCaption(sections: ReminderDigestSections): string {
  const bits: string[] = [];
  if (sections.signatures.length > 0) {
    bits.push(`${sections.signatures.length} to sign`);
  }
  if (sections.upcoming.length > 0) {
    bits.push(`${sections.upcoming.length} due soon`);
  }
  if (sections.dueToday.length > 0) {
    bits.push(`${sections.dueToday.length} due today`);
  }
  if (sections.overdue.length > 0) {
    bits.push(`${sections.overdue.length} overdue`);
  }
  return bits.join(" · ");
}

export function renderReminderDigest(input: {
  recipient: EmailRecipient;
  sections: ReminderDigestSections;
  appUrl?: string;
}): { subject: string; html: string } {
  const { recipient, sections } = input;
  const appUrl = input.appUrl ?? resolveAppUrl();
  const prefs = recipient.preferences;
  const total =
    sections.signatures.length +
    sections.upcoming.length +
    sections.dueToday.length +
    sections.overdue.length;

  const signatureOnly =
    sections.signatures.length > 0 &&
    sections.upcoming.length === 0 &&
    sections.dueToday.length === 0 &&
    sections.overdue.length === 0;

  const subject = signatureOnly
    ? `${APP_NAME}: ${sections.signatures.length} contract${sections.signatures.length === 1 ? "" : "s"} to sign`
    : `${APP_NAME}: ${total} item${total === 1 ? "" : "s"} need your attention`;

  const firstSignature = sections.signatures[0];
  const primaryUrl = firstSignature
    ? (firstSignature.signingUrl ?? signingPath(appUrl, firstSignature.loanId))
    : `${appUrl.replace(/\/$/, "")}/loans`;

  const body = [
    paragraph(greeting(recipient)),
    paragraph("Here is what needs your attention today."),
    summaryCard({
      eyebrow: "Today",
      value: `${total} item${total === 1 ? "" : "s"}`,
      caption: digestSummaryCaption(sections),
    }),
    digestSection(
      "Contracts waiting for your signature",
      sections.signatures,
      prefs,
      appUrl,
    ),
    digestSection("Due soon", sections.upcoming, prefs, appUrl),
    digestSection("Due today", sections.dueToday, prefs, appUrl),
    digestSection("Overdue", sections.overdue, prefs, appUrl),
    buildEmailCtaHtml(
      firstSignature ? "Review and sign" : "Open loans",
      primaryUrl,
    ),
    sections.signatures.length > 0 && !signatureOnly
      ? secondaryCtaHtml("Open loans", `${appUrl.replace(/\/$/, "")}/loans`)
      : "",
    linkFallback(primaryUrl),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject,
    html: renderBrandedEmailShell({
      emailTitle: "Loan reminders",
      unitLabel: "Your loans",
      bodyHtml: body,
    }),
  };
}

export function renderEmailTest(input: { recipient: EmailRecipient }): {
  subject: string;
  html: string;
} {
  const { recipient } = input;
  const body = [
    paragraph(greeting(recipient)),
    paragraph(
      "This is a test email from your Kame Lends notification settings.",
    ),
    muted(
      `Sent ${escapeHtml(format(new Date(), "MMMM d, yyyy 'at' h:mm a"))}.`,
    ),
  ].join("\n");

  return {
    subject: `${APP_NAME}: Test email`,
    html: renderBrandedEmailShell({
      emailTitle: "Test email",
      unitLabel: APP_NAME,
      bodyHtml: body,
    }),
  };
}
