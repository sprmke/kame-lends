import { toDateKey, todayKey } from "$lib/dates/business-date";

/** True when a group's earliest open due date is already in the past. */
export function isGroupDuePast(
  date: Date | string | null | undefined,
): boolean {
  if (!date) return false;
  return toDateKey(date) < todayKey();
}

/** "Next due" for future dates, "Overdue since" for past dates. */
export function groupDuePrefix(date: Date | string | null | undefined): string {
  return isGroupDuePast(date) ? "Overdue since" : "Next due";
}
