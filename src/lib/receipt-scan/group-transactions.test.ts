import { describe, expect, it } from "vitest";
import type {
  ReceiptExtractedData,
  ReceiptTransaction,
} from "$lib/receipt-extraction-types";
import {
  groupScannedReceipts,
  mergeProposals,
  splitProposal,
  type ScannedReceipt,
} from "./group-transactions";

const lenders = [
  { id: 1, name: "Juan Dela Cruz" },
  { id: 2, name: "Maria Santos" },
];

function tx(overrides: Partial<ReceiptTransaction>): ReceiptTransaction {
  return {
    amount: 1000,
    currency: "PHP",
    date: "2026-10-01",
    time: null,
    status: "successful",
    referenceNumber: null,
    senderName: null,
    senderBank: null,
    receiverName: null,
    receiverBank: null,
    fee: null,
    ...overrides,
  };
}

function data(transactions: ReceiptTransaction[]): ReceiptExtractedData {
  const first = transactions[0];
  return {
    schemaVersion: 2,
    verdict: "valid",
    confidence: 0.9,
    summary: "ok",
    senderName: first?.senderName ?? null,
    senderBank: null,
    receiverName: first?.receiverName ?? null,
    receiverBank: null,
    amount: first?.amount ?? null,
    transactionDate: first?.date ?? null,
    referenceNumber: first?.referenceNumber ?? null,
    provider: "gemini",
    transactions,
  };
}

let n = 0;
function scanned(
  transactions: ReceiptTransaction[] | null,
  overrides: Partial<ScannedReceipt> = {},
): ScannedReceipt {
  n += 1;
  return {
    id: `s${n}`,
    fileName: `r${n}.jpg`,
    receipt: { imageUrl: `storage:r${n}`, extractedData: null },
    extracted: transactions ? data(transactions) : null,
    warnings: [],
    imageHash: `hash${n}`,
    error: transactions ? null : "Couldn't read this receipt",
    ...overrides,
  };
}

describe("groupScannedReceipts", () => {
  it("splits different dates into separate transactions and sorts by date", () => {
    const result = groupScannedReceipts(
      [
        scanned([
          tx({ date: "2026-10-05", amount: 500, senderName: "Juan Dela Cruz" }),
        ]),
        scanned([
          tx({ date: "2026-10-02", amount: 300, senderName: "Juan Dela Cruz" }),
        ]),
      ],
      { purpose: "fund_transfer", lenders },
    );
    expect(
      result.proposals.map((p) => [p.date, p.amount, p.investorId]),
    ).toEqual([
      ["2026-10-02", "300", 1],
      ["2026-10-05", "500", 1],
    ]);
  });

  it("merges the same date and lender into one row with all receipts", () => {
    const result = groupScannedReceipts(
      [
        scanned([
          tx({
            amount: 1000.1,
            referenceNumber: "A1",
            senderName: "JU** DE** C.",
          }),
        ]),
        scanned([
          tx({
            amount: 2000.2,
            referenceNumber: "A2",
            senderName: "Juan Dela Cruz",
          }),
        ]),
        scanned([
          tx({ amount: 50, referenceNumber: "B1", senderName: "Maria Santos" }),
        ]),
      ],
      { purpose: "fund_transfer", lenders },
    );
    expect(result.proposals).toHaveLength(2);
    const juan = result.proposals.find((p) => p.investorId === 1)!;
    expect(juan).toMatchObject({
      amount: "3000.3",
      transferCount: 2,
      references: ["A1", "A2"],
    });
    expect(juan.receipts).toHaveLength(2);
  });

  it("matches the receiver as the lender for received payments", () => {
    const result = groupScannedReceipts(
      [
        scanned([
          tx({ senderName: "Juan Dela Cruz", receiverName: "Maria Santos" }),
        ]),
      ],
      { purpose: "received_payment", lenders },
    );
    expect(result.proposals[0]).toMatchObject({
      investorId: 2,
      partyName: "Maria Santos",
    });
  });

  it("splits a transaction-history image into one row per date", () => {
    const result = groupScannedReceipts(
      [
        scanned([
          tx({ date: "2026-10-01", amount: 100, referenceNumber: "H1" }),
          tx({ date: "2026-10-03", amount: 200, referenceNumber: "H2" }),
          tx({ date: "2026-10-04", amount: 300, status: "failed" }),
        ]),
      ],
      { purpose: "fund_transfer", lenders, defaultInvestorId: 2 },
    );
    expect(
      result.proposals.map((p) => [p.date, p.amount, p.investorId]),
    ).toEqual([
      ["2026-10-01", "100", 2],
      ["2026-10-03", "200", 2],
    ]);
    expect(result.failedTransferCount).toBe(1);
    expect(result.proposals[0].receipts).toEqual(result.proposals[1].receipts);
  });

  it("dedupes the same image and the same reference number", () => {
    const first = scanned([tx({ referenceNumber: "REF 1" })]);
    const sameImage = scanned([tx({ referenceNumber: "REF 1" })], {
      imageHash: first.imageHash,
    });
    const otherShot = scanned([tx({ referenceNumber: "ref1" })]);
    const result = groupScannedReceipts([first, sameImage, otherShot], {
      purpose: "fund_transfer",
      lenders,
      defaultInvestorId: 1,
    });
    expect(result.duplicateCount).toBe(2);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].amount).toBe("1000");
    expect(result.proposals[0].receipts.map((r) => r.imageUrl)).toEqual([
      first.receipt!.imageUrl,
      otherShot.receipt!.imageUrl,
    ]);
  });

  it("keeps failed scans as editable rows with the image attached", () => {
    const failed = scanned(null);
    const result = groupScannedReceipts([failed], {
      purpose: "fund_transfer",
      lenders: [lenders[0]],
    });
    expect(result.scanErrorCount).toBe(1);
    expect(result.proposals[0]).toMatchObject({
      include: true,
      investorId: 1,
      amount: "",
      date: "",
      receipts: [failed.receipt],
    });
    expect(result.proposals[0].warnings[0].code).toBe("scan_failed");
  });

  it("starts invalid images and references already on this loan unchecked", () => {
    const invalid = scanned([]);
    invalid.extracted!.verdict = "invalid";
    const recorded = scanned([tx({ referenceNumber: "OLD1" })], {
      warnings: [
        {
          code: "already_recorded",
          loanId: 9,
          detail: "Loan A",
          referenceNumber: "OLD1",
        },
      ],
    });
    const elsewhere = scanned(
      [tx({ referenceNumber: "OLD2", date: "2026-10-09" })],
      {
        warnings: [
          {
            code: "already_recorded",
            loanId: 4,
            detail: "Loan B",
            referenceNumber: "OLD2",
          },
        ],
      },
    );
    const result = groupScannedReceipts([invalid, recorded, elsewhere], {
      purpose: "fund_transfer",
      lenders,
      defaultInvestorId: 1,
      currentLoanId: 9,
    });
    const byRef = (ref: string) =>
      result.proposals.find((p) => p.references.includes(ref))!;
    expect(byRef("OLD1").include).toBe(false);
    expect(byRef("OLD2").include).toBe(true);
    expect(byRef("OLD2").warnings).toEqual([
      { code: "already_recorded", loanId: 4, detail: "Loan B" },
    ]);
    expect(
      result.proposals.find((p) => p.references.length === 0)!.include,
    ).toBe(false);
  });

  it("flags an unmatched lender when several lenders exist", () => {
    const result = groupScannedReceipts(
      [scanned([tx({ senderName: "Pedro Penduko" })])],
      { purpose: "fund_transfer", lenders },
    );
    expect(result.proposals[0].investorId).toBeNull();
    expect(result.proposals[0].warnings).toContainEqual({
      code: "lender_not_matched",
      detail: "Pedro Penduko",
    });
  });

  it("attaches per-transaction warnings to the right row", () => {
    const item = scanned(
      [
        tx({ date: "2026-10-01", referenceNumber: "X1" }),
        tx({ date: "2026-12-01", referenceNumber: "X2" }),
      ],
      {
        warnings: [
          { code: "future_date", transactionIndex: 1 },
          { code: "low_confidence" },
        ],
      },
    );
    const result = groupScannedReceipts([item], {
      purpose: "fund_transfer",
      lenders,
      defaultInvestorId: 1,
    });
    expect(result.proposals[0].warnings.map((w) => w.code)).toEqual([
      "low_confidence",
    ]);
    expect(result.proposals[1].warnings.map((w) => w.code)).toEqual([
      "future_date",
      "low_confidence",
    ]);
  });
});

describe("mergeProposals / splitProposal", () => {
  it("merges then splits back into one row per receipt", () => {
    const { proposals } = groupScannedReceipts(
      [
        scanned([
          tx({ date: "2026-10-01", amount: 100, referenceNumber: "M1" }),
        ]),
        scanned([
          tx({ date: "2026-10-02", amount: 250, referenceNumber: "M2" }),
        ]),
      ],
      { purpose: "fund_transfer", lenders, defaultInvestorId: 1 },
    );
    // Receipts in tests carry no extractedData; give them some for the split.
    proposals[0].receipts[0].extractedData = data([
      tx({ date: "2026-10-01", amount: 100, referenceNumber: "M1" }),
    ]);
    proposals[1].receipts[0].extractedData = data([
      tx({ date: "2026-10-02", amount: 250, referenceNumber: "M2" }),
    ]);

    const merged = mergeProposals(proposals[0], proposals[1]);
    expect(merged).toMatchObject({
      amount: "350",
      date: "2026-10-01",
      transferCount: 2,
      references: ["M1", "M2"],
    });
    expect(merged.receipts).toHaveLength(2);

    const split = splitProposal(merged);
    expect(split.map((p) => [p.date, p.amount, p.references])).toEqual([
      ["2026-10-01", "100", ["M1"]],
      ["2026-10-02", "250", ["M2"]],
    ]);
    expect(new Set(split.map((p) => p.id)).size).toBe(2);
  });

  it("leaves a single-receipt row as is", () => {
    const { proposals } = groupScannedReceipts([scanned([tx({})])], {
      purpose: "fund_transfer",
      lenders,
      defaultInvestorId: 1,
    });
    expect(splitProposal(proposals[0])).toEqual([proposals[0]]);
  });
});

describe("uploads without AI", () => {
  it("makes one row per image with no warning", () => {
    const plain = scanned(null, { error: null, imageHash: null });
    const other = scanned(null, { error: null, imageHash: null });
    const result = groupScannedReceipts([plain, other], {
      purpose: "fund_transfer",
      lenders: [lenders[0]],
    });
    expect(result.scanErrorCount).toBe(0);
    expect(result.proposals).toHaveLength(2);
    expect(result.proposals.every((p) => p.warnings.length === 0)).toBe(true);
    expect(result.proposals.map((p) => p.receipts[0].imageUrl)).toEqual([
      plain.receipt!.imageUrl,
      other.receipt!.imageUrl,
    ]);
  });
});
