/**
 * Read-only money health checks shared by the admin API and Settings card.
 * Counts and anonymized ids only; never names, emails, notes, or receipts.
 */
import { sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import { HEALTH_CHECKS } from "$lib/money/health-checks";
import { loadStatusDrift } from "$lib/server/status-drift";

export interface MoneyHealthCheck {
  id: string;
  title: string;
  count: number;
  sample: Array<Record<string, unknown>>;
  note?: string;
}

type Row = Record<string, unknown>;

export async function runMoneyHealthChecks(): Promise<MoneyHealthCheck[]> {
  const results: MoneyHealthCheck[] = [];
  for (const check of HEALTH_CHECKS) {
    const rows = (await db.execute(sql.raw(check.sql))) as unknown as Row[];
    results.push({
      id: check.id,
      title: check.title,
      count: rows.length,
      sample: rows.slice(0, 10),
      note: check.note,
    });
  }

  // Status drift is ledger-based. The removed SQL checks used the allocation
  // amount as the interest base and ignored unlinked money, so periods the
  // ledger already considered paid were reported as anomalies.
  const drift = await loadStatusDrift();
  results.push({
    id: "period-status-drift",
    title: "Interest periods whose stored status disagrees with the ledger",
    count: drift.periods.length,
    sample: drift.periods.slice(0, 10) as unknown as Array<
      Record<string, unknown>
    >,
    note: "The daily status sweep or a repair run clears these.",
  });
  results.push({
    id: "loan-status-drift",
    title: "Loans whose stored status disagrees with the ledger",
    count: drift.loans.length,
    sample: drift.loans.slice(0, 10) as unknown as Array<
      Record<string, unknown>
    >,
    note: "The daily status sweep or a repair run clears these.",
  });

  return results;
}
