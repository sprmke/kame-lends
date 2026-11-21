import { draftLoanGoogleEvents } from "$lib/calendar-events";
import { isOpenLoan } from "$lib/calculations";
import { daysBetweenKeys, toDateKey } from "$lib/dates/business-date";
import type {
  ReminderDigestItem,
  ReminderDigestSections,
} from "$lib/email/reminder-types";
import type { LoanWithInvestors } from "$lib/types";

/** The planner only needs the reminder-related preference fields. */
export type ReminderPreferenceFlags = {
  emailEnabled: boolean;
  notifyDueReminders: boolean;
  reminderDays: number[];
  notifyDueToday: boolean;
  notifyOverdue: boolean;
  overdueRepeatEveryDays: number;
  notifySigningReminders: boolean;
  signingReminderFirstAfterDays: number;
  signingReminderRepeatEveryDays: number;
};

export type PlannedDueReminder = {
  loanId: number;
  loanName: string;
  dateKey: string;
  totalAmount: number;
  eventType: "due" | "interest_due";
  /** Positive when the date is in the future. Negative when past. */
  daysUntil: number;
};

export type PlannedSigningReminder = {
  invitationId: number;
  loanId: number;
  loanName: string;
  dueDateKey: string;
  partyEmail: string;
  partyName: string;
  createdAt: Date | string;
  daysSinceCreated: number;
};

export type DigestPlan = {
  fingerprint: string;
  sections: ReminderDigestSections;
  items: ReminderDigestItem[];
};

function eventDateLabel(item: PlannedDueReminder): string {
  return item.dateKey;
}

/** All due and interest rows for open loans in the reminder window. */
export function planDueReminders(
  loans: LoanWithInvestors[],
  todayKey: string,
): PlannedDueReminder[] {
  const planned: PlannedDueReminder[] = [];

  for (const loan of loans) {
    if (!isOpenLoan(loan)) continue;
    for (const draft of draftLoanGoogleEvents(loan, "open", todayKey)) {
      if (draft.type === "sent") continue;
      const daysUntil = daysBetweenKeys(todayKey, draft.dateKey);
      // Upcoming reminders only make sense for future dates. Past dates are
      // overdue and handled separately.
      planned.push({
        loanId: loan.id,
        loanName: loan.loanName,
        dateKey: draft.dateKey,
        totalAmount: draft.totalAmount,
        eventType: draft.type,
        daysUntil,
      });
    }
  }

  return planned;
}

export function isDueReminderEnabled(
  item: PlannedDueReminder,
  prefs: ReminderPreferenceFlags,
): boolean {
  if (item.daysUntil > 0) {
    return (
      prefs.emailEnabled &&
      prefs.notifyDueReminders &&
      prefs.reminderDays.includes(item.daysUntil)
    );
  }
  if (item.daysUntil === 0) {
    return prefs.emailEnabled && prefs.notifyDueToday;
  }
  return prefs.emailEnabled && prefs.notifyOverdue;
}

export function dueReminderFingerprint(
  item: PlannedDueReminder,
  prefs: ReminderPreferenceFlags,
): string {
  if (item.daysUntil > 0) {
    return `due:upcoming:${item.loanId}:${item.dateKey}:d${item.daysUntil}`;
  }
  if (item.daysUntil === 0) {
    return `due:today:${item.loanId}:${item.dateKey}`;
  }
  const repeat = Math.max(1, prefs.overdueRepeatEveryDays);
  const daysPast = Math.abs(item.daysUntil);
  const generation = Math.floor((daysPast - 1) / repeat) + 1;
  return `due:overdue:${item.loanId}:${item.dateKey}:g${generation}`;
}

export function signingReminderFingerprint(
  item: PlannedSigningReminder,
  prefs: ReminderPreferenceFlags,
): string | null {
  if (!prefs.emailEnabled || !prefs.notifySigningReminders) return null;
  if (item.daysSinceCreated < prefs.signingReminderFirstAfterDays) return null;

  const repeat = Math.max(1, prefs.signingReminderRepeatEveryDays);
  const generation =
    1 +
    Math.floor(
      (item.daysSinceCreated - prefs.signingReminderFirstAfterDays) / repeat,
    );
  return `signing:${item.invitationId}:g${generation}`;
}

function dueDigestItem(item: PlannedDueReminder): ReminderDigestItem {
  const base: ReminderDigestItem = {
    loanId: item.loanId,
    loanName: item.loanName,
    dueDateKey: eventDateLabel(item),
    totalAmount: item.totalAmount,
    kind:
      item.daysUntil > 0
        ? "upcoming"
        : item.daysUntil === 0
          ? "due_today"
          : "overdue",
  };

  if (item.daysUntil > 0) return { ...base, daysUntil: item.daysUntil };
  if (item.daysUntil < 0) {
    return { ...base, daysOverdue: Math.abs(item.daysUntil) };
  }
  return base;
}

function signingDigestItem(
  item: PlannedSigningReminder,
  appUrl: string,
): ReminderDigestItem {
  return {
    loanId: item.loanId,
    loanName: item.loanName,
    dueDateKey: item.dueDateKey,
    totalAmount: 0,
    kind: "signature",
    signingUrl: `${appUrl.replace(/\/$/, "")}/loans/${item.loanId}/sign`,
  };
}

function sortInside(section: ReminderDigestItem[]): ReminderDigestItem[] {
  return [...section].sort((a, b) => {
    if (a.dueDateKey !== b.dueDateKey) {
      return a.dueDateKey.localeCompare(b.dueDateKey);
    }
    return a.loanName.localeCompare(b.loanName);
  });
}

/**
 * Build one digest for one recipient. Returns null when nothing is enabled or
 * every item was already covered by a previous fingerprint.
 */
export function buildDigestPlan(input: {
  dueItems: PlannedDueReminder[];
  signingItems: PlannedSigningReminder[];
  prefs: ReminderPreferenceFlags;
  appUrl: string;
  todayKey: string;
}): DigestPlan | null {
  const { prefs, appUrl } = input;
  if (!prefs.emailEnabled) return null;

  const items: ReminderDigestItem[] = [];
  const fingerprints: string[] = [];
  const seen = new Set<string>();

  for (const due of input.dueItems) {
    if (!isDueReminderEnabled(due, prefs)) continue;
    const fingerprint = dueReminderFingerprint(due, prefs);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    fingerprints.push(fingerprint);
    items.push(dueDigestItem(due));
  }

  for (const signing of input.signingItems) {
    const fingerprint = signingReminderFingerprint(signing, prefs);
    if (!fingerprint || seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    fingerprints.push(fingerprint);
    items.push(signingDigestItem(signing, appUrl));
  }

  if (items.length === 0) return null;

  const sections: ReminderDigestSections = {
    signatures: sortInside(items.filter((item) => item.kind === "signature")),
    upcoming: sortInside(
      items
        .filter((item) => item.kind === "upcoming")
        .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0)),
    ),
    dueToday: sortInside(items.filter((item) => item.kind === "due_today")),
    overdue: sortInside(
      items
        .filter((item) => item.kind === "overdue")
        .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)),
    ),
  };

  return {
    fingerprint: `digest:${fingerprints.sort().join("|")}`,
    sections,
    items,
  };
}

/** Signing reminder delay in days, from invitation creation to today. */
export function daysSinceInvitation(
  createdAt: Date | string,
  todayKey: string,
): number {
  const createdKey = toDateKey(createdAt);
  if (!createdKey) return 0;
  return Math.max(0, daysBetweenKeys(createdKey, todayKey));
}
