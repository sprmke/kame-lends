import { redirect } from "@sveltejs/kit";
import {
  ALL_TIME_RANGE_PARAM,
  DEFAULT_DATE_PRESET,
  getDateRangeFromPreset,
  isAllTimeDateRange,
  toIsoDate,
} from "$lib/date/navigation";
import { parseRememberedDateRange } from "$lib/date/remembered-date-range";

/**
 * Path + search to open when a list URL has no date range.
 * Explicit `from`/`to` or `range=all` stay as they are.
 * Otherwise the saved range wins, then the current month.
 */
export function loanListDateRangeRedirectSearch(
  url: URL,
  rememberedRaw: string | null | undefined,
  now = new Date(),
): string | null {
  if (isAllTimeDateRange(url)) return null;
  if (url.searchParams.get("from") && url.searchParams.get("to")) return null;

  const next = new URL(url);
  const remembered = parseRememberedDateRange(rememberedRaw);
  if (remembered?.preset === "all-time") {
    next.searchParams.set("range", ALL_TIME_RANGE_PARAM);
    next.searchParams.delete("from");
    next.searchParams.delete("to");
  } else if (remembered?.from && remembered.to) {
    next.searchParams.delete("range");
    next.searchParams.set("from", remembered.from);
    next.searchParams.set("to", remembered.to);
  } else {
    const range = getDateRangeFromPreset(DEFAULT_DATE_PRESET, now);
    next.searchParams.delete("range");
    next.searchParams.set("from", toIsoDate(range.from));
    next.searchParams.set("to", toIsoDate(range.to));
  }

  const target = `${next.pathname}${next.search}`;
  const current = `${url.pathname}${url.search}`;
  return target === current ? null : target;
}

/** Redirect to the saved or default calendar period when `from` / `to` are missing. */
export function ensureLoanListDateRange(
  url: URL,
  rememberedRaw?: string | null,
): void {
  const target = loanListDateRangeRedirectSearch(url, rememberedRaw);
  if (target) redirect(307, target);
}
