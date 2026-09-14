import { describe, expect, it } from "vitest";
import type { ReceiptExtractedData } from "./receipt-extraction-types";
import {
  MAX_PAYMENT_RECEIPTS,
  normalizePaymentReceipts,
  receiptColumnsFromInput,
  receiptsContainStorageRef,
} from "./payment-receipts";

const JPEG = "data:image/jpeg;base64,/9j/aaaa";
const PNG = "data:image/png;base64,iVBOR";
const REF = "storage:uploads/user/receipt-1.jpg";
const REF_B = "storage:uploads/user/receipt-2.jpg";

const extracted: ReceiptExtractedData = {
  verdict: "valid",
  confidence: 0.9,
  summary: "GCash transfer",
  senderName: "Ada",
  senderBank: "GCash",
  receiverName: "Bob",
  receiverBank: "BDO",
  amount: 1000,
  transactionDate: "2026-09-14",
  referenceNumber: "ABC",
  provider: "gemini",
};

describe("normalizePaymentReceipts", () => {
  it("keeps multiple storage refs and data URLs", () => {
    expect(
      normalizePaymentReceipts({
        receipts: [
          { imageUrl: REF, extractedData: extracted },
          { imageUrl: JPEG, extractedData: null },
        ],
      }),
    ).toEqual([
      { imageUrl: REF, extractedData: extracted },
      { imageUrl: JPEG, extractedData: null },
    ]);
  });

  it("falls back to the legacy single receipt columns", () => {
    expect(
      normalizePaymentReceipts({
        receiptImageUrl: REF,
        receiptExtractedData: extracted,
      }),
    ).toEqual([{ imageUrl: REF, extractedData: extracted }]);
  });

  it("does not duplicate a legacy receipt that is already in receipts", () => {
    expect(
      normalizePaymentReceipts({
        receipts: [{ imageUrl: REF, extractedData: null }],
        receiptImageUrl: REF,
        receiptExtractedData: extracted,
      }),
    ).toEqual([{ imageUrl: REF, extractedData: null }]);
  });

  it("drops invalid urls and caps the list", () => {
    const extras = Array.from({ length: MAX_PAYMENT_RECEIPTS + 3 }, (_, i) => ({
      imageUrl: `storage:uploads/user/r-${i}.jpg`,
      extractedData: null,
    }));
    const result = normalizePaymentReceipts({
      receipts: [
        { imageUrl: "https://example.com/x.jpg", extractedData: null },
        ...extras,
      ],
    });
    expect(result).toHaveLength(MAX_PAYMENT_RECEIPTS);
    expect(result[0]?.imageUrl).toBe("storage:uploads/user/r-0.jpg");
  });
});

describe("receiptColumnsFromInput", () => {
  it("writes receipts plus legacy first-receipt columns for save", () => {
    expect(
      receiptColumnsFromInput({
        receipts: [
          { imageUrl: REF, extractedData: extracted },
          { imageUrl: PNG, extractedData: null },
        ],
      }),
    ).toEqual({
      receipts: [
        { imageUrl: REF, extractedData: extracted },
        { imageUrl: PNG, extractedData: null },
      ],
      receiptImageUrl: REF,
      receiptExtractedData: extracted,
    });
  });

  it("clears legacy columns when there are no receipts", () => {
    expect(receiptColumnsFromInput({})).toEqual({
      receipts: [],
      receiptImageUrl: null,
      receiptExtractedData: null,
    });
  });
});

describe("receiptsContainStorageRef", () => {
  it("matches a ref on either the array or the legacy column", () => {
    expect(
      receiptsContainStorageRef(
        {
          receipts: [{ imageUrl: REF, extractedData: null }],
          receiptImageUrl: REF_B,
        },
        REF,
      ),
    ).toBe(true);
    expect(receiptsContainStorageRef({ receiptImageUrl: REF_B }, REF_B)).toBe(
      true,
    );
    expect(receiptsContainStorageRef({ receipts: [] }, REF)).toBe(false);
  });
});
