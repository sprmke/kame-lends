import { redirect } from "@sveltejs/kit";
import {
  DEFAULT_DATE_PRESET,
  getDateRangeFromPreset,
  isAllTimeDateRange,
  toIsoDate,
} from "$lib/date/navigation";

/** Redirect to the default calendar period when `from` / `to` are missing. */
export function ensureLoanListDateRange(url: URL): void {
  if (isAllTimeDateRange(url)) return;

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to) return;

  const next = new URL(url);
  const range = getDateRangeFromPreset(DEFAULT_DATE_PRESET, new Date());
  next.searchParams.set("from", toIsoDate(range.from));
  next.searchParams.set("to", toIsoDate(range.to));
  redirect(307, `${next.pathname}${next.search}`);
}
