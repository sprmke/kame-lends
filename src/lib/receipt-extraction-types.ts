import { z } from "zod";

export const RECEIPT_VERDICTS = [
  "valid",
  "likely_valid",
  "unclear",
  "invalid",
] as const;

export type ReceiptVerdict = (typeof RECEIPT_VERDICTS)[number];

export const RECEIPT_TRANSACTION_STATUSES = [
  "successful",
  "pending",
  "failed",
  "unknown",
] as const;

export type ReceiptTransactionStatus =
  (typeof RECEIPT_TRANSACTION_STATUSES)[number];

/** Why the scan was run — decides which side of the transfer is the lender. */
export const RECEIPT_SCAN_PURPOSES = [
  "loan_funding",
  "fund_transfer",
  "received_payment",
] as const;

export type ReceiptScanPurpose = (typeof RECEIPT_SCAN_PURPOSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** One transfer visible in an image. A history screenshot can hold several. */
export const receiptTransactionSchema = z.object({
  amount: z.number().positive().nullable(),
  currency: z.string().max(8).nullable(),
  date: isoDate.nullable(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  status: z.enum(RECEIPT_TRANSACTION_STATUSES),
  referenceNumber: z.string().max(100).nullable(),
  senderName: z.string().max(200).nullable(),
  senderBank: z.string().max(200).nullable(),
  receiverName: z.string().max(200).nullable(),
  receiverBank: z.string().max(200).nullable(),
  fee: z.number().nonnegative().nullable(),
});

export type ReceiptTransaction = z.infer<typeof receiptTransactionSchema>;

/**
 * Stored on `receipts[].extractedData`. Top-level fields mirror the primary
 * transaction so v1 rows (no `schemaVersion` / `transactions`) still parse.
 */
export const receiptExtractedDataSchema = z.object({
  schemaVersion: z.literal(2).optional(),
  verdict: z.enum(RECEIPT_VERDICTS),
  confidence: z.number().min(0).max(1).nullable(),
  summary: z.string().max(200),
  senderName: z.string().max(200).nullable(),
  senderBank: z.string().max(200).nullable(),
  receiverName: z.string().max(200).nullable(),
  receiverBank: z.string().max(200).nullable(),
  amount: z.number().positive().nullable(),
  transactionDate: isoDate.nullable(),
  referenceNumber: z.string().max(100).nullable(),
  provider: z.enum(["gemini", "groq"]).nullable(),
  transactions: z.array(receiptTransactionSchema).max(20).optional(),
});

export type ReceiptExtractedData = z.infer<typeof receiptExtractedDataSchema>;

export const RECEIPT_WARNING_CODES = [
  "invalid_receipt",
  "unclear_receipt",
  "low_confidence",
  "missing_amount",
  "missing_date",
  "future_date",
  "old_date",
  "failed_transfer",
  "pending_transfer",
  "non_php_currency",
  "already_recorded",
] as const;

export type ReceiptWarningCode = (typeof RECEIPT_WARNING_CODES)[number];

export interface ReceiptWarning {
  code: ReceiptWarningCode;
  /** Transaction index inside `transactions`, when the warning is about one transfer. */
  transactionIndex?: number;
  /** Extra detail, e.g. the loan name for `already_recorded`. */
  detail?: string;
  /** Loan id for `already_recorded`. */
  loanId?: number;
  referenceNumber?: string;
}

export type ReceiptExtractionResult =
  | {
      success: true;
      data: ReceiptExtractedData;
      warnings: ReceiptWarning[];
      imageHash: string | null;
    }
  | { success: false; error: string; code?: string };

/** v1 rows have no `transactions`; synthesize one from the top-level fields. */
export function receiptTransactions(
  data: ReceiptExtractedData | null | undefined,
): ReceiptTransaction[] {
  if (!data) return [];
  if (data.transactions && data.transactions.length > 0) {
    return data.transactions;
  }
  if (!data.amount && !data.transactionDate && !data.referenceNumber) {
    return [];
  }
  return [
    {
      amount: data.amount,
      currency: "PHP",
      date: data.transactionDate,
      time: null,
      status: "unknown",
      referenceNumber: data.referenceNumber,
      senderName: data.senderName,
      senderBank: data.senderBank,
      receiverName: data.receiverName,
      receiverBank: data.receiverBank,
      fee: null,
    },
  ];
}
