import {
  receiptTransactions,
  type ReceiptExtractedData,
  type ReceiptScanPurpose,
  type ReceiptTransaction,
  type ReceiptWarning,
  type ReceiptWarningCode,
} from "$lib/receipt-extraction-types";
import { uniqueReceipts, type PaymentReceipt } from "$lib/payment-receipts";
import { findMatchingParty, type PartyCandidate } from "./match-party";

/** One uploaded image after scanning (AI may have failed — the image is still kept). */
export interface ScannedReceipt {
  id: string;
  fileName: string;
  /** Null only when the file could not be read at all. */
  receipt: PaymentReceipt | null;
  extracted: ReceiptExtractedData | null;
  warnings: ReceiptWarning[];
  imageHash: string | null;
  error: string | null;
}

export type ProposalWarningCode =
  ReceiptWarningCode | "scan_failed" | "lender_not_matched" | "over_remaining";

export interface ProposalWarning {
  code: ProposalWarningCode;
  detail?: string;
  loanId?: number;
}

/** A transaction the review step proposes; the user edits it before applying. */
export interface ProposedTransaction {
  id: string;
  include: boolean;
  investorId: number | null;
  /** Peso amount as a form string ("" when unknown) so it binds straight to inputs. */
  amount: string;
  date: string;
  receipts: PaymentReceipt[];
  /** Number of transfers merged into this proposal. */
  transferCount: number;
  references: string[];
  /** Name read off the receipt for the lender side (sender or receiver). */
  partyName: string | null;
  /** The other side: the borrower for funding, the payer for repayments. */
  counterpartyName: string | null;
  warnings: ProposalWarning[];
  confidence: number | null;
  summary: string | null;
  /** Received payments: "general" or an interest period id. */
  interestPeriodId?: string;
}

export interface GroupOptions {
  purpose: ReceiptScanPurpose;
  lenders: PartyCandidate[];
  /** Lender of the row/card the scan started from. */
  defaultInvestorId?: number | null;
  /** Loan being edited — references already on it get `include: false`. */
  currentLoanId?: number | null;
}

export interface GroupResult {
  proposals: ProposedTransaction[];
  duplicateCount: number;
  failedTransferCount: number;
  scanErrorCount: number;
}

interface Entry {
  scanned: ScannedReceipt;
  transaction: ReceiptTransaction;
  transactionIndex: number;
  reference: string | null;
  receipts: PaymentReceipt[];
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `proposal-${Date.now().toString(36)}-${idCounter}`;
}

function normalizeRef(value: string | null): string | null {
  const ref = value?.replace(/\s+/g, "").toUpperCase();
  return ref ? ref : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function partyNameFor(
  transaction: ReceiptTransaction,
  purpose: ReceiptScanPurpose,
): string | null {
  return purpose === "received_payment"
    ? transaction.receiverName
    : transaction.senderName;
}

function counterpartyNameFor(
  transaction: ReceiptTransaction,
  purpose: ReceiptScanPurpose,
): string | null {
  return purpose === "received_payment"
    ? transaction.senderName
    : transaction.receiverName;
}

function warningsForEntry(entry: Entry): ProposalWarning[] {
  return entry.scanned.warnings
    .filter((warning) => {
      if (warning.code === "already_recorded") {
        return (
          normalizeRef(warning.referenceNumber ?? null) === entry.reference
        );
      }
      return (
        warning.transactionIndex === undefined ||
        warning.transactionIndex === entry.transactionIndex
      );
    })
    .map(({ code, detail, loanId }) => ({ code, detail, loanId }));
}

function uniqueWarnings(warnings: ProposalWarning[]): ProposalWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.detail ?? ""}:${warning.loanId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emptyProposal(
  scanned: ScannedReceipt,
  investorId: number | null,
  warnings: ProposalWarning[],
): ProposedTransaction {
  return {
    id: nextId(),
    include: Boolean(scanned.receipt),
    investorId,
    amount: "",
    date: "",
    receipts: scanned.receipt ? [scanned.receipt] : [],
    transferCount: 0,
    references: [],
    partyName: null,
    counterpartyName: null,
    warnings,
    confidence: scanned.extracted?.confidence ?? null,
    summary: scanned.extracted?.summary ?? scanned.error,
  };
}

/**
 * Turns scanned images into proposed transactions:
 * 1. drop exact duplicate images and failed transfers,
 * 2. dedupe the same reference number across images,
 * 3. resolve the lender by name (fallback: the row's lender, or the only lender),
 * 4. merge transfers with the same date and lender into one row (amounts summed).
 */
export function groupScannedReceipts(
  scanned: ScannedReceipt[],
  options: GroupOptions,
): GroupResult {
  const { purpose, lenders } = options;
  const fallbackInvestorId =
    options.defaultInvestorId ?? (lenders.length === 1 ? lenders[0].id : null);

  let duplicateCount = 0;
  let failedTransferCount = 0;
  let scanErrorCount = 0;
  const standalone: ProposedTransaction[] = [];
  const entries: Entry[] = [];
  const byReference = new Map<string, Entry>();
  const seenHashes = new Set<string>();

  for (const item of scanned) {
    if (item.imageHash) {
      if (seenHashes.has(item.imageHash)) {
        duplicateCount += 1;
        continue;
      }
      seenHashes.add(item.imageHash);
    }

    if (!item.extracted) {
      // No reading: AI failed (warn) or was off (plain upload, no warning).
      if (item.error) scanErrorCount += 1;
      standalone.push(
        emptyProposal(
          item,
          fallbackInvestorId,
          item.error ? [{ code: "scan_failed", detail: item.error }] : [],
        ),
      );
      continue;
    }

    const transactions = receiptTransactions(item.extracted);
    const usable = transactions
      .map((transaction, transactionIndex) => ({
        transaction,
        transactionIndex,
      }))
      .filter(({ transaction }) => {
        if (transaction.status !== "failed") return true;
        failedTransferCount += 1;
        return false;
      });

    if (usable.length === 0) {
      // Invalid / unreadable / only failed transfers: keep the image so nothing is lost,
      // but start unchecked when the AI is sure it is not payment proof.
      const proposal = emptyProposal(
        item,
        fallbackInvestorId,
        item.warnings.map(({ code, detail, loanId }) => ({
          code,
          detail,
          loanId,
        })),
      );
      if (item.extracted.verdict === "invalid" || transactions.length > 0) {
        proposal.include = false;
      }
      standalone.push(proposal);
      continue;
    }

    for (const { transaction, transactionIndex } of usable) {
      const reference = normalizeRef(transaction.referenceNumber);
      const receipts = item.receipt ? [item.receipt] : [];
      const existing = reference ? byReference.get(reference) : undefined;
      if (existing) {
        duplicateCount += 1;
        existing.receipts = uniqueReceipts([...existing.receipts, ...receipts]);
        continue;
      }
      const entry: Entry = {
        scanned: item,
        transaction,
        transactionIndex,
        reference,
        receipts,
      };
      if (reference) byReference.set(reference, entry);
      entries.push(entry);
    }
  }

  const groups = new Map<string, ProposedTransaction>();
  entries.forEach((entry, index) => {
    const partyName = partyNameFor(entry.transaction, purpose);
    const matched = findMatchingParty(partyName, lenders);
    const investorId = matched?.id ?? fallbackInvestorId;
    const warnings = warningsForEntry(entry);
    if (investorId === null && lenders.length > 0) {
      warnings.push({
        code: "lender_not_matched",
        detail: partyName ?? undefined,
      });
    }

    const date = entry.transaction.date;
    const key = date
      ? `${date}|${investorId ?? "unknown"}`
      : `undated-${index}`;
    const amount = entry.transaction.amount;
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        id: nextId(),
        include: true,
        investorId,
        amount: amount !== null ? String(roundMoney(amount)) : "",
        date: date ?? "",
        receipts: [...entry.receipts],
        transferCount: 1,
        references: entry.reference ? [entry.reference] : [],
        partyName,
        counterpartyName: counterpartyNameFor(entry.transaction, purpose),
        warnings,
        confidence: entry.scanned.extracted?.confidence ?? null,
        summary: entry.scanned.extracted?.summary ?? null,
      });
      return;
    }

    const sum = (current.amount ? Number(current.amount) : 0) + (amount ?? 0);
    current.amount = sum > 0 ? String(roundMoney(sum)) : "";
    current.receipts = uniqueReceipts([...current.receipts, ...entry.receipts]);
    current.transferCount += 1;
    if (entry.reference) current.references.push(entry.reference);
    current.partyName ??= partyName;
    current.counterpartyName ??= counterpartyNameFor(
      entry.transaction,
      purpose,
    );
    current.warnings = uniqueWarnings([...current.warnings, ...warnings]);
    const confidence = entry.scanned.extracted?.confidence ?? null;
    if (confidence !== null) {
      current.confidence =
        current.confidence === null
          ? confidence
          : Math.min(current.confidence, confidence);
    }
  });

  const proposals = [...groups.values(), ...standalone].map((proposal) => {
    const onThisLoan =
      options.currentLoanId != null &&
      proposal.warnings.some(
        (warning) =>
          warning.code === "already_recorded" &&
          warning.loanId === options.currentLoanId,
      );
    return {
      ...proposal,
      warnings: uniqueWarnings(proposal.warnings),
      include: proposal.include && !onThisLoan,
    };
  });

  proposals.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  return { proposals, duplicateCount, failedTransferCount, scanErrorCount };
}

/** "Merge with previous": sum amounts, keep the earlier row's date and lender. */
export function mergeProposals(
  target: ProposedTransaction,
  source: ProposedTransaction,
): ProposedTransaction {
  const amount = (Number(target.amount) || 0) + (Number(source.amount) || 0);
  return {
    ...target,
    include: true,
    amount: amount > 0 ? String(roundMoney(amount)) : "",
    date: target.date || source.date,
    investorId: target.investorId ?? source.investorId,
    receipts: uniqueReceipts([...target.receipts, ...source.receipts]),
    transferCount: target.transferCount + source.transferCount,
    references: [...new Set([...target.references, ...source.references])],
    partyName: target.partyName ?? source.partyName,
    counterpartyName: target.counterpartyName ?? source.counterpartyName,
    warnings: uniqueWarnings([...target.warnings, ...source.warnings]),
    confidence:
      target.confidence === null
        ? source.confidence
        : source.confidence === null
          ? target.confidence
          : Math.min(target.confidence, source.confidence),
  };
}

/** "Split receipts": one row per image, prefilled from that image's own reading. */
export function splitProposal(
  proposal: ProposedTransaction,
): ProposedTransaction[] {
  if (proposal.receipts.length < 2) return [proposal];
  return proposal.receipts.map((receipt) => {
    const transaction = receiptTransactions(receipt.extractedData).find(
      (item) => item.status !== "failed" && item.amount !== null,
    );
    const reference = normalizeRef(transaction?.referenceNumber ?? null);
    return {
      ...proposal,
      id: nextId(),
      include: true,
      amount:
        transaction?.amount != null
          ? String(roundMoney(transaction.amount))
          : "",
      date: transaction?.date ?? proposal.date,
      receipts: [receipt],
      transferCount: 1,
      references: reference ? [reference] : [],
      warnings: [],
      confidence: receipt.extractedData?.confidence ?? null,
      summary: receipt.extractedData?.summary ?? null,
    };
  });
}
