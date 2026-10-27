import { manilaTodayKey } from "$lib/calendar-sync-plan";
import { toLocalDateString } from "$lib/date-utils";
import type { PlannedGroupNotification } from "$lib/group-notification-plan";
import {
  applyTelegramTemplate,
  resolveGroupTelegramTemplate,
} from "$lib/groups/group-telegram-templates";
import {
  escapeTelegramHtml,
  formatTelegramDateKey,
  formatTelegramMoney,
  telegramLinkHtml,
} from "$lib/groups/telegram-message-context";

export const SIGNING_REMINDER_INTERVALS = [1, 2, 4, 6, 12, 24] as const;

export type SigningReminderInterval =
  (typeof SIGNING_REMINDER_INTERVALS)[number];

/** 08:00 Asia/Manila. Daily interval sends once, with the morning groups cron hour. */
export const SIGNING_REMINDER_DAILY_HOUR = 8;

const MAX_LOANS_IN_MESSAGE = 12;
const MAX_HTML_LENGTH = 3500;

export type UnsignedSigningSettings = {
  notifyUnsigned: boolean;
  intervalHours: number;
  requireBorrower: boolean;
  requireInvestor: boolean;
  requireWitness: boolean;
};

export type UnsignedInvitation = {
  partyRole: string;
  partyName: string;
  signedAt: Date | string | null;
};

export type UnsignedLoanInput = {
  id: number;
  loanName: string;
  status: string;
  loanType?: string;
  dueDate?: Date | string | null;
  principal?: number | null;
  invitations: UnsignedInvitation[];
};

type RequiredRole = "borrower" | "investor" | "witness";

const ROLE_ORDER: Record<RequiredRole, number> = {
  borrower: 0,
  investor: 1,
  witness: 2,
};

export function normalizeSigningReminderInterval(
  hours: number,
): SigningReminderInterval {
  if ((SIGNING_REMINDER_INTERVALS as readonly number[]).includes(hours)) {
    return hours as SigningReminderInterval;
  }
  return 1;
}

/** Hour 0–23 in Asia/Manila. */
export function manilaHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  const value = Number(hour);
  if (!Number.isFinite(value)) return 0;
  return value % 24;
}

/**
 * Slot id for this clock hour, or null when the interval should stay quiet.
 * Daily uses 08:00 Manila. Shorter intervals align to hour 0.
 */
export function signingReminderSlot(
  now: Date,
  intervalHours: number,
): string | null {
  const interval = normalizeSigningReminderInterval(intervalHours);
  const hour = manilaHour(now);
  const dateKey = manilaTodayKey(now);
  if (interval === 24) {
    return hour === SIGNING_REMINDER_DAILY_HOUR ? `${dateKey}:daily` : null;
  }
  if (hour % interval !== 0) return null;
  return `${dateKey}:${Math.floor(hour / interval)}`;
}

function loanUrl(appUrl: string, loanId: number): string {
  return `${appUrl.replace(/\/$/, "")}/loans/${loanId}`;
}

function groupUrl(appUrl: string, groupId: number): string {
  return `${appUrl.replace(/\/$/, "")}/groups/${groupId}`;
}

function requiredRole(partyRole: string): RequiredRole | null {
  if (partyRole === "borrower") return "borrower";
  if (partyRole === "lender") return "investor";
  if (partyRole === "witness_1" || partyRole === "witness_2") return "witness";
  return null;
}

function roleLabel(role: RequiredRole): string {
  if (role === "borrower") return "Borrower";
  if (role === "investor") return "Investor";
  return "Witness";
}

function roleEnabled(
  role: RequiredRole,
  settings: UnsignedSigningSettings,
): boolean {
  if (role === "borrower") return settings.requireBorrower;
  if (role === "investor") return settings.requireInvestor;
  return settings.requireWitness;
}

function isSigned(signedAt: Date | string | null): boolean {
  if (signedAt == null) return false;
  if (typeof signedAt === "string") return signedAt.trim().length > 0;
  return !Number.isNaN(signedAt.getTime());
}

type WaitingParty = { name: string; role: RequiredRole };

function waitingParties(
  loan: UnsignedLoanInput,
  settings: UnsignedSigningSettings,
): WaitingParty[] {
  const parties: WaitingParty[] = [];
  for (const invitation of loan.invitations) {
    if (isSigned(invitation.signedAt)) continue;
    const role = requiredRole(invitation.partyRole);
    if (!role || !roleEnabled(role, settings)) continue;
    const name = invitation.partyName.trim() || roleLabel(role);
    parties.push({ name, role });
  }
  parties.sort((a, b) => {
    const roleDiff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (roleDiff !== 0) return roleDiff;
    return a.name.localeCompare(b.name);
  });
  return parties;
}

function formatLoanBlock(
  loan: UnsignedLoanInput,
  parties: WaitingParty[],
  appUrl: string,
  includeAmounts: boolean,
): string {
  const lines = parties.map(
    (party) => `• ${escapeTelegramHtml(party.name)}, ${roleLabel(party.role)}`,
  );
  const meta: string[] = [];
  if (loan.loanType?.trim())
    meta.push(escapeTelegramHtml(loan.loanType.trim()));
  if (loan.dueDate) {
    meta.push(`Due ${formatTelegramDateKey(toLocalDateString(loan.dueDate))}`);
  }
  if (loan.principal != null && Number.isFinite(loan.principal)) {
    meta.push(formatTelegramMoney(loan.principal, includeAmounts));
  }
  return [
    `<b>${escapeTelegramHtml(loan.loanName.trim() || "Loan")}</b>`,
    meta.join(" · "),
    "Waiting:",
    ...lines,
    telegramLinkHtml(loanUrl(appUrl, loan.id), "Open loan"),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * One group message listing open loans whose required contract parties
 * have not signed. Null when this hour is outside the interval, the
 * reminder is off, or nobody is waiting.
 */
export function planUnsignedSigningReminder(
  loans: UnsignedLoanInput[],
  settings: UnsignedSigningSettings,
  now: Date,
  options: {
    appUrl: string;
    groupId: number;
    groupName?: string;
    includeAmounts?: boolean;
    templates?: Record<string, string> | null;
  },
): PlannedGroupNotification | null {
  if (!settings.notifyUnsigned) return null;
  if (
    !settings.requireBorrower &&
    !settings.requireInvestor &&
    !settings.requireWitness
  ) {
    return null;
  }

  const slot = signingReminderSlot(now, settings.intervalHours);
  if (!slot) return null;

  const blocks: string[] = [];
  let omitted = 0;
  for (const loan of [...loans].sort((a, b) =>
    a.loanName.localeCompare(b.loanName),
  )) {
    if (loan.status === "Completed") continue;
    const parties = waitingParties(loan, settings);
    if (parties.length === 0) continue;
    if (blocks.length >= MAX_LOANS_IN_MESSAGE) {
      omitted += 1;
      continue;
    }
    const next = formatLoanBlock(
      loan,
      parties,
      options.appUrl,
      options.includeAmounts !== false,
    );
    const draft = [...blocks, next].join("\n\n");
    if (draft.length > MAX_HTML_LENGTH) {
      omitted += 1;
      continue;
    }
    blocks.push(next);
  }

  if (blocks.length === 0) return null;

  let pendingBody = blocks.join("\n\n");
  if (omitted > 0) {
    pendingBody += `\n\nAnd ${omitted} more.`;
  }

  const template = resolveGroupTelegramTemplate("unsigned", options.templates);
  const html = applyTelegramTemplate(template, {
    pending_body: pendingBody,
    pending_count: String(blocks.length + omitted),
    group_name: escapeTelegramHtml(options.groupName ?? ""),
    group_link: telegramLinkHtml(
      groupUrl(options.appUrl, options.groupId),
      "Open group",
    ),
  });

  return {
    fingerprint: `unsigned:${slot}`,
    kind: "unsigned",
    html,
  };
}
