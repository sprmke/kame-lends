import { describe, expect, it } from "vitest";
import type { ReceiptExtractedData } from "$lib/receipt-extraction-types";
import { manilaToday, receiptSanityWarnings } from "./sanity";

function data(
  overrides: Partial<ReceiptExtractedData> = {},
): ReceiptExtractedData {
  return {
    verdict: "valid",
    confidence: 0.9,
    summary: "ok",
    senderName: null,
    senderBank: null,
    receiverName: null,
    receiverBank: null,
    amount: 1000,
    transactionDate: "2026-10-10",
    referenceNumber: "R1",
    provider: "gemini",
    ...overrides,
  };
}

const codes = (warnings: { code: string }[]) => warnings.map((w) => w.code);

describe("receiptSanityWarnings", () => {
  it("returns nothing for a clean v1 reading", () => {
    expect(receiptSanityWarnings(data(), "2026-10-17")).toEqual([]);
  });

  it("flags verdicts, confidence, and missing fields", () => {
    expect(
      codes(
        receiptSanityWarnings(
          data({ verdict: "unclear", confidence: 0.3, amount: null }),
          "2026-10-17",
        ),
      ),
    ).toEqual(["unclear_receipt", "low_confidence", "missing_amount"]);
    expect(
      codes(
        receiptSanityWarnings(
          data({
            verdict: "invalid",
            confidence: 0.2,
            amount: null,
            transactionDate: null,
            referenceNumber: null,
          }),
          "2026-10-17",
        ),
      ),
    ).toEqual(["invalid_receipt"]);
  });

  it("checks each transaction in a v2 reading", () => {
    const warnings = receiptSanityWarnings(
      data({
        schemaVersion: 2,
        transactions: [
          {
            amount: 500,
            currency: "USD",
            date: "2026-10-20",
            time: null,
            status: "failed",
            referenceNumber: null,
            senderName: null,
            senderBank: null,
            receiverName: null,
            receiverBank: null,
            fee: null,
          },
          {
            amount: 700,
            currency: "PHP",
            date: "2026-01-01",
            time: null,
            status: "pending",
            referenceNumber: null,
            senderName: null,
            senderBank: null,
            receiverName: null,
            receiverBank: null,
            fee: null,
          },
        ],
      }),
      "2026-10-17",
    );
    expect(warnings).toEqual([
      { code: "future_date", transactionIndex: 0 },
      { code: "failed_transfer", transactionIndex: 0 },
      { code: "non_php_currency", transactionIndex: 0 },
      { code: "old_date", transactionIndex: 1 },
      { code: "pending_transfer", transactionIndex: 1 },
    ]);
  });
});

describe("manilaToday", () => {
  it("uses the Manila calendar day", () => {
    expect(manilaToday(new Date("2026-10-16T17:30:00Z"))).toBe("2026-10-17");
  });
});
