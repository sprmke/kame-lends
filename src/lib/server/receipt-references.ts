import { and, eq, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "$lib/server/db";
import { loanInvestors, loans, receivedPayments } from "$lib/server/db/schema";
import { receiptTransactions } from "$lib/receipt-extraction-types";
import type { PaymentReceipt } from "$lib/payment-receipts";

export interface RecordedReference {
  referenceNumber: string;
  loanId: number;
  loanName: string;
  kind: "disbursement" | "received_payment";
}

const MAX_REFERENCES = 20;

export function normalizeReference(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function containsReference(column: AnyPgColumn, ref: string): SQL {
  const top = JSON.stringify([{ extractedData: { referenceNumber: ref } }]);
  const nested = JSON.stringify([
    { extractedData: { transactions: [{ referenceNumber: ref }] } },
  ]);
  return sql`(${column} @> ${top}::jsonb OR ${column} @> ${nested}::jsonb)`;
}

function referencesIn(receipts: PaymentReceipt[] | null): Set<string> {
  const found = new Set<string>();
  for (const receipt of receipts ?? []) {
    for (const transaction of receiptTransactions(receipt.extractedData)) {
      if (transaction.referenceNumber) {
        found.add(normalizeReference(transaction.referenceNumber));
      }
    }
  }
  return found;
}

/**
 * Finds transfer reference numbers already saved on this user's loans
 * (disbursement or received-payment receipts) so a re-uploaded receipt is not
 * counted twice. Owner-scoped: only loans where `loans.user_id = userId`.
 */
export async function findRecordedReferences(
  userId: string,
  references: string[],
): Promise<RecordedReference[]> {
  const refs = [
    ...new Set(references.map((ref) => ref.trim()).filter(Boolean)),
  ].slice(0, MAX_REFERENCES);
  if (refs.length === 0) return [];
  const wanted = new Set(refs.map(normalizeReference));

  const [disbursements, payments] = await Promise.all([
    db
      .select({
        loanId: loans.id,
        loanName: loans.loanName,
        receipts: loanInvestors.receipts,
      })
      .from(loanInvestors)
      .innerJoin(loans, eq(loans.id, loanInvestors.loanId))
      .where(
        and(
          eq(loans.userId, userId),
          or(
            ...refs.map((ref) =>
              containsReference(loanInvestors.receipts, ref),
            ),
          ),
        ),
      ),
    db
      .select({
        loanId: loans.id,
        loanName: loans.loanName,
        receipts: receivedPayments.receipts,
      })
      .from(receivedPayments)
      .innerJoin(
        loanInvestors,
        eq(loanInvestors.id, receivedPayments.loanInvestorId),
      )
      .innerJoin(loans, eq(loans.id, loanInvestors.loanId))
      .where(
        and(
          eq(loans.userId, userId),
          or(
            ...refs.map((ref) =>
              containsReference(receivedPayments.receipts, ref),
            ),
          ),
        ),
      ),
  ]);

  const results: RecordedReference[] = [];
  const seen = new Set<string>();
  const collect = (
    rows: Array<{
      loanId: number;
      loanName: string;
      receipts: PaymentReceipt[] | null;
    }>,
    kind: RecordedReference["kind"],
  ) => {
    for (const row of rows) {
      for (const ref of referencesIn(row.receipts)) {
        const key = `${ref}:${row.loanId}:${kind}`;
        if (!wanted.has(ref) || seen.has(key)) continue;
        seen.add(key);
        results.push({
          referenceNumber: ref,
          loanId: row.loanId,
          loanName: row.loanName,
          kind,
        });
      }
    }
  };
  collect(disbursements, "disbursement");
  collect(payments, "received_payment");
  return results;
}
