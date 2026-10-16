import { createHash } from "node:crypto";
import type {
  ReceiptExtractedData,
  ReceiptScanPurpose,
  ReceiptTransaction,
} from "$lib/receipt-extraction-types";
import { manilaToday } from "$lib/receipt-scan/sanity";
import { generateStructured, type ClientDeps } from "./client";
import { aiErrorMessage, isAiGatewayError, type AiErrorCode } from "./errors";
import {
  RECEIPT_EXTRACTION_PROMPT,
  RECEIPT_RESPONSE_SCHEMA,
  receiptModelOutputSchema,
  type ReceiptModelOutput,
} from "./prompts/receipt-extraction";

/** Images the model accepts. HEIC is converted to JPEG in the browser first. */
export const RECEIPT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Decoded size cap — the client compresses to ~1.1 MB of data URL. */
export const MAX_RECEIPT_IMAGE_BYTES = 1_500_000;

export interface ReceiptImage {
  mimeType: string;
  base64: string;
}

export function decodeImageDataUrl(dataUrl: string): ReceiptImage | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl,
  );
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

export function receiptImageHash(image: ReceiptImage): string {
  return createHash("sha256").update(image.base64).digest("hex");
}

export interface ExtractReceiptInput {
  userId: string;
  image: ReceiptImage;
  purpose: ReceiptScanPurpose;
  lenderNames?: string[];
  borrowerName?: string | null;
}

export type ExtractReceiptResult =
  | { success: true; data: ReceiptExtractedData; imageHash: string }
  | { success: false; error: string; code: AiErrorCode };

function toTransaction(
  raw: ReceiptModelOutput["transactions"][number],
): ReceiptTransaction {
  return {
    amount: raw.amount,
    currency: raw.currency,
    date: raw.date,
    time: raw.time,
    status: raw.status,
    referenceNumber: raw.reference_number,
    senderName: raw.sender_name,
    senderBank: raw.sender_bank,
    receiverName: raw.receiver_name,
    receiverBank: raw.receiver_bank,
    fee: raw.fee,
  };
}

/** First successful transfer with an amount, else first with an amount, else first. */
export function pickPrimaryTransaction(
  transactions: ReceiptTransaction[],
): ReceiptTransaction | null {
  return (
    transactions.find((t) => t.status === "successful" && t.amount !== null) ??
    transactions.find((t) => t.status !== "failed" && t.amount !== null) ??
    transactions[0] ??
    null
  );
}

export function toExtractedData(
  output: ReceiptModelOutput,
  provider: "gemini" | "groq" | null,
): ReceiptExtractedData {
  const transactions = output.transactions.map(toTransaction);
  const primary = pickPrimaryTransaction(transactions);
  return {
    schemaVersion: 2,
    verdict: output.verdict,
    confidence: output.confidence,
    summary: output.summary,
    senderName: primary?.senderName ?? null,
    senderBank: primary?.senderBank ?? null,
    receiverName: primary?.receiverName ?? null,
    receiverBank: primary?.receiverBank ?? null,
    amount: primary?.amount ?? null,
    transactionDate: primary?.date ?? null,
    referenceNumber: primary?.referenceNumber ?? null,
    provider,
    transactions,
  };
}

/**
 * Reads a transfer receipt image (one or many transfers) through the AI gateway.
 * Never throws — callers fall back to manual entry on `success: false`.
 */
export async function extractReceipt(
  input: ExtractReceiptInput,
  deps?: ClientDeps,
): Promise<ExtractReceiptResult> {
  const { image } = input;
  if (!RECEIPT_IMAGE_MIME_TYPES.has(image.mimeType)) {
    return {
      success: false,
      code: "unsupported_input",
      error: aiErrorMessage("unsupported_input"),
    };
  }
  const imageHash = receiptImageHash(image);

  try {
    const result = await generateStructured(
      {
        feature: "receipt_extraction",
        prompt: RECEIPT_EXTRACTION_PROMPT,
        promptContext: {
          purpose: input.purpose,
          today: manilaToday(),
          lenderNames: (input.lenderNames ?? []).slice(0, 20),
          borrowerName: input.borrowerName ?? null,
        },
        parts: [
          { type: "text", text: "Read this payment proof image." },
          { type: "image", mimeType: image.mimeType, base64: image.base64 },
        ],
        schema: receiptModelOutputSchema,
        responseSchema: RECEIPT_RESPONSE_SCHEMA,
        userId: input.userId,
        cacheInput: [input.purpose, imageHash],
      },
      deps,
    );
    return {
      success: true,
      data: toExtractedData(result.data, result.provider),
      imageHash,
    };
  } catch (error) {
    const code: AiErrorCode = isAiGatewayError(error)
      ? error.code
      : "provider_error";
    if (!isAiGatewayError(error)) {
      console.error("[ai.receipt_extraction] unexpected", error);
    }
    return { success: false, code, error: aiErrorMessage(code) };
  }
}
