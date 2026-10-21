import type { DatePreset } from "$lib/date/navigation";

/** Cookie read by the loans list load when `from` / `to` are missing. */
export const LOAN_LIST_DATE_RANGE_COOKIE = "kl-date-range";

const STORAGE_PREFIX = "kl-date-range:v1:";

const PRESETS = new Set<DatePreset>([
  "week",
  "month",
  "year",
  "all-time",
  "custom",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type RememberedDateRange = {
  preset: DatePreset;
  from: string | null;
  to: string | null;
};

export function rememberedDateRangeStorageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

export function serializeRememberedDateRange(
  value: RememberedDateRange,
): string {
  if (value.preset === "all-time" || !value.from || !value.to)
    return "all-time";
  return `${value.preset}:${value.from}:${value.to}`;
}

export function parseRememberedDateRange(
  raw: string | null | undefined,
): RememberedDateRange | null {
  if (!raw) return null;
  const text = raw.trim();
  if (text === "all-time") {
    return { preset: "all-time", from: null, to: null };
  }
  const [preset, from, to] = text.split(":");
  if (!preset || !PRESETS.has(preset as DatePreset)) return null;
  if (preset === "all-time") {
    return { preset: "all-time", from: null, to: null };
  }
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
    return null;
  }
  return { preset: preset as DatePreset, from, to };
}

export function readRememberedDateRange(
  scope: string,
): RememberedDateRange | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parseRememberedDateRange(
      localStorage.getItem(rememberedDateRangeStorageKey(scope)),
    );
  } catch {
    return null;
  }
}

export function writeRememberedDateRange(
  scope: string,
  value: RememberedDateRange,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      rememberedDateRangeStorageKey(scope),
      serializeRememberedDateRange(value),
    );
  } catch {
    // Private mode can reject storage writes.
  }
  if (scope === "loans") writeLoanListDateRangeCookie(value);
}

function writeLoanListDateRangeCookie(value: RememberedDateRange): void {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(serializeRememberedDateRange(value));
  document.cookie = `${LOAN_LIST_DATE_RANGE_COOKIE}=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
