import { describe, expect, it } from "vitest";
import type { PaymentReceipt } from "$lib/payment-receipts";
import { applyProposals, type ApplyOptions } from "./apply";
import type { ProposedTransaction } from "./group-transactions";

interface Row {
  id: string;
  amount: string;
  date: string;
  interest: string;
  receipts: PaymentReceipt[];
}

const receipt = (name: string): PaymentReceipt => ({
  imageUrl: `storage:${name}`,
  extractedData: null,
});

function proposal(
  id: string,
  amount: string,
  date: string,
  receipts: PaymentReceipt[],
): ProposedTransaction {
  return {
    id,
    include: true,
    investorId: 1,
    amount,
    date,
    receipts,
    transferCount: 1,
    references: [],
    partyName: null,
    counterpartyName: null,
    warnings: [],
    confidence: null,
    summary: null,
  };
}

let created = 0;
const options: ApplyOptions<Row> = {
  fill: (base, p) => ({
    id: base?.id ?? `new-${++created}`,
    interest: base?.interest ?? "10",
    amount: p.amount,
    date: p.date,
    receipts: p.receipts,
  }),
  isBlank: (row) => !row.amount && row.receipts.length === 0,
  getId: (row) => row.id,
  getReceipts: (row) => row.receipts,
};

describe("applyProposals", () => {
  it("reuses blank rows first, keeps typed rows, then appends", () => {
    created = 0;
    const rows: Row[] = [
      {
        id: "typed",
        amount: "500",
        date: "2026-09-01",
        interest: "5",
        receipts: [],
      },
      {
        id: "blank",
        amount: "",
        date: "2026-10-17",
        interest: "7",
        receipts: [],
      },
    ];
    const next = applyProposals(
      rows,
      [
        proposal("p1", "100", "2026-10-01", [receipt("a")]),
        proposal("p2", "200", "2026-10-02", [receipt("b")]),
      ],
      options,
    );
    expect(next).toEqual([
      rows[0],
      {
        id: "blank",
        interest: "7",
        amount: "100",
        date: "2026-10-01",
        receipts: [receipt("a")],
      },
      {
        id: "new-1",
        interest: "10",
        amount: "200",
        date: "2026-10-02",
        receipts: [receipt("b")],
      },
    ]);
  });

  it("splits a source row in place and keeps its older receipts", () => {
    created = 0;
    const rows: Row[] = [
      {
        id: "first",
        amount: "1",
        date: "2026-01-01",
        interest: "1",
        receipts: [],
      },
      {
        id: "source",
        amount: "999",
        date: "2026-10-01",
        interest: "3",
        receipts: [receipt("old"), receipt("a"), receipt("b")],
      },
      {
        id: "last",
        amount: "2",
        date: "2026-01-02",
        interest: "2",
        receipts: [],
      },
    ];
    const next = applyProposals(
      rows,
      [
        proposal("p1", "100", "2026-10-01", [receipt("a")]),
        proposal("p2", "200", "2026-10-05", [receipt("b")]),
      ],
      {
        ...options,
        sourceId: "source",
        scannedImageUrls: ["storage:a", "storage:b"],
      },
    );
    expect(
      next.map((row) => [
        row.id,
        row.amount,
        row.receipts.map((r) => r.imageUrl),
      ]),
    ).toEqual([
      ["first", "1", []],
      ["source", "100", ["storage:old", "storage:a"]],
      ["new-1", "200", ["storage:b"]],
      ["last", "2", []],
    ]);
    expect(next[1].interest).toBe("3");
  });

  it("is a no-op with no proposals", () => {
    const rows: Row[] = [];
    expect(applyProposals(rows, [], options)).toBe(rows);
  });
});
