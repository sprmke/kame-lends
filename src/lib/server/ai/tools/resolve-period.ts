import { z } from "zod";
import {
  addDaysToKey,
  addMonthsClamped,
  dateKeyToUtcMidnight,
  daysBetweenKeys,
} from "$lib/dates/business-date";
import { defineTool, ToolError } from "../agent/registry";
import { dateFact, dateKey, readableDate } from "./shared";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function monthBounds(
  year: number,
  monthIndex: number,
): { from: string; to: string } {
  const from = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const next = addMonthsClamped(from, 1);
  return { from, to: addDaysToKey(next, -1) };
}

function weekStart(key: string): string {
  const date = dateKeyToUtcMidnight(key);
  const day = date.getUTCDay(); // 0 Sunday
  const offset = day === 0 ? -6 : 1 - day; // Monday start
  return addDaysToKey(key, offset);
}

function weekdayIndex(word: string): number {
  return WEEKDAYS.indexOf(word as (typeof WEEKDAYS)[number]);
}

function resolvePhrase(
  phrase: string,
  anchor: string,
): { from: string; to: string; label: string } {
  const text = phrase.trim().toLowerCase().replace(/\s+/g, " ");
  const anchorDate = dateKeyToUtcMidnight(anchor);
  const year = anchorDate.getUTCFullYear();
  const monthIndex = anchorDate.getUTCMonth();

  if (/^(today|ngayon)$/.test(text)) {
    return { from: anchor, to: anchor, label: readableDate(anchor) };
  }
  if (/^(yesterday|kahapon)$/.test(text)) {
    const key = addDaysToKey(anchor, -1);
    return { from: key, to: key, label: readableDate(key) };
  }
  if (/^(tomorrow|bukas)$/.test(text)) {
    const key = addDaysToKey(anchor, 1);
    return { from: key, to: key, label: readableDate(key) };
  }

  if (/^(this|current) week$/.test(text)) {
    const from = weekStart(anchor);
    return { from, to: addDaysToKey(from, 6), label: "This week" };
  }
  if (/^(last|previous) week$/.test(text)) {
    const from = addDaysToKey(weekStart(anchor), -7);
    return { from, to: addDaysToKey(from, 6), label: "Last week" };
  }
  if (/^next week$/.test(text)) {
    const from = addDaysToKey(weekStart(anchor), 7);
    return { from, to: addDaysToKey(from, 6), label: "Next week" };
  }

  if (/^(this|current) month$/.test(text)) {
    const bounds = monthBounds(year, monthIndex);
    return { ...bounds, label: "This month" };
  }
  if (/^(last|previous) month$/.test(text)) {
    const prev = addMonthsClamped(
      `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
      -1,
    );
    const prevDate = dateKeyToUtcMidnight(prev);
    return {
      ...monthBounds(prevDate.getUTCFullYear(), prevDate.getUTCMonth()),
      label: "Last month",
    };
  }
  if (/^next month$/.test(text)) {
    const next = addMonthsClamped(
      `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
      1,
    );
    const nextDate = dateKeyToUtcMidnight(next);
    return {
      ...monthBounds(nextDate.getUTCFullYear(), nextDate.getUTCMonth()),
      label: "Next month",
    };
  }

  if (/^(this|current) quarter$/.test(text)) {
    const startMonth = Math.floor(monthIndex / 3) * 3;
    return {
      ...monthBounds(year, startMonth),
      to: monthBounds(year, startMonth + 2).to,
      label: `Q${Math.floor(monthIndex / 3) + 1} ${year}`,
    };
  }
  if (/^(last|previous) quarter$/.test(text)) {
    const startMonth = Math.floor(monthIndex / 3) * 3 - 3;
    const target = new Date(Date.UTC(year, startMonth, 1));
    const targetYear = target.getUTCFullYear();
    const targetMonth = target.getUTCMonth();
    return {
      from: monthBounds(targetYear, targetMonth).from,
      to: monthBounds(targetYear, targetMonth + 2).to,
      label: `Q${Math.floor(targetMonth / 3) + 1} ${targetYear}`,
    };
  }

  const quarter = /^q([1-4])(?:\s+(\d{4}))?$/.exec(text);
  if (quarter) {
    const q = Number(quarter[1]);
    const qYear = quarter[2] ? Number(quarter[2]) : year;
    const startMonth = (q - 1) * 3;
    return {
      from: monthBounds(qYear, startMonth).from,
      to: monthBounds(qYear, startMonth + 2).to,
      label: `Q${q} ${qYear}`,
    };
  }

  if (/^(this|current) year$/.test(text)) {
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
  }
  if (/^(last|previous) year$/.test(text)) {
    return {
      from: `${year - 1}-01-01`,
      to: `${year - 1}-12-31`,
      label: String(year - 1),
    };
  }

  const relativeDays = /^(?:last|past) (\d{1,3}) days?$/.exec(text);
  if (relativeDays) {
    const count = Math.min(Number(relativeDays[1]), 366);
    return {
      from: addDaysToKey(anchor, -(count - 1)),
      to: anchor,
      label: `Last ${count} days`,
    };
  }
  const relativeWeeks = /^(?:last|past) (\d{1,2}) weeks?$/.exec(text);
  if (relativeWeeks) {
    const count = Math.min(Number(relativeWeeks[1]) * 7, 366);
    return {
      from: addDaysToKey(anchor, -(count - 1)),
      to: anchor,
      label: `Last ${count} days`,
    };
  }

  const since = /^since (?:(\d{4})-)?([a-z]+)$/.exec(text);
  if (since) {
    const month = MONTHS.indexOf(since[2] as (typeof MONTHS)[number]);
    if (month >= 0) {
      const sinceYear = since[1] ? Number(since[1]) : year;
      return {
        from: monthBounds(sinceYear, month).from,
        to: anchor,
        label: `Since ${readableDate(monthBounds(sinceYear, month).from)}`,
      };
    }
  }

  const monthYear = /^(?:(last|next) )?([a-z]+)(?: (\d{4}))?$/.exec(text);
  if (monthYear) {
    const month = MONTHS.indexOf(monthYear[2] as (typeof MONTHS)[number]);
    if (month >= 0) {
      let targetYear = monthYear[3] ? Number(monthYear[3]) : year;
      if (!monthYear[3] && monthYear[1] === "last" && month > monthIndex) {
        targetYear -= 1;
      }
      if (!monthYear[3] && monthYear[1] === "next" && month < monthIndex) {
        targetYear += 1;
      }
      const bounds = monthBounds(targetYear, month);
      return {
        ...bounds,
        label:
          readableDate(bounds.from).replace(/^\w+ \d+, /, "") +
          ` ${targetYear}`,
      };
    }
  }

  const nextWeekday =
    /^(this|next|last) (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.exec(
      text,
    );
  if (nextWeekday) {
    const direction =
      nextWeekday[1] === "next" ? 1 : nextWeekday[1] === "last" ? -1 : 0;
    const target = weekdayIndex(nextWeekday[2]);
    const current = dateKeyToUtcMidnight(anchor).getUTCDay();
    let delta = target - current;
    if (direction === 1 && delta <= 0) delta += 7;
    if (direction === -1 && delta >= 0) delta -= 7;
    const key = addDaysToKey(anchor, direction === 0 ? delta : delta);
    return { from: key, to: key, label: readableDate(key) };
  }

  const iso = /^(\d{4}-\d{2}-\d{2})(?:\.\.(\d{4}-\d{2}-\d{2}))?$/.exec(text);
  if (iso) {
    const from = iso[1];
    const to = iso[2] ?? from;
    if (to < from)
      throw new ToolError("bad_args", "The end date is before the start date");
    return {
      from,
      to,
      label:
        from === to
          ? readableDate(from)
          : `${readableDate(from)} to ${readableDate(to)}`,
    };
  }

  throw new ToolError(
    "bad_args",
    `I could not resolve the period "${phrase}"`,
    "Use a supported phrase (today, this week, last month, Q3, March, 2026-03-01..2026-03-31) or ask the user for dates.",
  );
}

export const resolvePeriodTool = defineTool({
  name: "resolve_period",
  description:
    "Turn a relative or named date range into exact from/to date keys in Asia/Manila. Use before any date-filtered tool. Never compute dates yourself.",
  capability: "read",
  args: z
    .object({
      phrase: z.string().min(1).max(80),
      anchor: dateKey.optional(),
    })
    .strict(),
  label: (args) => `Resolving “${args.phrase}”`,
  async run(args, ctx) {
    const range = resolvePhrase(args.phrase, args.anchor ?? ctx.today);
    const days = daysBetweenKeys(range.from, range.to);
    if (days > 366) {
      throw new ToolError(
        "too_broad",
        "That range is longer than a year",
        "Narrow it to 366 days or less, or split it into smaller periods.",
      );
    }
    dateFact(ctx, range.from, "Period start", undefined);
    dateFact(ctx, range.to, "Period end", undefined);
    return {
      notes: [
        `${range.label}: ${range.from} to ${range.to} (${days + 1} days)`,
      ],
      asOf: ctx.today,
    };
  },
});
