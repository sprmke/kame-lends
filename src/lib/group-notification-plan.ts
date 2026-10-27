import {
  draftLoanGoogleEvents,
  nextDateKey,
  type LoanGoogleEventDraft,
  type LoanGoogleEventType,
} from "$lib/calendar-events";
import { isOpenLoan } from "$lib/calculations";
import { toLocalDateString } from "$lib/date-utils";
import {
  applyTelegramTemplate,
  resolveGroupTelegramTemplate,
  templateKindForActivity,
  type GroupTelegramTemplateKind,
} from "$lib/groups/group-telegram-templates";
import {
  buildTelegramLoanContext,
  capTelegramLines,
  escapeTelegramHtml,
  formatTelegramDateKey,
  formatTelegramMoney,
  telegramLinkHtml,
  type TelegramActivityDetail,
} from "$lib/groups/telegram-message-context";
import type { LoanWithInvestors } from "$lib/types";

function eventTypeLabel(type: LoanGoogleEventType): string {
  if (type === "sent") return "Disbursement";
  if (type === "due") return "Due";
  return "Interest due";
}

function groupUrl(appUrl: string, groupId: number): string {
  return `${appUrl.replace(/\/$/, "")}/groups/${groupId}`;
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
  const amount = includeAmounts
    ? ` · ${formatTelegramMoney(draft.totalAmount, true)}`
    : "";
  const borrower = loan.borrower?.name?.trim();
  const who = borrower ? `\n  ${escapeTelegramHtml(borrower)}` : "";
  return `• ${escapeTelegramHtml(loan.loanName)} · ${eventTypeLabel(draft.type)} · ${formatTelegramDateKey(draft.dateKey)}${amount}${who}`;
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

type RenderOptions = {
  appUrl?: string;
  groupId?: number;
  groupName?: string;
  templates?: Record<string, string> | null;
};

export function planGroupNotifications(
  loans: LoanWithInvestors[],
  settings: GroupNotificationSettings,
  todayKey: string,
  options?: RenderOptions,
): PlannedGroupNotification[] {
  const appUrl = options?.appUrl ?? "https://example.com";
  const groupId = options?.groupId ?? 0;
  const groupName = options?.groupName ?? "";
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
            groupId,
            groupName,
            "upcoming",
            templates,
            todayKey,
            n,
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
          groupId,
          groupName,
          "due_today",
          templates,
          todayKey,
          null,
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
          groupId,
          groupName,
          "overdue",
          templates,
          todayKey,
          null,
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
        groupName,
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
  groupId: number,
  groupName: string,
  kind: GroupTelegramTemplateKind,
  templates: Record<string, string> | null,
  todayKey: string,
  daysUntil: number | null,
): string {
  const template = resolveGroupTelegramTemplate(kind, templates);
  const daysOverdue =
    kind === "overdue" ? daysBetweenDateKeys(draft.dateKey, todayKey) : null;
  const vars = buildTelegramLoanContext(loan, {
    appUrl,
    groupId,
    groupName,
    includeAmounts,
    loanId: loan.id,
    event: {
      heading,
      typeLabel: eventTypeLabel(draft.type),
      dateKey: draft.dateKey,
      totalAmount: draft.totalAmount,
      principalPart: draft.totalPrincipal,
      interestPart: draft.totalInterest ?? draft.interest,
      daysUntil,
      daysOverdue,
    },
  });
  return applyTelegramTemplate(template, vars);
}

function buildDigestHtml(
  loans: LoanWithInvestors[],
  settings: GroupNotificationSettings,
  todayKey: string,
  appUrl: string,
  groupId: number,
  groupName: string,
  templates: Record<string, string> | null,
): string {
  const sections = collectDigestSections(loans, settings, todayKey, false);
  const template = resolveGroupTelegramTemplate("digest", templates);
  return applyTelegramTemplate(template, {
    ...digestVars(
      sections,
      settings.includeAmounts,
      todayKey,
      appUrl,
      groupId,
      groupName,
    ),
    empty_notice:
      sections.dueToday.length === 0 &&
      sections.overdue.length === 0 &&
      sections.upcoming.length === 0
        ? "Nothing due in the next 7 days."
        : "",
  });
}

type DigestSections = {
  dueToday: string[];
  overdue: string[];
  upcoming: string[];
  netIn: number;
  netOut: number;
};

function collectDigestSections(
  loans: LoanWithInvestors[],
  settings: GroupNotificationSettings,
  todayKey: string,
  includeTodayInUpcoming: boolean,
): DigestSections {
  const dueToday: string[] = [];
  const overdue: string[] = [];
  const upcoming: string[] = [];
  let netIn = 0;
  let netOut = 0;
  const weekEnd = addDaysToDateKey(todayKey, 7);

  for (const loan of loans) {
    if (!isOpenLoan(loan)) continue;
    for (const draft of draftLoanGoogleEvents(loan, "open", todayKey)) {
      if (draft.type === "sent") {
        if (draft.dateKey >= todayKey && draft.dateKey <= weekEnd) {
          netOut += draft.totalAmount;
        }
        continue;
      }
      if (draft.dateKey < todayKey) {
        if (
          draft.type === "interest_due" &&
          !isInterestPeriodOverdue(loan, draft.dateKey)
        ) {
          continue;
        }
        overdue.push(formatEventLine(loan, draft, settings.includeAmounts));
        continue;
      }
      if (draft.dateKey > weekEnd) continue;
      const line = formatEventLine(loan, draft, settings.includeAmounts);
      if (draft.dateKey === todayKey && !includeTodayInUpcoming) {
        dueToday.push(line);
        netIn += draft.totalAmount;
      } else {
        upcoming.push(line);
        netIn += draft.totalAmount;
      }
    }
  }

  return { dueToday, overdue, upcoming, netIn, netOut };
}

function digestVars(
  sections: DigestSections,
  includeAmounts: boolean,
  todayKey: string,
  appUrl: string,
  groupId: number,
  groupName: string,
): Record<string, string> {
  const dueBody = capTelegramLines(sections.dueToday);
  const overdueBody = capTelegramLines(sections.overdue);
  const upcomingBody = capTelegramLines(sections.upcoming);
  const parts: string[] = [];
  if (dueBody) parts.push(`<b>Due today</b>\n${dueBody}`);
  if (overdueBody) parts.push(`<b>Overdue</b>\n${overdueBody}`);
  if (upcomingBody) parts.push(`<b>Next 7 days</b>\n${upcomingBody}`);
  const net = sections.netIn - sections.netOut;
  const netText = includeAmounts
    ? `${net >= 0 ? "+" : "-"}${formatTelegramMoney(Math.abs(net), true)}`
    : "Hidden";
  const empty =
    sections.dueToday.length === 0 &&
    sections.overdue.length === 0 &&
    sections.upcoming.length === 0;
  return {
    today: formatTelegramDateKey(todayKey),
    group_name: escapeTelegramHtml(groupName),
    group_link: telegramLinkHtml(groupUrl(appUrl, groupId), "Open group"),
    due_today_count: String(sections.dueToday.length),
    due_today_body: dueBody,
    overdue_count: String(sections.overdue.length),
    overdue_body: overdueBody,
    upcoming_count: String(sections.upcoming.length),
    upcoming_body: upcomingBody,
    net: netText,
    digest_body: empty ? "Nothing due in the next 7 days." : parts.join("\n\n"),
    empty_notice: "",
  };
}

export function buildGroupTelegramActivityHtml(input: {
  type: string;
  summary: string;
  loan: LoanWithInvestors | null;
  appUrl: string;
  groupId: number;
  groupName: string;
  includeAmounts: boolean;
  templates?: Record<string, string> | null;
  detail?: TelegramActivityDetail;
  loanId?: number | null;
}): string {
  const kind = templateKindForActivity(input.type);
  const template = resolveGroupTelegramTemplate(kind, input.templates);
  const vars = buildTelegramLoanContext(input.loan, {
    appUrl: input.appUrl,
    groupId: input.groupId,
    groupName: input.groupName,
    includeAmounts: input.includeAmounts,
    detail: input.detail,
    summary: input.summary,
    activityType: input.type,
    loanId: input.loan?.id ?? input.loanId,
  });
  return applyTelegramTemplate(template, vars);
}

export function buildGroupTelegramTestHtml(
  appUrl: string,
  groupId: number,
  templates?: Record<string, string> | null,
  groupName = "",
): string {
  const template = resolveGroupTelegramTemplate("test", templates);
  return applyTelegramTemplate(template, {
    group_name: escapeTelegramHtml(groupName),
    group_link: telegramLinkHtml(groupUrl(appUrl, groupId), "Open group"),
  });
}

/** Exported for tests and /upcoming command. */
export function planUpcomingWeekHtml(
  loans: LoanWithInvestors[],
  todayKey: string,
  includeAmounts: boolean,
  appUrl: string,
  groupId: number,
  groupName = "",
  templates?: Record<string, string> | null,
): string {
  const sections = collectDigestSections(
    loans,
    {
      notifyUpcoming: false,
      reminderDays: [],
      notifyDueToday: false,
      notifyOverdue: false,
      overdueRepeatEveryDays: 1,
      notifyDailyDigest: false,
      includeAmounts,
    },
    todayKey,
    true,
  );
  const template = resolveGroupTelegramTemplate("upcoming_week", templates);
  const upcomingBody = capTelegramLines(sections.upcoming);
  return applyTelegramTemplate(template, {
    ...digestVars(
      sections,
      includeAmounts,
      todayKey,
      appUrl,
      groupId,
      groupName,
    ),
    upcoming_body: upcomingBody,
    upcoming_count: String(sections.upcoming.length),
    due_today_body: "",
    due_today_count: "0",
    empty_notice: upcomingBody ? "" : "Nothing scheduled.",
    digest_body: upcomingBody || "Nothing scheduled.",
  });
}
