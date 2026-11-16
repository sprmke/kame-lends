import { describe, expect, it } from "vitest";
import {
  NO_RECEIPT_NOTE,
  NO_RECEIPT_PLACEHOLDER_DATA_URL,
} from "./no-receipt-placeholder";
import { hasPaymentReceipt, MAX_PAYMENT_RECEIPTS } from "./payment-receipts";
import { imagePreviewSrc } from "./storage-reference";

describe("no-receipt placeholder", () => {
  it("is a valid PNG data URL the receipt viewer accepts", () => {
    expect(
      NO_RECEIPT_PLACEHOLDER_DATA_URL.startsWith("data:image/png;base64,"),
    ).toBe(true);
    expect(NO_RECEIPT_PLACEHOLDER_DATA_URL.length).toBeLessThan(1_100_000);
    expect(imagePreviewSrc(NO_RECEIPT_PLACEHOLDER_DATA_URL)).toBe(
      NO_RECEIPT_PLACEHOLDER_DATA_URL,
    );
  });

  it("counts as a receipt so the row is not blocked on edit", () => {
    expect(
      hasPaymentReceipt({
        receiptImageUrl: NO_RECEIPT_PLACEHOLDER_DATA_URL,
      }),
    ).toBe(true);
    expect(MAX_PAYMENT_RECEIPTS).toBeGreaterThan(0);
  });

  it("uses an explicit note", () => {
    expect(NO_RECEIPT_NOTE.toLowerCase()).toContain("no receipt");
  });
});
