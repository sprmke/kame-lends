import type { PaymentReceipt } from "$lib/payment-receipts";
import { applyProposals } from "./apply";
import {
  mergeProposals,
  splitProposal,
  type ProposalWarning,
  type ProposedTransaction,
} from "./group-transactions";

/** What the AI said about a row, kept on the row so the form itself is the review. */
export interface RowScanMeta {
  warnings: ProposalWarning[];
  summary: string | null;
  transferCount: number;
  references: string[];
  confidence: number | null;
}

/** The receipt-driven part of a form row, independent of each form's field names. */
export interface ScanRowFields {
  investorId: number | null;
  amount: string;
  date: string;
  receipts: PaymentReceipt[];
  interestPeriodId?: string;
  scan: RowScanMeta | null;
}

/**
 * Maps a form's row type to `ScanRowFields`. `write(null, …)` creates a new row;
 * `write(row, …)` updates one and must keep the row's other fields (interest, etc.).
 */
export interface RowAdapter<T> {
  getId: (row: T) => string;
  read: (row: T) => ScanRowFields;
  write: (base: T | null, fields: ScanRowFields) => T;
}

export function proposalToFields(proposal: ProposedTransaction): ScanRowFields {
  return {
    investorId: proposal.investorId,
    amount: proposal.amount,
    date: proposal.date,
    receipts: proposal.receipts,
    interestPeriodId: proposal.interestPeriodId,
    scan: {
      warnings: proposal.warnings,
      summary: proposal.summary,
      transferCount: proposal.transferCount,
      references: proposal.references,
      confidence: proposal.confidence,
    },
  };
}

function fieldsToProposal(
  id: string,
  fields: ScanRowFields,
): ProposedTransaction {
  return {
    id,
    include: true,
    investorId: fields.investorId,
    amount: fields.amount,
    date: fields.date,
    receipts: fields.receipts,
    transferCount: fields.scan?.transferCount ?? 1,
    references: fields.scan?.references ?? [],
    partyName: null,
    counterpartyName: null,
    warnings: fields.scan?.warnings ?? [],
    confidence: fields.scan?.confidence ?? null,
    summary: fields.scan?.summary ?? null,
    interestPeriodId: fields.interestPeriodId,
  };
}

/** A row nobody has started: no amount and no receipts. */
export function isBlankRow(fields: ScanRowFields): boolean {
  return !fields.amount && fields.receipts.length === 0;
}

/**
 * Creates (or fills blank) rows from proposals, receipts attached to each.
 * With `sourceId`, that row is split in place instead ("Split into N transactions").
 */
export function addProposalsToRows<T>(
  rows: T[],
  proposals: ProposedTransaction[],
  adapter: RowAdapter<T>,
  options: { sourceId?: string | null; scannedImageUrls?: string[] } = {},
): T[] {
  return applyProposals(rows, proposals, {
    getId: adapter.getId,
    getReceipts: (row) => adapter.read(row).receipts,
    isBlank: (row) => isBlankRow(adapter.read(row)),
    fill: (base, proposal) => adapter.write(base, proposalToFields(proposal)),
    sourceId: options.sourceId,
    scannedImageUrls: options.scannedImageUrls,
  });
}

/** Folds row `index` into the row above it (amounts summed, receipts kept). */
export function mergeRowWithPrevious<T>(
  rows: T[],
  index: number,
  adapter: RowAdapter<T>,
): T[] {
  if (index <= 0 || index >= rows.length) return rows;
  const previous = rows[index - 1];
  const merged = mergeProposals(
    fieldsToProposal(adapter.getId(previous), adapter.read(previous)),
    fieldsToProposal(adapter.getId(rows[index]), adapter.read(rows[index])),
  );
  return [
    ...rows.slice(0, index - 1),
    adapter.write(previous, proposalToFields(merged)),
    ...rows.slice(index + 1),
  ];
}

/** One row per receipt image, each prefilled from that image's own reading. */
export function splitRowAt<T>(
  rows: T[],
  index: number,
  adapter: RowAdapter<T>,
): T[] {
  const row = rows[index];
  if (!row) return rows;
  const parts = splitProposal(
    fieldsToProposal(adapter.getId(row), adapter.read(row)),
  );
  if (parts.length < 2) return rows;
  const [first, ...rest] = parts;
  return [
    ...rows.slice(0, index),
    adapter.write(row, proposalToFields(first)),
    ...rest.map((part) => adapter.write(null, proposalToFields(part))),
    ...rows.slice(index + 1),
  ];
}
