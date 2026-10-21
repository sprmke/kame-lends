import type { ReceiptExtractedData } from "$lib/receipt-extraction-types";
import { receiptExtractedDataSchema } from "$lib/receipt-extraction-types";
import { normalizeReceiptImageUrl } from "$lib/receipt-image";
import { isStorageRef } from "$lib/storage-reference";

export const MAX_PAYMENT_RECEIPTS = 10;

export type PaymentReceipt = {
  imageUrl: string;
  extractedData: ReceiptExtractedData | null;
};

export type ReceiptInput = {
  receipts?: unknown;
  receiptImageUrl?: unknown;
  receiptExtractedData?: unknown;
};

export type ReceiptColumns = {
  receipts: PaymentReceipt[];
  receiptImageUrl: string | null;
  receiptExtractedData: ReceiptExtractedData | null;
};

function parseExtractedData(value: unknown): ReceiptExtractedData | null {
  const parsed = receiptExtractedDataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseReceipt(value: unknown): PaymentReceipt | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { imageUrl?: unknown; extractedData?: unknown };
  const imageUrl = normalizeReceiptImageUrl(record.imageUrl);
  if (!imageUrl) return null;
  return {
    imageUrl,
    extractedData: parseExtractedData(record.extractedData),
  };
}

export function normalizePaymentReceipts(
  input: ReceiptInput,
): PaymentReceipt[] {
  const fromArray = Array.isArray(input.receipts)
    ? input.receipts
        .map((item) => parseReceipt(item))
        .filter((item): item is PaymentReceipt => item !== null)
    : [];

  const seen = new Set(fromArray.map((item) => item.imageUrl));
  const legacyUrl = normalizeReceiptImageUrl(input.receiptImageUrl);
  if (legacyUrl && !seen.has(legacyUrl)) {
    fromArray.unshift({
      imageUrl: legacyUrl,
      extractedData: parseExtractedData(input.receiptExtractedData),
    });
  }

  return fromArray.slice(0, MAX_PAYMENT_RECEIPTS);
}

export function receiptColumnsFromInput(input: ReceiptInput): ReceiptColumns {
  const receipts = normalizePaymentReceipts(input);
  const first = receipts[0];
  return {
    receipts,
    receiptImageUrl: first?.imageUrl ?? null,
    receiptExtractedData: first?.extractedData ?? null,
  };
}

/** Drops repeated images (same `imageUrl`), keeping the first occurrence. */
export function uniqueReceipts(receipts: PaymentReceipt[]): PaymentReceipt[] {
  const seen = new Set<string>();
  return receipts.filter((receipt) => {
    if (seen.has(receipt.imageUrl)) return false;
    seen.add(receipt.imageUrl);
    return true;
  });
}

export function receiptsContainStorageRef(
  input: ReceiptInput,
  ref: string,
): boolean {
  if (!isStorageRef(ref)) return false;
  return normalizePaymentReceipts(input).some((item) => item.imageUrl === ref);
}

export const RECEIPT_REQUIRED_ERROR = "Upload a receipt.";

export function hasPaymentReceipt(
  input: ReceiptInput | null | undefined,
): boolean {
  if (!input || typeof input !== "object") return false;
  return normalizePaymentReceipts(input).length > 0;
}

function isPositiveAmount(amount: unknown): boolean {
  const parsed =
    typeof amount === "number"
      ? amount
      : Number.parseFloat(String(amount ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0;
}

/** Principal rows on create and edit. Null when every row has a receipt. */
export function disbursementReceiptError(investorData: unknown): string | null {
  if (!Array.isArray(investorData)) return null;
  const missing = investorData.some(
    (row) => !hasPaymentReceipt(row as ReceiptInput),
  );
  return missing ? "Upload a receipt for each principal disbursement." : null;
}

/**
 * Received-payment rows with an amount. Blank rows are ignored.
 * Create and edit both require a receipt once the amount is positive.
 */
export function receivedPaymentReceiptError(entries: unknown): string | null {
  if (!Array.isArray(entries)) return null;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const payments = (entry as { receivedPayments?: unknown }).receivedPayments;
    if (!Array.isArray(payments)) continue;
    for (const payment of payments) {
      if (!payment || typeof payment !== "object") continue;
      const row = payment as ReceiptInput & { amount?: unknown };
      if (!isPositiveAmount(row.amount)) continue;
      if (!hasPaymentReceipt(row)) {
        return "Upload a receipt for each received payment.";
      }
    }
  }
  return null;
}
