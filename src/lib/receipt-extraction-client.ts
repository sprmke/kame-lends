import type { ReceiptExtractionResult } from "$lib/receipt-extraction-types";

export async function extractReceiptInfo(
  imageDataUrl: string,
): Promise<ReceiptExtractionResult> {
  try {
    const response = await fetch("/api/ai/receipt-extraction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    });
    const result = await response.json().catch(() => null);
    if (!result || typeof result.success !== "boolean") {
      return { success: false, error: "Failed to scan the receipt." };
    }
    return result as ReceiptExtractionResult;
  } catch {
    return { success: false, error: "Failed to scan the receipt." };
  }
}
