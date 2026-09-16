import {
  draftLoanGoogleEvents,
  formatCalendarCurrency,
  nextDateKey,
  type LoanGoogleEventDraft,
  type LoanGoogleEventType,
} from "$lib/calendar-events";
import { isOpenLoan } from "$lib/calculations";
import { toLocalDateString } from "$lib/date-utils";
import {
  applyTelegramTemplate,
  resolveGroupTelegramTemplate,
  type GroupTelegramTemplateKind,
} from "$lib/groups/group-telegram-templates";
import type { LoanWithInvestors } from "$lib/types";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatTelegramMoney(amount: number, includeAmounts: boolean): string {
  if (!includeAmounts) return "—";
  return formatCalendarCurrency(amount);
}

function formatTelegramDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const EVENT_EMOJI: Record<LoanGoogleEventType, string> = {
  sent: "🔴",
  due: "🟢",
  interest_due: "🔵",
};

function eventTypeLabel(type: LoanGoogleEventType): string {
  if (type === "sent") return "Disbursement";
  if (type === "due") return "Due";
  return "Interest due";
}

function groupDeepLink(appUrl: string, groupId: number): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/groups/${groupId}`;
}

function loanDeepLink(appUrl: string, loanId: number): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/loans/${loanId}`;
}

function appendDeepLink(
  html: string,
  url: string,
  label = "Open in app",
): string {
  return `${html}\n\n<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

function linkHtml(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

export type GroupNotificationSettings = {
  notifyUpcoming: boolean;
  reminderDays: number[];
  notifyDueToday: boolean;
  notifyOverdue: boolean;
  overdueRepeatEveryDays: number;
  notifyDailyDigest: boolean;
  includeAmounts: boolean;
};

export type PlannedGroupNotification = {
  fingerprint: string;
  kind: string;
  html: string;
};

export function addDaysToDateKey(dateKey: string, days: number): string {
  let current = dateKey;
  const step = days >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(days); i += 1) {
    current = step > 0 ? nextDateKey(current) : previousDateKey(current);
  }
  return current;
}

function previousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 1, day - 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(
    prev.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function isInterestPeriodOverdue(
  loan: LoanWithInvestors,
  dateKey: string,
): boolean {
  for (const li of loan.loanInvestors) {
    if (!li.interestPeriods?.length) continue;
    for (const period of li.interestPeriods) {
      const periodKey = toLocalDateString(period.dueDate);
      if (periodKey !== dateKey) continue;
      const status = period.status;
      if (status === "Completed") return false;
      return status === "Overdue" || status === "Incomplete";
    }
  }
  return true;
}

function overdueEntityId(
  loan: LoanWithInvestors,
  draft: LoanGoogleEventDraft,
): string {
  if (draft.type === "interest_due") {
    for (const li of loan.loanInvestors) {
      if (!li.interestPeriods?.length) continue;
      for (const period of li.interestPeriods) {
        const periodKey = toLocalDateString(period.dueDate);
        if (periodKey === draft.dateKey) {
          return String(period.id);
        }
      }
    }
  }
  return String(loan.id);
}

function formatEventLine(
  loan: LoanWithInvestors,
  draft: LoanGoogleEventDraft,
  includeAmounts: boolean,
): string {
  const emoji = EVENT_EMOJI[draft.type];
  const label = eventTypeLabel(draft.type);
  const amount = formatTelegramMoney(draft.totalAmount, includeAmounts);
  return `${emoji} <b>${escapeHtml(loan.loanName)}</b> · ${label} · ${formatTelegramDateKey(draft.dateKey)} · ${amount}`;
}

function collectOpenDrafts(
  loans: LoanWithInvestors[],
  todayKey: string,
): Array<{ loan: LoanWithInvestors; draft: LoanGoogleEventDraft }> {
  const rows: Array<{ loan: LoanWithInvestors; draft: LoanGoogleEventDraft }> =
    [];
  for (const loan of loans) {
    if (!isOpenLoan(loan)) continue;
    for (const draft of draftLoanGoogleEvents(loan, "open", todayKey)) {
      if (draft.type === "sent") continue;
      rows.push({ loan, draft });
    }
  }
  return rows;
}

function shouldSendOverdueToday(
  dateKey: string,
  todayKey: string,
  repeatEveryDays: number,
): boolean {
  const daysPast = daysBetweenDateKeys(dateKey, todayKey);
  if (daysPast < 1) return false;
  return (daysPast - 1) % repeatEveryDays === 0;
}

export function planGroupNotifications(
  loans: LoanWithInvestors[],
  settings: GroupNotificationSettings,
  todayKey: string,
  options?: {
    appUrl?: string;
    groupId?: number;
    templates?: Record<string, string> | null;
  },
): PlannedGroupNotification[] {
  const appUrl = options?.appUrl ?? "https://example.com";
  const groupId = options?.groupId ?? 0;
  const templates = options?.templates ?? null;
  const planned: PlannedGroupNotification[] = [];
  const eventRows = collectOpenDrafts(loans, todayKey);

  for (const { loan, draft } of eventRows) {
    const { dateKey } = draft;
    const type = draft.type as LoanGoogleEventType;

    if (settings.notifyUpcoming) {
      for (const n of settings.reminderDays) {
        const targetKey = addDaysToDateKey(todayKey, n);
        if (dateKey !== targetKey) continue;
        const fingerprint = `upcoming:${type}:${loan.id}:${dateKey}:D-${n}`;
        planned.push({
          fingerprint,
          kind: "upcoming",
          html: buildSingleReminderHtml(
            loan,
            draft,
            settings.includeAmounts,
            `Upcoming in ${n} day${n === 1 ? "" : "s"}`,
            appUrl,
            "upcoming",
            templates,
          ),
        });
      }
    }

    if (settings.notifyDueToday && dateKey === todayKey) {
      planned.push({
        fingerprint: `due_today:${type}:${loan.id}:${dateKey}`,
        kind: "due_today",
        html: buildSingleReminderHtml(
          loan,
          draft,
          settings.includeAmounts,
          "Due today",
          appUrl,
          "due_today",
          templates,
        ),
      });
    }

    if (
      settings.notifyOverdue &&
      dateKey < todayKey &&
      isOpenLoan(loan) &&
      shouldSendOverdueToday(dateKey, todayKey, settings.overdueRepeatEveryDays)
    ) {
      if (
        draft.type === "interest_due" &&
        !isInterestPeriodOverdue(loan, dateKey)
      ) {
        continue;
      }
      const entityId = overdueEntityId(loan, draft);
      planned.push({
        fingerprint: `overdue:${entityId}:${todayKey}`,
        kind: "overdue",
        html: buildSingleReminderHtml(
          loan,
          draft,
          settings.includeAmounts,
          "Overdue",
          appUrl,
          "overdue",
          templates,
        ),
      });
    }
  }

  if (settings.notifyDailyDigest) {
    planned.push({
      fingerprint: `digest:${todayKey}`,
      kind: "digest",
      html: buildDigestHtml(
        loans,
        settings,
        todayKey,
        appUrl,
        groupId,
        templates,
      ),
    });
  }

  return planned;
}

function buildSingleReminderHtml(
  loan: LoanWithInvestors,
  draft: LoanGoogleEventDraft,
  includeAmounts: boolean,
  heading: string,
  appUrl: string,
  kind: GroupTelegramTemplateKind,
  templates?: Record<string, string> | null,
): string {
  const template = resolveGroupTelegramTemplate(kind, templates);
  const vars = {
    heading: escapeHtml(heading),
    loan_name: escapeHtml(loan.loanName),
    event_type: eventTypeLabel(draft.type),
    date: formatTelegramDateKey(draft.dateKey),
    amount: formatTelegramMoney(draft.totalAmount, includeAmounts),
    loan_link: linkHtml(loanDeepLink(appUrl, loan.id), "View loan"),
  };
  return applyTelegramTemplate(template, vars);
}

function buildDigestHtml(
  loans: LoanWithInvestors[],
  settings: GroupNotificationSettings,
  todayKey: string,
  appUrl: string,
  groupId: number,
  templates?: Record<string, string> | null,
): string {
  const dueToday: string[] = [];
  const overdue: string[] = [];
  const upcoming: string[] = [];
  let netIn = 0;
  let netOut = 0;

  const weekEnd = addDaysToDateKey(todayKey, 7);

  for (const loan of loans) {
    if (!isOpenLoan(loan)) continue;
    for (const draft of draftLoanGoogleEvents(loan, "open", todayKey)) {
      if (draft.dateKey < todayKey || draft.dateKey > weekEnd) continue;
      if (draft.type === "sent") {
        netOut += draft.totalAmount;
        continue;
      }
      const line = formatEventLine(loan, draft, settings.includeAmounts);
      if (draft.dateKey === todayKey) {
        dueToday.push(line);
        netIn += draft.totalAmount;
      } else if (draft.dateKey < todayKey) {
        overdue.push(line);
      } else {
        upcoming.push(line);
        netIn += draft.totalAmount;
      }
    }
  }

  const bodySections: string[] = [];

  if (dueToday.length) {
    bodySections.push(`\n<b>Due today</b>\n${dueToday.join("\n")}`);
  }
  if (overdue.length) {
    bodySections.push(`\n<b>Overdue</b>\n${overdue.join("\n")}`);
  }
  if (upcoming.length) {
    bodySections.push(`\n<b>Next 7 days</b>\n${upcoming.join("\n")}`);
  }

  if (settings.includeAmounts) {
    const net = netIn - netOut;
    const sign = net >= 0 ? "+" : "-";
    bodySections.push(
      `\n<b>Net (7d outlook)</b> ${sign}${formatTelegramMoney(Math.abs(net), true)}`,
    );
  }

  if (dueToday.length === 0 && overdue.length === 0 && upcoming.length === 0) {
    bodySections.push("\nNo upcoming items in the next week.");
  }

  const digestBody = bodySections.join("");
  const template = resolveGroupTelegramTemplate("digest", templates);
  return applyTelegramTemplate(template, {
    today: formatTelegramDateKey(todayKey),
    digest_body: digestBody,
    group_link: linkHtml(groupDeepLink(appUrl, groupId), "Open group"),
  });
}

/** Activity + test messages (templates optional). */
export function buildGroupTelegramActivityHtml(
  summary: string,
  options: {
    appUrl: string;
    groupId: number;
    loanId?: number | null;
    templates?: Record<string, string> | null;
  },
): string {
  const template = resolveGroupTelegramTemplate("activity", options.templates);
  const loanLink =
    options.loanId != null
      ? linkHtml(loanDeepLink(options.appUrl, options.loanId), "View loan")
      : linkHtml(groupDeepLink(options.appUrl, options.groupId), "Open group");
  return applyTelegramTemplate(template, {
    summary: escapeHtml(summary.trim()),
    loan_link: loanLink,
    group_link: linkHtml(
      groupDeepLink(options.appUrl, options.groupId),
      "Open group",
    ),
  });
}

export function buildGroupTelegramTestHtml(
  appUrl: string,
  groupId: number,
  templates?: Record<string, string> | null,
): string {
  const template = resolveGroupTelegramTemplate("test", templates);
  return applyTelegramTemplate(template, {
    group_link: linkHtml(groupDeepLink(appUrl, groupId), "Open group"),
  });
}

/** Exported for tests and /upcoming command. */
export function planUpcomingWeekHtml(
  loans: LoanWithInvestors[],
  todayKey: string,
  includeAmounts: boolean,
  appUrl: string,
  groupId: number,
): string {
  const eventRows = collectOpenDrafts(loans, todayKey);
  const weekEnd = addDaysToDateKey(todayKey, 7);
  const lines = eventRows
    .filter(
      ({ draft }) => draft.dateKey >= todayKey && draft.dateKey <= weekEnd,
    )
    .sort((a, b) => a.draft.dateKey.localeCompare(b.draft.dateKey))
    .map(({ loan, draft }) => formatEventLine(loan, draft, includeAmounts));

  const body =
    lines.length > 0
      ? `<b>Next 7 days</b>\n${lines.join("\n")}`
      : "<b>Next 7 days</b>\nNothing scheduled.";
  return appendDeepLink(body, groupDeepLink(appUrl, groupId), "Open group");
}
