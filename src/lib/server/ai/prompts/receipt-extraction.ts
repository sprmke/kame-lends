import { z } from "zod";
import {
  RECEIPT_TRANSACTION_STATUSES,
  RECEIPT_VERDICTS,
  type ReceiptScanPurpose,
  type ReceiptTransactionStatus,
} from "$lib/receipt-extraction-types";
import { DOCUMENT_INJECTION_RULE, definePrompt } from "../prompt";

export interface ReceiptPromptContext {
  purpose: ReceiptScanPurpose;
  /** Today in Asia/Manila (YYYY-MM-DD) — anchors year inference. */
  today: string;
  lenderNames: string[];
  borrowerName: string | null;
}

const PURPOSE_HINT: Record<ReceiptScanPurpose, string> = {
  loan_funding:
    "These receipts show lenders (investors) sending loan principal to the borrower. The lender is usually the SENDER.",
  fund_transfer:
    "These receipts show lenders (investors) sending additional loan principal to the borrower. The lender is usually the SENDER.",
  received_payment:
    "These receipts show the borrower repaying lenders. The lender is usually the RECEIVER.",
};

function knownParties(ctx: ReceiptPromptContext): string {
  const lines: string[] = [];
  if (ctx.lenderNames.length > 0) {
    lines.push(`Known lenders: ${ctx.lenderNames.join("; ")}`);
  }
  if (ctx.borrowerName) lines.push(`Known borrower: ${ctx.borrowerName}`);
  return lines.length > 0
    ? `${lines.join("\n")}\nUse these only to read masked or abbreviated names correctly. Copy names as they appear on the receipt; do not invent a name that is not visible.`
    : "";
}

export const RECEIPT_EXTRACTION_PROMPT = definePrompt<ReceiptPromptContext>({
  id: "receipt_extraction",
  version: "2026-10-17.1",
  build: (ctx) =>
    [
      `You read payment proof images for a private lending app in the Philippines. Today is ${ctx.today}.`,
      PURPOSE_HINT[ctx.purpose],
      knownParties(ctx),
      `Accept digital transfer screenshots (GCash, Maya, InstaPay, PESONet, bank apps, bank-to-bank) and clear photos of PHP cash bills. This is money moving between people, not a store purchase.`,
      `Return ONLY a JSON object:
{
  "verdict": "valid" | "likely_valid" | "unclear" | "invalid",
  "confidence": number 0..1,
  "summary": "one short plain-English sentence, max 120 characters",
  "transactions": [
    {
      "amount": number | null,          // PHP amount actually transferred
      "currency": "PHP" | other ISO code | null,
      "date": "YYYY-MM-DD" | null,
      "time": "HH:MM" (24h) | null,
      "status": "successful" | "pending" | "failed" | "unknown",
      "reference_number": string | null,
      "sender_name": string | null,
      "sender_bank": string | null,
      "receiver_name": string | null,
      "receiver_bank": string | null,
      "fee": number | null
    }
  ]
}`,
      `Rules:
- One entry per distinct transfer. A single receipt is one entry. A transaction-history screenshot lists every visible transfer as its own entry, in the order shown.
- amount: the principal transferred. Never use fees, running balances, available balance, or totals of several transfers.
- fee: transfer fee if shown separately, else null.
- date: normalize to YYYY-MM-DD. If the year is missing, use the most recent year that is not after today.
- status: "failed" for failed/reversed/cancelled transfers, "pending" for processing; "successful" when the receipt says successful/sent/completed or it is a normal confirmation; else "unknown".
- sender_* = where money came FROM; receiver_* = where it went TO. Keep masked names as shown (e.g. "JU** DE** C."). Bank or wallet name in *_bank (e.g. "GCash", "BDO").
- Cash photos: one entry with the visible total; names and banks null; date null unless printed.
- verdict: "valid" = clear proof with amount and date; "likely_valid" = recognizable but partly blurry or cropped; "unclear" = cannot tell; "invalid" = not payment proof (unrelated photo, blank, chat without a transfer). For "invalid", transactions may be [].
- summary: no line breaks, no account numbers.`,
      DOCUMENT_INJECTION_RULE,
    ]
      .filter(Boolean)
      .join("\n\n"),
});

/** Gemini responseSchema (OpenAPI subset). */
export const RECEIPT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: [...RECEIPT_VERDICTS] },
    confidence: { type: "NUMBER" },
    summary: { type: "STRING" },
    transactions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          amount: { type: "NUMBER", nullable: true },
          currency: { type: "STRING", nullable: true },
          date: { type: "STRING", nullable: true },
          time: { type: "STRING", nullable: true },
          status: { type: "STRING", enum: [...RECEIPT_TRANSACTION_STATUSES] },
          reference_number: { type: "STRING", nullable: true },
          sender_name: { type: "STRING", nullable: true },
          sender_bank: { type: "STRING", nullable: true },
          receiver_name: { type: "STRING", nullable: true },
          receiver_bank: { type: "STRING", nullable: true },
          fee: { type: "NUMBER", nullable: true },
        },
        required: ["amount", "date", "status"],
      },
    },
  },
  required: ["verdict", "confidence", "summary", "transactions"],
};

function parseMoney(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0
      ? Math.round(value * 100) / 100
      : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.round(parsed * 100) / 100
      : null;
  }
  return null;
}

/** Non-string values become null; strings go through `read`. */
function stringField<T>(read: (value: string) => T | null) {
  return z
    .unknown()
    .optional()
    .transform((value) => (typeof value === "string" ? read(value) : null));
}

function cleanText(max: number) {
  return stringField((value) => {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed || /^(null|n\/a|none|unknown)$/i.test(trimmed)) return null;
    return trimmed.slice(0, max);
  });
}

const isoDate = stringField((value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[0]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== match[0]
    ? null
    : match[0];
});

const clockTime = stringField((value) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60
    ? `${String(hours).padStart(2, "0")}:${match[2]}`
    : null;
});

const status = z
  .unknown()
  .optional()
  .transform((value): ReceiptTransactionStatus => {
    const normalized = typeof value === "string" ? value.toLowerCase() : "";
    return (RECEIPT_TRANSACTION_STATUSES as readonly string[]).includes(
      normalized,
    )
      ? (normalized as ReceiptTransactionStatus)
      : "unknown";
  });

const modelTransactionSchema = z.object({
  amount: z.unknown().optional().transform(parseMoney),
  currency: cleanText(8).transform((value) => value?.toUpperCase() ?? null),
  date: isoDate,
  time: clockTime,
  status,
  reference_number: cleanText(100).transform(
    (value) => value?.replace(/\s+/g, "") ?? null,
  ),
  sender_name: cleanText(200),
  sender_bank: cleanText(200),
  receiver_name: cleanText(200),
  receiver_bank: cleanText(200),
  fee: z
    .unknown()
    .optional()
    .transform((value) => (value === 0 ? 0 : parseMoney(value))),
});

/**
 * Validates the model reply. Field values are coerced leniently; structural problems
 * (no object, wrong verdict, no transactions array) fail and trigger the repair retry.
 */
export const receiptModelOutputSchema = z.object({
  verdict: z.enum(RECEIPT_VERDICTS),
  confidence: z
    .unknown()
    .optional()
    .transform((value) =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : null,
    ),
  summary: z
    .unknown()
    .optional()
    .transform((value) =>
      typeof value === "string" && value.trim()
        ? value.replace(/\s+/g, " ").trim().slice(0, 200)
        : "Receipt scanned.",
    ),
  // Long history screenshots: keep the first 20 transfers instead of failing.
  transactions: z
    .array(modelTransactionSchema)
    .transform((list) => list.slice(0, 20)),
});

export type ReceiptModelOutput = z.infer<typeof receiptModelOutputSchema>;
