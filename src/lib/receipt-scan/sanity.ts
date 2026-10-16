import {
  receiptTransactions,
  type ReceiptExtractedData,
  type ReceiptWarning,
} from "$lib/receipt-extraction-types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_DAYS = 1;
const MAX_AGE_DAYS = 180;
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/** Today as YYYY-MM-DD in Asia/Manila (receipts are PH transfers). */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayNumber(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);
}

/**
 * Rule-based checks on an AI reading. Never blocks — the review step shows them
 * so the user can double-check before applying.
 */
export function receiptSanityWarnings(
  data: ReceiptExtractedData,
  today: string = manilaToday(),
): ReceiptWarning[] {
  const warnings: ReceiptWarning[] = [];
  if (data.verdict === "invalid") warnings.push({ code: "invalid_receipt" });
  if (data.verdict === "unclear") warnings.push({ code: "unclear_receipt" });
  if (
    data.confidence !== null &&
    data.confidence < LOW_CONFIDENCE_THRESHOLD &&
    data.verdict !== "invalid"
  ) {
    warnings.push({ code: "low_confidence" });
  }

  const transactions = receiptTransactions(data);
  if (transactions.length === 0 && data.verdict !== "invalid") {
    warnings.push({ code: "missing_amount" });
  }

  const todayDay = dayNumber(today);
  transactions.forEach((transaction, transactionIndex) => {
    const at = { transactionIndex };
    if (transaction.amount === null) {
      warnings.push({ code: "missing_amount", ...at });
    }
    if (transaction.date === null) {
      warnings.push({ code: "missing_date", ...at });
    } else {
      const diff = dayNumber(transaction.date) - todayDay;
      if (diff > MAX_FUTURE_DAYS) warnings.push({ code: "future_date", ...at });
      if (diff < -MAX_AGE_DAYS) warnings.push({ code: "old_date", ...at });
    }
    if (transaction.status === "failed") {
      warnings.push({ code: "failed_transfer", ...at });
    }
    if (transaction.status === "pending") {
      warnings.push({ code: "pending_transfer", ...at });
    }
    if (transaction.currency && transaction.currency !== "PHP") {
      warnings.push({ code: "non_php_currency", ...at });
    }
  });

  return warnings;
}
