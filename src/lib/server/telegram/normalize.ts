const UNICODE_MINUS = "\u2212";

/** Normalize Telegram chat IDs (handles U+2212 minus from copied IDs). */
export function normalizeTelegramChatId(
  raw: string | number | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().replaceAll(UNICODE_MINUS, "-");
  if (!text) return null;
  return text;
}
