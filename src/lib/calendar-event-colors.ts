/** Google Calendar event `colorId` values (legacy workspace sync). */

export type GoogleCalendarLoanEventKind =
  "sent" | "due" | "interest_due" | "summary";

const COLOR_BY_KIND: Record<GoogleCalendarLoanEventKind, string> = {
  sent: "11",
  due: "2",
  interest_due: "7",
  summary: "8",
};

export function googleCalendarColorIdForKind(
  kind: GoogleCalendarLoanEventKind,
): string {
  return COLOR_BY_KIND[kind];
}

export function kindFromKameKey(
  kameKey: string | null | undefined,
): GoogleCalendarLoanEventKind | null {
  if (!kameKey) return null;
  if (kameKey.startsWith("summary-")) return "summary";
  const match = /^loan-\d+-(sent|due|interest_due)-/.exec(kameKey);
  if (!match) return null;
  return match[1] as GoogleCalendarLoanEventKind;
}

export function kindFromEventSummary(
  summary: string | null | undefined,
): GoogleCalendarLoanEventKind | null {
  if (!summary) return null;
  if (
    summary.startsWith("Total Summary") ||
    summary.startsWith("Daily Summary")
  ) {
    return "summary";
  }
  if (summary.includes(" - Disbursement")) return "sent";
  if (summary.includes(" - Interest Due")) return "interest_due";
  if (summary.includes(" - Due Date")) return "due";
  return null;
}

function isLoanEventKind(value: string): value is GoogleCalendarLoanEventKind {
  return (
    value === "sent" ||
    value === "due" ||
    value === "interest_due" ||
    value === "summary"
  );
}

export function resolveGoogleCalendarEventKind(input: {
  kameKey?: string | null;
  kameKind?: string | null;
  summary?: string | null;
}): GoogleCalendarLoanEventKind | null {
  const fromKey = kindFromKameKey(input.kameKey);
  if (fromKey) return fromKey;
  if (input.kameKind && isLoanEventKind(input.kameKind)) return input.kameKind;
  return kindFromEventSummary(input.summary);
}
