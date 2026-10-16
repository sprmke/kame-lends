import type {
  ReceiptExtractionResult,
  ReceiptScanPurpose,
} from "$lib/receipt-extraction-types";

/** Ids only — the server resolves names from the owner's CRM for prompt hints. */
export interface ReceiptScanContext {
  purpose: ReceiptScanPurpose;
  loanId?: number;
  investorIds?: number[];
  borrowerId?: number;
}

export async function extractReceiptInfo(
  imageDataUrl: string,
  context?: ReceiptScanContext,
): Promise<ReceiptExtractionResult> {
  try {
    const response = await fetch("/api/ai/receipt-extraction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, context }),
    });
    const result = await response.json().catch(() => null);
    if (!result || typeof result.success !== "boolean") {
      if (response.status === 429) {
        return {
          success: false,
          error: "Too many scans at once. Try again in a minute.",
          code: "rate_limited",
        };
      }
      return { success: false, error: "Failed to scan the receipt." };
    }
    if (result.success && !Array.isArray(result.warnings)) {
      return { ...result, warnings: [], imageHash: result.imageHash ?? null };
    }
    return result as ReceiptExtractionResult;
  } catch {
    return { success: false, error: "Failed to scan the receipt." };
  }
}
