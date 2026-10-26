import type {
  CalendarEvent,
  CalendarEventDue,
  CalendarEventInterestDue,
  CalendarEventSent,
} from "$lib/components/common/calendar/types";
import { buildLoanCalendarEvents } from "$lib/composables/use-loan-calendar-events";
import { fromLocalDateString } from "$lib/date-utils";
import type { LoanWithInvestors } from "$lib/types";

export type TimelineDirection = "in" | "out";

export type TimelineKind = "sent" | "scheduled" | "interest" | "due";

export type TimelineEntry = {
  id: string;
  dateKey: string;
  direction: TimelineDirection;
  kind: TimelineKind;
  kindLabel: string;
  loan: LoanWithInvestors;
  title: string;
  detail: string;
  amount: number;
};

export type TimelineDay = {
  dateKey: string;
  isToday: boolean;
  inTotal: number;
  outTotal: number;
  entries: TimelineEntry[];
};

export type TimelineMonth = {
  key: string;
  label: string;
  inTotal: number;
  outTotal: number;
  days: TimelineDay[];
};

export type LoanTimeline = {
  months: TimelineMonth[];
  inTotal: number;
  outTotal: number;
  anchorKey: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const KIND_RANK: Record<TimelineKind, number> = {
  sent: 0,
  scheduled: 1,
  interest: 2,
  due: 3,
};

export type LoanTimelineOptions = {
  from?: string | null;
  to?: string | null;
  today?: Date | null;
};

export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dayInRange(
  dateKey: string,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

/** One muted subtitle line: investors, then borrower when both exist. */
export function timelinePartyLine(loan: LoanWithInvestors): string {
  const investorNames = [
    ...new Set(
      loan.loanInvestors
        .map((row) => row.investor.name.trim())
        .filter((name) => name.length > 0),
    ),
  ];
  const borrowerName = loan.borrower?.name?.trim() ?? "";
  const parts: string[] = [];
  if (investorNames.length > 0) parts.push(investorNames.join(", "));
  if (borrowerName) parts.push(borrowerName);
  return parts.join(" · ");
}

export function timelineDayParts(dateKey: string): {
  day: string;
  weekday: string;
  monthLabel: string;
} {
  const date = fromLocalDateString(dateKey);
  return {
    day: String(date.getDate()),
    weekday: WEEKDAYS[date.getDay()] ?? "",
    monthLabel: `${MONTHS[date.getMonth()] ?? ""} ${date.getFullYear()}`,
  };
}

function compareEntries(a: TimelineEntry, b: TimelineEntry): number {
  const rank = KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (rank !== 0) return rank;
  return a.title.localeCompare(b.title);
}

function entryFromEvent(
  event: CalendarEvent,
  dateKey: string,
  taken: Map<string, number>,
): TimelineEntry | null {
  if (event.type === "sent") {
    const sent = event as CalendarEventSent;
    const scheduled = sent.hasUnpaidTransactions;
    return {
      id: uniqueId(`${dateKey}:sent:${sent.loan.id}`, taken),
      dateKey,
      direction: "out",
      kind: scheduled ? "scheduled" : "sent",
      kindLabel: scheduled ? "Scheduled" : "Sent",
      loan: sent.loan,
      title: sent.loan.loanName,
      detail: sent.investors.map((investor) => investor.name).join(", "),
      amount: sent.totalAmount,
    };
  }

  if (event.type === "interest_due") {
    const interest = event as CalendarEventInterestDue;
    return {
      id: uniqueId(
        `${dateKey}:interest:${interest.loan.id}:${interest.interestPeriod.id}`,
        taken,
      ),
      dateKey,
      direction: "in",
      kind: "interest",
      kindLabel: "Interest",
      loan: interest.loan,
      title: interest.loan.loanName,
      detail: interest.loanInvestor.investor.name,
      amount: interest.totalAmount,
    };
  }

  if (event.type === "due") {
    const due = event as CalendarEventDue;
    return {
      id: uniqueId(`${dateKey}:due:${due.loan.id}`, taken),
      dateKey,
      direction: "in",
      kind: "due",
      kindLabel: "Due",
      loan: due.loan,
      title: due.loan.loanName,
      detail: "",
      amount: due.totalAmount,
    };
  }

  return null;
}

function uniqueId(base: string, taken: Map<string, number>): string {
  const count = taken.get(base) ?? 0;
  taken.set(base, count + 1);
  return count === 0 ? base : `${base}:${count}`;
}

function dayTotals(entries: TimelineEntry[]): {
  inTotal: number;
  outTotal: number;
} {
  let inTotal = 0;
  let outTotal = 0;
  for (const entry of entries) {
    if (entry.direction === "in") inTotal += entry.amount;
    else outTotal += entry.amount;
  }
  return { inTotal, outTotal };
}

export function buildLoanTimeline(
  loans: LoanWithInvestors[],
  options: LoanTimelineOptions = {},
): LoanTimeline {
  const from = options.from ?? null;
  const to = options.to ?? null;
  const todayKey = options.today ? localDayKey(options.today) : null;
  const taken = new Map<string, number>();
  const byDay = new Map<string, TimelineEntry[]>();

  for (const event of buildLoanCalendarEvents(loans)) {
    const dateKey = localDayKey(event.date);
    if (!dayInRange(dateKey, from, to)) continue;
    const entry = entryFromEvent(event, dateKey, taken);
    if (!entry) continue;
    const bucket = byDay.get(dateKey);
    if (bucket) bucket.push(entry);
    else byDay.set(dateKey, [entry]);
  }

  if (byDay.size === 0) {
    return { months: [], inTotal: 0, outTotal: 0, anchorKey: null };
  }

  if (todayKey && dayInRange(todayKey, from, to) && !byDay.has(todayKey)) {
    const keys = [...byDay.keys()].sort();
    const first = keys[0];
    const last = keys[keys.length - 1];
    const insideEvents = Boolean(
      first && last && todayKey >= first && todayKey <= last,
    );
    const boundedRange = Boolean(from && to);
    if (insideEvents || boundedRange) byDay.set(todayKey, []);
  }

  const dateKeys = [...byDay.keys()].sort();
  const months: TimelineMonth[] = [];
  let inTotal = 0;
  let outTotal = 0;

  for (const dateKey of dateKeys) {
    const entries = [...(byDay.get(dateKey) ?? [])].sort(compareEntries);
    const totals = dayTotals(entries);
    inTotal += totals.inTotal;
    outTotal += totals.outTotal;
    const day: TimelineDay = {
      dateKey,
      isToday: dateKey === todayKey,
      ...totals,
      entries,
    };
    const monthKey = dateKey.slice(0, 7);
    const current = months[months.length - 1];
    if (!current || current.key !== monthKey) {
      months.push({
        key: monthKey,
        label: timelineDayParts(dateKey).monthLabel,
        inTotal: totals.inTotal,
        outTotal: totals.outTotal,
        days: [day],
      });
    } else {
      current.days.push(day);
      current.inTotal += totals.inTotal;
      current.outTotal += totals.outTotal;
    }
  }

  const anchorKey =
    todayKey &&
    months.some((month) => month.days.some((day) => day.dateKey === todayKey))
      ? todayKey
      : null;

  return { months, inTotal, outTotal, anchorKey };
}
