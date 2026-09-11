import { z } from "zod";

export const RECEIPT_VERDICTS = [
  "valid",
  "likely_valid",
  "unclear",
  "invalid",
] as const;

export type ReceiptVerdict = (typeof RECEIPT_VERDICTS)[number];

export const receiptExtractedDataSchema = z.object({
  verdict: z.enum(RECEIPT_VERDICTS),
  confidence: z.number().min(0).max(1).nullable(),
  summary: z.string().max(200),
  senderName: z.string().max(200).nullable(),
  senderBank: z.string().max(200).nullable(),
  receiverName: z.string().max(200).nullable(),
  receiverBank: z.string().max(200).nullable(),
  amount: z.number().positive().nullable(),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  referenceNumber: z.string().max(100).nullable(),
  provider: z.enum(["gemini", "groq"]).nullable(),
});

export type ReceiptExtractedData = z.infer<typeof receiptExtractedDataSchema>;

export type ReceiptExtractionResult =
  | { success: true; data: ReceiptExtractedData }
  | { success: false; error: string };
