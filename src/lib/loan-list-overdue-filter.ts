import { ALL_TIME_RANGE_PARAM } from "$lib/date/navigation";
import { toLoanDueDayKey } from "$lib/loan-due-date";

/** Inclusive YYYY-MM-DD range covering every loan due date in the set. */
export function dueDateRangeEnclosingLoans(
  loans: readonly { dueDate: Date | string }[],
): { from: string; to: string } | null {
  if (loans.length === 0) return null;
  let from = toLoanDueDayKey(loans[0]!.dueDate);
  let to = from;
  for (let i = 1; i < loans.length; i += 1) {
    const key = toLoanDueDayKey(loans[i]!.dueDate);
    if (key < from) from = key;
    if (key > to) to = key;
  }
  return { from, to };
}

/** Sets status=Overdue and a due-date range that includes every listed loan. */
export function applyOverdueLoansListFilters(
  url: URL,
  loans: readonly { dueDate: Date | string }[],
  extras?: { tab?: string; view?: string },
): void {
  if (extras?.tab) url.searchParams.set("tab", extras.tab);
  if (extras?.view) url.searchParams.set("view", extras.view);

  url.searchParams.delete("status");
  url.searchParams.append("status", "Overdue");

  url.searchParams.delete("range");
  url.searchParams.delete("from");
  url.searchParams.delete("to");

  const range = dueDateRangeEnclosingLoans(loans);
  if (range) {
    url.searchParams.set("from", range.from);
    url.searchParams.set("to", range.to);
  } else {
    url.searchParams.set("range", ALL_TIME_RANGE_PARAM);
  }
}

export function overdueLoansListHref(
  base: URL | string,
  loans: readonly { dueDate: Date | string }[],
  extras?: { tab?: string; view?: string },
): string {
  const url =
    typeof base === "string" ? new URL(base, "https://local") : new URL(base);
  applyOverdueLoansListFilters(url, loans, extras);
  return `${url.pathname}${url.search}${url.hash}`;
}
