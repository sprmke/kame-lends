import { uniqueReceipts, type PaymentReceipt } from "$lib/payment-receipts";
import type { ProposedTransaction } from "./group-transactions";

export interface ApplyOptions<T> {
  /** Builds a row from a proposal; `base` is the blank row being reused, if any. */
  fill: (base: T | null, proposal: ProposedTransaction) => T;
  /** A row the user has not started (no amount, no receipts). */
  isBlank: (row: T) => boolean;
  getId: (row: T) => string;
  getReceipts: (row: T) => PaymentReceipt[];
  /**
   * Row the scan started from ("Review & split" on one row). The first proposal
   * updates that row; images from this scan are replaced, older ones kept.
   */
  sourceId?: string | null;
  /** Image refs produced by this scan (used with `sourceId`). */
  scannedImageUrls?: string[];
}

/**
 * Applies reviewed proposals to form rows without losing typed data:
 * blank rows are reused first, then new rows are appended. With `sourceId`, the
 * proposals replace that row in place (first proposal) and follow it (the rest).
 */
export function applyProposals<T>(
  rows: T[],
  proposals: ProposedTransaction[],
  options: ApplyOptions<T>,
): T[] {
  if (proposals.length === 0) return rows;
  const { fill, isBlank, getId, getReceipts } = options;

  if (options.sourceId) {
    const index = rows.findIndex((row) => getId(row) === options.sourceId);
    if (index !== -1) {
      const source = rows[index];
      const scanned = new Set(options.scannedImageUrls ?? []);
      const kept = getReceipts(source).filter(
        (receipt) => !scanned.has(receipt.imageUrl),
      );
      const [first, ...rest] = proposals;
      const updated = fill(source, {
        ...first,
        receipts: uniqueReceipts([...kept, ...first.receipts]),
      });
      return [
        ...rows.slice(0, index),
        updated,
        ...rest.map((proposal) => fill(null, proposal)),
        ...rows.slice(index + 1),
      ];
    }
  }

  const queue = [...proposals];
  const next = rows.map((row) => {
    if (queue.length === 0 || !isBlank(row)) return row;
    return fill(row, queue.shift()!);
  });
  return [...next, ...queue.map((proposal) => fill(null, proposal))];
}
