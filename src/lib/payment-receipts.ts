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

export function receiptsContainStorageRef(
  input: ReceiptInput,
  ref: string,
): boolean {
  if (!isStorageRef(ref)) return false;
  return normalizePaymentReceipts(input).some((item) => item.imageUrl === ref);
}
