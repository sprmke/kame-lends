import { fromLocalDateString } from "$lib/date-utils";
import { toLoanDueDayKey } from "$lib/loan-due-date";
import { addDays } from "date-fns";

export interface CapitalInterval {
  startKey: string;
  endKey: string;
  principal: number;
}

export function toCapitalDayKey(date: Date | string): string {
  return toLoanDueDayKey(date);
}

function addOneDayKey(dayKey: string): string {
  return toCapitalDayKey(addDays(fromLocalDateString(dayKey), 1));
}

export function clipCapitalIntervalToRange(
  interval: CapitalInterval,
  from: string | null,
  to: string | null,
): CapitalInterval | null {
  let { startKey, endKey, principal } = interval;
  if (from && endKey < from) return null;
  if (to && startKey > to) return null;
  if (from && startKey < from) startKey = from;
  if (to && endKey > to) endKey = to;
  return { startKey, endKey, principal };
}

function isActiveOnDay(interval: CapitalInterval, dayKey: string): boolean {
  return interval.startKey <= dayKey && dayKey <= interval.endKey;
}

/**
 * Peak deployed principal in a date range.
 * Reused capital (sequential periods) counts once; overlapping periods add together.
 */
export function computePeakConcurrentFromIntervals(
  intervals: CapitalInterval[],
  from: string | null = null,
  to: string | null = null,
): number {
  const clipped = intervals
    .map((interval) => clipCapitalIntervalToRange(interval, from, to))
    .filter((interval): interval is CapitalInterval => interval !== null);

  if (clipped.length === 0) return 0;
  if (clipped.length === 1) return clipped[0].principal;

  const boundaryKeys = new Set<string>();
  for (const interval of clipped) {
    boundaryKeys.add(interval.startKey);
    boundaryKeys.add(addOneDayKey(interval.endKey));
  }
  if (from) boundaryKeys.add(from);
  if (to) boundaryKeys.add(addOneDayKey(to));

  const sortedBoundaries = [...boundaryKeys].sort();
  let peak = 0;

  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const dayKey = sortedBoundaries[index];
    if (from && dayKey < from) continue;
    if (to && dayKey > to) continue;

    let concurrent = 0;
    for (const interval of clipped) {
      if (isActiveOnDay(interval, dayKey)) {
        concurrent += interval.principal;
      }
    }
    peak = Math.max(peak, concurrent);
  }

  return peak;
}
