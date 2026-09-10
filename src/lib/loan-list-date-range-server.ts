import { redirect } from "@sveltejs/kit";
import {
  getDateRangeFromPreset,
  isAllTimeDateRange,
  toIsoDate,
} from "$lib/date/navigation";

/** Redirect to the current calendar month when `from` / `to` are missing. */
export function ensureLoanListDateRange(url: URL): void {
  if (isAllTimeDateRange(url)) return;

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to) return;

  const next = new URL(url);
  const range = getDateRangeFromPreset("month", new Date());
  next.searchParams.set("from", toIsoDate(range.from));
  next.searchParams.set("to", toIsoDate(range.to));
  redirect(307, `${next.pathname}${next.search}`);
}
