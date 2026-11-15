/**
 * Business dates for Kame Lends.
 *
 * The business runs in Asia/Manila. Date-only fields (loan due date, sent
 * date, period due date, received date, debt date) are stored as timestamps
 * at UTC midnight of the business date, so `toDateKey` reads the UTC fields
 * for stored values but uses Manila for "now".
 */

export const BUSINESS_TZ = "Asia/Manila";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type DateInput = Date | string | number;

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function partsFromDate(date: Date, timeZone?: string): string {
  const formatter = timeZone
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : dateKeyFormatter;
  return formatter.format(date);
}

/**
 * `YYYY-MM-DD` for a stored date value.
 *
 * - A `YYYY-MM-DD` string is returned unchanged.
 * - Every Date/timestamp is read in Asia/Manila. A stored UTC-midnight value
 *   and a local-midnight value both resolve to the same business day, so SSR
 *   (UTC) and the browser (Manila) agree.
 * - Use `todayKey()` for "now".
 */
export function toDateKey(value: DateInput | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    if (isDateKey(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return partsFromDate(parsed);
  }
  if (typeof value === "number") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return partsFromDate(parsed);
  }
  if (Number.isNaN(value.getTime())) return "";
  return partsFromDate(value);
}

/** Today's date key in Asia/Manila. */
export function todayKey(now: Date = new Date()): string {
  return partsFromDate(now);
}

/** UTC midnight for a business date key. */
export function dateKeyToUtcMidnight(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Negative when `left` is before `right`, zero when equal, positive after. */
export function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

export function isDateKeyBefore(left: string, right: string): boolean {
  return compareDateKeys(left, right) < 0;
}

export function isDateKeyAfter(left: string, right: string): boolean {
  return compareDateKeys(left, right) > 0;
}

export function isSameDateKey(left: string, right: string): boolean {
  return left !== "" && left === right;
}

/**
 * Overdue starts the day after the due date (D-2), never on it.
 * `isAfterDueDate("2026-03-31", "2026-04-01")` is true.
 */
export function isAfterDueDate(dueKey: string, today: string): boolean {
  return today !== "" && dueKey !== "" && today > dueKey;
}

/** Add months to a date key, clamping to the last day of the target month. */
export function addMonthsClamped(key: string, months: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Whole calendar months between two keys (never negative). */
export function monthsBetweenKeys(startKey: string, endKey: string): number {
  const [startYear, startMonth, startDay] = startKey.split("-").map(Number);
  const [endYear, endMonth, endDay] = endKey.split("-").map(Number);
  let months = (endYear - startYear) * 12 + (endMonth - startMonth);
  if (endDay < startDay) months -= 1;
  return Math.max(0, months);
}

/** Add days to a date key. */
export function addDaysToKey(key: string, days: number): string {
  const date = dateKeyToUtcMidnight(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Days between two keys. */
export function daysBetweenKeys(startKey: string, endKey: string): number {
  const start = dateKeyToUtcMidnight(startKey).getTime();
  const end = dateKeyToUtcMidnight(endKey).getTime();
  return Math.round((end - start) / 86_400_000);
}

/**
 * Human duration between two business dates, e.g. "2 Months".
 * Uses calendar months with clamping, so Jan 31 → Mar 31 is 2 months.
 */
export function formatDurationBetweenKeys(
  startKey: string,
  endKey: string,
): string {
  if (!startKey || !endKey || endKey < startKey) return "0 Days";

  let months = monthsBetweenKeys(startKey, endKey);
  if (months > 0) {
    while (addMonthsClamped(startKey, months) > endKey) months -= 1;
  }
  const afterMonths = addMonthsClamped(startKey, months);
  const remainingDays = Math.max(0, daysBetweenKeys(afterMonths, endKey));
  const weeks = Math.floor(remainingDays / 7);
  const days = remainingDays % 7;

  const parts: string[] = [];
  if (months > 0) parts.push(`${months} ${months === 1 ? "Month" : "Months"}`);
  if (weeks > 0) parts.push(`${weeks} ${weeks === 1 ? "Week" : "Weeks"}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? "Day" : "Days"}`);
  return parts.length > 0 ? parts.join(", ") : "0 Days";
}
