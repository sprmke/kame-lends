import {
  calendarEventKey,
  type LoanGoogleEventDraft,
} from "$lib/calendar-events";

/** Minimal shape for dedupe planning (unit tests + Google API events). */
export type CalendarEventDedupeRow = {
  id?: string | null;
  summary?: string | null;
  start?: { date?: string | null } | null;
  extendedProperties?: {
    private?: Record<string, string | undefined> | null;
  } | null;
};

/** Extra copies returned for the same `kameKey` query (keep the canonical id). */
export function duplicateIdsForSameKey(
  events: CalendarEventDedupeRow[],
  keepEventId: string | undefined,
): string[] {
  if (!keepEventId) return [];
  const ids: string[] = [];
  for (const event of events) {
    const id = event.id;
    if (id && id !== keepEventId) ids.push(id);
  }
  return ids;
}

export function inferLoanEventKameKey(
  event: CalendarEventDedupeRow,
  loanId: number,
  drafts: LoanGoogleEventDraft[],
): string | null {
  const priv = event.extendedProperties?.private ?? {};
  const dateKey = event.start?.date ?? undefined;
  if (!dateKey) return null;

  const kind = priv.kameKind;
  if (kind === "sent" || kind === "due" || kind === "interest_due") {
    return calendarEventKey(kind, dateKey, loanId);
  }

  const onDate = drafts.filter((d) => d.dateKey === dateKey);
  if (onDate.length === 1) return onDate[0].key;
  return null;
}

/**
 * After upserting all drafts, delete stale keys, duplicate keyed rows, and
 * legacy rows superseded by a keyed event on the same logical slot.
 */
export function planLoanCalendarEventDeletions(
  allForLoan: CalendarEventDedupeRow[],
  currentKeys: Set<string>,
  loanId: number,
  drafts: LoanGoogleEventDraft[],
): string[] {
  const keyedGroups = new Map<string, CalendarEventDedupeRow[]>();
  const unkeyed: CalendarEventDedupeRow[] = [];

  for (const event of allForLoan) {
    const key = event.extendedProperties?.private?.kameKey;
    if (!key) {
      unkeyed.push(event);
      continue;
    }
    const list = keyedGroups.get(key) ?? [];
    list.push(event);
    keyedGroups.set(key, list);
  }

  const toDelete = new Set<string>();

  for (const [key, events] of keyedGroups) {
    if (!currentKeys.has(key)) {
      for (const event of events) {
        if (event.id) toDelete.add(event.id);
      }
      continue;
    }
    if (events.length <= 1) continue;
    const keepId = events[0]?.id;
    for (const event of events.slice(1)) {
      if (event.id && event.id !== keepId) toDelete.add(event.id);
    }
  }

  const hasLiveKeyed = (kameKey: string): boolean => {
    const group = keyedGroups.get(kameKey) ?? [];
    return group.some((event) => event.id && !toDelete.has(event.id));
  };

  for (const event of unkeyed) {
    if (!event.id || toDelete.has(event.id)) continue;
    const inferred = inferLoanEventKameKey(event, loanId, drafts);
    if (!inferred || !currentKeys.has(inferred)) continue;
    if (hasLiveKeyed(inferred)) toDelete.add(event.id);
  }

  return [...toDelete];
}

/** Summary events use `kameKey` only (no loan id). */
export function planSummaryCalendarEventDeletions(
  events: CalendarEventDedupeRow[],
  keepEventId: string | undefined,
): string[] {
  return duplicateIdsForSameKey(events, keepEventId);
}
