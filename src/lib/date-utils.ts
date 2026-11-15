import {
  addMonthsClamped,
  dateKeyToUtcMidnight,
  toDateKey,
  todayKey,
} from "$lib/dates/business-date";

/**
 * Converts a value to a `YYYY-MM-DD` business date key (Asia/Manila).
 *
 * Historically this read UTC fields, which shifted local-midnight dates back a
 * day (FORM-03/DATE-05). Stored UTC-midnight values still resolve to the same
 * day because Manila is UTC+8.
 */
export function toLocalDateString(date: Date | string): string {
  return toDateKey(date);
}

/** Explicit UTC date key, for values knowingly stored at UTC midnight. */
export function toUtcDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * Converts a date string (YYYY-MM-DD) to a Date object at local midnight
 * This ensures the date is interpreted in the local timezone
 */
export function fromLocalDateString(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate the number of months between two dates
 * Returns the number of full months between the dates
 */
export function getMonthsBetweenDates(
  startDate: Date | string,
  endDate: Date | string,
): number {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;

  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = end.getDate() - start.getDate();

  let months = yearDiff * 12 + monthDiff;

  // If the end day is before the start day, we haven't completed a full month
  if (dayDiff < 0) {
    months -= 1;
  }

  return Math.max(0, months);
}

/**
 * Check if the duration between two dates is more than one month
 * Returns true only if there are 2 or more full months between the dates
 */
export function isMoreThanOneMonth(
  startDate: Date | string,
  endDate: Date | string,
): boolean {
  return getMonthsBetweenDates(startDate, endDate) > 1;
}

/**
 * Check if the duration between two dates is more than one month and 15 days (45 days total)
 * This is used to automatically trigger multiple interest periods
 */
export function isMoreThanOneMonthAndFifteenDays(
  startDate: Date | string,
  endDate: Date | string,
): boolean {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;

  // Calculate the difference in milliseconds
  const diffMs = end.getTime() - start.getTime();

  // Convert to days (45 days = 1 month + 15 days)
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > 45;
}

/**
 * Add months to a date, intelligently handling the day of month
 * If the target month has fewer days than the source day, it will use the last day of that month
 */
export function addMonths(date: Date | string, months: number): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  const originalDay = d.getDate();

  // Set to the first day to avoid issues with month boundaries
  d.setDate(1);
  d.setMonth(d.getMonth() + months);

  // Get the last day of the target month
  const lastDayOfMonth = new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0,
  ).getDate();

  // Use the original day or the last day of the month, whichever is smaller
  d.setDate(Math.min(originalDay, lastDayOfMonth));

  return d;
}

/**
 * Subtract months from a date, intelligently handling the day of month
 * If the target month has fewer days than the source day, it will use the last day of that month
 */
export function subtractMonths(date: Date | string, months: number): Date {
  return addMonths(date, -months);
}

/**
 * Get the last day of a given month
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate the appropriate day for period due dates based on sent date
 * If sent date is 1st, use last day of month for periods
 * If sent date is 15th, use 15th (or last day if month doesn't have 15 days)
 * Otherwise, use the sent date's day
 */
function calculatePeriodDay(
  sentDate: Date,
  targetMonth: number,
  targetYear: number,
): number {
  const sentDay = sentDate.getDate();
  const lastDayOfTargetMonth = getLastDayOfMonth(targetYear, targetMonth);

  // If sent date is the 1st, use last day of the month
  if (sentDay === 1) {
    return lastDayOfTargetMonth;
  }

  // For any other date, use the sent day or last day of month, whichever is smaller
  return Math.min(sentDay, lastDayOfTargetMonth);
}

/**
 * Generate default interest periods based on sent date and due date
 * Intelligently calculates period due dates:
 * - If sent date is 1st: periods end on last day of each month
 * - If sent date is 15th: periods end on 15th of each month
 * - Otherwise: periods end on the same day as sent date (or last day if month is shorter)
 */
export function generateDefaultInterestPeriods(
  sentDate: Date | string,
  dueDate: Date | string,
): Array<{ dueDate: Date; monthNumber: number }> {
  const startKey = toDateKey(sentDate);
  const endKey = toDateKey(dueDate);
  if (!startKey || !endKey) return [];
  if (endKey <= startKey) {
    return [{ dueDate: dateKeyToUtcMidnight(endKey), monthNumber: 1 }];
  }

  const [startYear, startMonth, startDay] = startKey.split("-").map(Number);
  const periods: Array<{ dueDate: Date; monthNumber: number }> = [];
  let periodNumber = 1;

  for (let offset = 0; offset <= 120; offset++) {
    const baseKey = addMonthsClamped(startKey, offset);
    const [year, month] = baseKey.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = startDay === 1 ? lastDay : Math.min(startDay, lastDay);
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (key > startKey && key < endKey) {
      periods.push({
        dueDate: dateKeyToUtcMidnight(key),
        monthNumber: periodNumber++,
      });
    }
    if (key >= endKey) break;
  }

  periods.push({
    dueDate: dateKeyToUtcMidnight(endKey),
    monthNumber: periodNumber,
  });

  return periods;
}

/**
 * Normalize a date to midnight (00:00:00) for date-only comparisons
 * This creates a new Date object to avoid mutating the original
 */
export function normalizeToMidnight(date: Date | string): Date {
  const key = toDateKey(date);
  return key ? dateKeyToUtcMidnight(key) : new Date(Number.NaN);
}

/**
 * Get today's date normalized to midnight
 */
export function getTodayAtMidnight(): Date {
  return dateKeyToUtcMidnight(todayKey());
}

/**
 * Format a date to MM/DD/YYYY string
 * Uses UTC methods to ensure consistency since dates are stored as UTC midnight
 * This is the display format for date pickers
 */
export function formatToMMDDYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Use UTC methods to extract the date since dates are stored as midnight UTC
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Parse MM/DD/YYYY string to YYYY-MM-DD string
 * Returns empty string if invalid
 */
export function parseMMDDYYYY(dateString: string): string {
  const match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";

  const [, month, day, year] = match;
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  const yearNum = parseInt(year, 10);

  // Validate date
  if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
    const date = new Date(yearNum, monthNum - 1, dayNum);
    // Check if the date is valid (handles invalid dates like 02/31/2024)
    if (
      date.getFullYear() === yearNum &&
      date.getMonth() === monthNum - 1 &&
      date.getDate() === dayNum
    ) {
      return `${year}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    }
  }

  return "";
}
