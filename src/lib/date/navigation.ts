import {
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  isThisMonth,
  isThisWeek,
  isThisYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

export type DatePreset = "week" | "month" | "year" | "all-time" | "custom";

/** URL query value for unbounded list date range (`?range=all`). */
export const ALL_TIME_RANGE_PARAM = "all";

export function isAllTimeDateRange(url: URL): boolean {
  return url.searchParams.get("range") === ALL_TIME_RANGE_PARAM;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export function detectPresetFromRange(from: Date, to: Date): DatePreset {
  const weekStart = startOfWeek(from, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(from, { weekStartsOn: 0 });
  if (isSameDay(from, weekStart) && isSameDay(to, weekEnd)) {
    return "week";
  }

  const monthStart = startOfMonth(from);
  const monthEnd = endOfMonth(from);
  if (
    isSameDay(from, monthStart) &&
    isSameDay(to, monthEnd) &&
    isSameMonth(from, to)
  ) {
    return "month";
  }

  const yearStart = startOfYear(from);
  const yearEnd = endOfYear(from);
  if (isSameDay(from, yearStart) && isSameDay(to, yearEnd)) {
    return "year";
  }

  return "custom";
}

export function getDateRangeFromPreset(
  preset: DatePreset,
  referenceDate: Date,
): DateRange {
  switch (preset) {
    case "week":
      return {
        from: startOfWeek(referenceDate, { weekStartsOn: 0 }),
        to: endOfWeek(referenceDate, { weekStartsOn: 0 }),
      };
    case "month":
      return {
        from: startOfMonth(referenceDate),
        to: endOfMonth(referenceDate),
      };
    case "year":
      return {
        from: startOfYear(referenceDate),
        to: endOfYear(referenceDate),
      };
    case "all-time":
      return {
        from: startOfYear(referenceDate),
        to: endOfYear(referenceDate),
      };
    case "custom":
    default:
      return {
        from: startOfMonth(referenceDate),
        to: endOfMonth(referenceDate),
      };
  }
}

export function navigateReferenceDate(
  referenceDate: Date,
  preset: DatePreset,
  direction: "prev" | "next",
): Date {
  switch (preset) {
    case "week":
      return direction === "next"
        ? addWeeks(referenceDate, 1)
        : subWeeks(referenceDate, 1);
    case "month":
      return direction === "next"
        ? addMonths(referenceDate, 1)
        : subMonths(referenceDate, 1);
    case "year":
      return direction === "next"
        ? addYears(referenceDate, 1)
        : subYears(referenceDate, 1);
    case "all-time":
    case "custom":
    default:
      return referenceDate;
  }
}

export function formatDateRangeFromDates(from: Date, to: Date): string {
  if (isSameDay(from, to)) {
    return format(from, "MMM d, yyyy");
  }
  if (isSameMonth(from, to) && isSameYear(from, to)) {
    return `${format(from, "MMM d")} - ${format(to, "d, yyyy")}`;
  }
  return `${format(from, "MMM d, yyyy")} - ${format(to, "MMM d, yyyy")}`;
}

export function formatDateRangeDisplay(
  from: Date,
  to: Date,
  preset: DatePreset,
): string {
  switch (preset) {
    case "month":
      return format(from, "MMMM yyyy");
    case "year":
      return format(from, "yyyy");
    case "all-time":
      return "All-time";
    case "week":
    case "custom":
    default:
      return formatDateRangeFromDates(from, to);
  }
}

export function isCurrentPeriod(from: Date, preset: DatePreset): boolean {
  switch (preset) {
    case "week":
      return isThisWeek(from, { weekStartsOn: 0 });
    case "month":
      return isThisMonth(from);
    case "year":
      return isThisYear(from);
    default:
      return false;
  }
}

export function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, day] = value.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, day ?? 1);
  return Number.isNaN(date.getTime()) ? null : date;
}
