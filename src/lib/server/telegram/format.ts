import { formatCalendarCurrency } from "$lib/calendar-events";
import { formatCurrency } from "$lib/format";
import type { LoanGoogleEventType } from "$lib/calendar-events";

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatTelegramMoney(
  amount: number,
  includeAmounts: boolean,
): string {
  if (!includeAmounts) return "—";
  return formatCalendarCurrency(amount);
}

/** Short date label from YYYY-MM-DD (Manila calendar day). */
export function formatTelegramDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTelegramCurrencyLine(
  amount: number,
  includeAmounts: boolean,
): string {
  if (!includeAmounts) return "";
  const formatted = formatCurrency(amount);
  return ` (${formatted})`;
}

const EVENT_EMOJI: Record<LoanGoogleEventType, string> = {
  sent: "🔴",
  due: "🟢",
  interest_due: "🔵",
};

export function eventTypeEmoji(type: LoanGoogleEventType): string {
  return EVENT_EMOJI[type];
}

export function eventTypeLabel(type: LoanGoogleEventType): string {
  if (type === "sent") return "Disbursement";
  if (type === "due") return "Due";
  return "Interest due";
}

export function groupDeepLink(appUrl: string, groupId: number): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/groups/${groupId}`;
}

export function loanDeepLink(appUrl: string, loanId: number): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/loans/${loanId}`;
}

export function appendDeepLink(
  html: string,
  url: string,
  label = "Open in app",
): string {
  return `${html}\n\n<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}
