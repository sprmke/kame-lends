import { describe, expect, it } from "vitest";
import type { PaymentReceipt } from "$lib/payment-receipts";
import type { ReceiptExtractedData } from "$lib/receipt-extraction-types";
import type { ProposedTransaction } from "./group-transactions";
import {
  addProposalsToRows,
  mergeRowWithPrevious,
  splitRowAt,
  type RowAdapter,
  type RowScanMeta,
} from "./rows";

/** Mirrors a loan-form transaction: own date field name + extra interest fields. */
interface TxRow {
  id: string;
  amount: string;
  sentDate: string;
  interestRate: string;
  receipts: PaymentReceipt[];
  scan: RowScanMeta | null;
}

let created = 0;
const adapter: RowAdapter<TxRow> = {
  getId: (row) => row.id,
  read: (row) => ({
    investorId: 1,
    amount: row.amount,
    date: row.sentDate,
    receipts: row.receipts,
    scan: row.scan,
  }),
  write: (base, fields) => ({
    id: base?.id ?? `new-${++created}`,
    interestRate: base?.interestRate ?? "10",
    amount: fields.amount,
    sentDate: fields.date,
    receipts: fields.receipts,
    scan: fields.scan,
  }),
};

function reading(
  amount: number,
  date: string,
  ref: string,
): ReceiptExtractedData {
  return {
    verdict: "valid",
    confidence: 0.9,
    summary: ref,
    senderName: null,
    senderBank: null,
    receiverName: null,
    receiverBank: null,
    amount,
    transactionDate: date,
    referenceNumber: ref,
    provider: "gemini",
  };
}

const receipt = (name: string, data: ReceiptExtractedData | null = null) => ({
  imageUrl: `storage:${name}`,
  extractedData: data,
});

function proposal(
  amount: string,
  date: string,
  receipts: PaymentReceipt[],
): ProposedTransaction {
  return {
    id: `p-${amount}`,
    include: true,
    investorId: 1,
    amount,
    date,
    receipts,
    transferCount: receipts.length,
    references: [],
    partyName: null,
    counterpartyName: null,
    warnings: [{ code: "low_confidence" }],
    confidence: 0.5,
    summary: "AI summary",
  };
}

describe("addProposalsToRows", () => {
  it("creates one row per proposal with its receipts and scan notes", () => {
    created = 0;
    const rows = addProposalsToRows<TxRow>(
      [],
      [
        proposal("100", "2026-10-01", [receipt("a")]),
        proposal("250", "2026-10-02", [receipt("b"), receipt("c")]),
      ],
      adapter,
    );
    expect(
      rows.map((r) => [r.id, r.amount, r.sentDate, r.receipts.length]),
    ).toEqual([
      ["new-1", "100", "2026-10-01", 1],
      ["new-2", "250", "2026-10-02", 2],
    ]);
    expect(rows[1].scan).toMatchObject({
      summary: "AI summary",
      transferCount: 2,
      warnings: [{ code: "low_confidence" }],
    });
  });
});

describe("mergeRowWithPrevious / splitRowAt", () => {
  const rows: TxRow[] = [
    {
      id: "r1",
      amount: "100",
      sentDate: "2026-10-01",
      interestRate: "5",
      receipts: [receipt("a", reading(100, "2026-10-01", "A"))],
      scan: null,
    },
    {
      id: "r2",
      amount: "250",
      sentDate: "2026-10-02",
      interestRate: "7",
      receipts: [receipt("b", reading(250, "2026-10-02", "B"))],
      scan: null,
    },
  ];

  it("merges into the row above and keeps that row's other fields", () => {
    const merged = mergeRowWithPrevious(rows, 1, adapter);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "r1",
      interestRate: "5",
      amount: "350",
      sentDate: "2026-10-01",
    });
    expect(merged[0].receipts.map((r) => r.imageUrl)).toEqual([
      "storage:a",
      "storage:b",
    ]);
    expect(mergeRowWithPrevious(rows, 0, adapter)).toBe(rows);
  });

  it("splits a row back into one row per receipt", () => {
    created = 0;
    const merged = mergeRowWithPrevious(rows, 1, adapter);
    const split = splitRowAt(merged, 0, adapter);
    expect(
      split.map((r) => [r.id, r.amount, r.sentDate, r.interestRate]),
    ).toEqual([
      ["r1", "100", "2026-10-01", "5"],
      ["new-1", "250", "2026-10-02", "10"],
    ]);
    expect(splitRowAt(rows, 0, adapter)).toBe(rows);
  });
});
