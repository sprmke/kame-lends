/**
 * Read-only money health report.
 *
 * Prints anonymized ids and counts. Never writes, never prints names, emails,
 * receipt URLs, or notes.
 *
 * Usage:
 *   bun scripts/db/money-health-report.ts                 # local (.env.local DATABASE_URL)
 *   bun scripts/db/money-health-report.ts --source=prod   # DATABASE_URL_PROD from .env.local
 *   DATABASE_URL=postgres://... bun scripts/db/money-health-report.ts
 *   bun scripts/db/money-health-report.ts --json
 *
 * Exit code is 0 even when anomalies exist; the report is informational.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { HEALTH_CHECKS } from "$lib/money/health-checks";
import {
  collectStatusDrift,
  type StatusDriftLoan,
} from "$lib/money/status-drift";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const sourceArg = args.find((arg) => arg.startsWith("--source="));
const source = sourceArg?.slice("--source=".length) ?? "local";

function envValue(key: string): string | undefined {
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split("\n")) {
      if (line.startsWith(`${key}=`)) {
        return line.slice(key.length + 1).replace(/^"|"$/g, "");
      }
    }
  } catch {
    // no .env.local
  }
  return undefined;
}

function resolveUrl(): string {
  if (process.env.DATABASE_URL && source === "local") {
    return process.env.DATABASE_URL;
  }
  if (source === "prod") {
    const prod = process.env.DATABASE_URL_PROD ?? envValue("DATABASE_URL_PROD");
    if (!prod) throw new Error("Set DATABASE_URL_PROD in .env.local");
    return prod;
  }
  const url = process.env.DATABASE_URL ?? envValue("DATABASE_URL");
  if (!url) throw new Error("Set DATABASE_URL or pass --source=prod");
  return url;
}

async function loadDrift(sql: postgres.Sql) {
  const loanRows = await sql`
    select id, status, status_override, due_date
    from loans where deleted_at is null
  `;
  const allocationRows = await sql`
    select id, loan_id, investor_id, amount, interest_rate, interest_type,
           sent_date, is_paid, has_multiple_interest
    from loan_investors where deleted_at is null
  `;
  const periodRows = await sql`
    select id, loan_investor_id, due_date, interest_rate, interest_type, status
    from interest_periods
  `;
  const paymentRows = await sql`
    select id, loan_investor_id, interest_period_id, amount, received_date
    from received_payments where deleted_at is null
  `;

  const periodsByAllocation = new Map<number, unknown[]>();
  for (const period of periodRows) {
    const list = periodsByAllocation.get(period.loan_investor_id) ?? [];
    list.push(period);
    periodsByAllocation.set(period.loan_investor_id, list);
  }
  const paymentsByAllocation = new Map<number, unknown[]>();
  for (const payment of paymentRows) {
    const list = paymentsByAllocation.get(payment.loan_investor_id) ?? [];
    list.push(payment);
    paymentsByAllocation.set(payment.loan_investor_id, list);
  }
  const allocationsByLoan = new Map<number, unknown[]>();
  for (const allocation of allocationRows) {
    const list = allocationsByLoan.get(allocation.loan_id) ?? [];
    list.push({
      id: allocation.id,
      investorId: allocation.investor_id,
      amount: allocation.amount,
      interestRate: allocation.interest_rate,
      interestType: allocation.interest_type,
      sentDate: allocation.sent_date,
      isPaid: allocation.is_paid,
      hasMultipleInterest: allocation.has_multiple_interest,
      interestPeriods: (periodsByAllocation.get(allocation.id) ?? []).map(
        (period) => {
          const row = period as Record<string, unknown>;
          return {
            id: row.id,
            dueDate: row.due_date,
            interestRate: row.interest_rate,
            interestType: row.interest_type,
            status: row.status,
          };
        },
      ),
      receivedPayments: (paymentsByAllocation.get(allocation.id) ?? []).map(
        (payment) => {
          const row = payment as Record<string, unknown>;
          return {
            id: row.id,
            interestPeriodId: row.interest_period_id,
            amount: row.amount,
            receivedDate: row.received_date,
          };
        },
      ),
    });
    allocationsByLoan.set(allocation.loan_id, list);
  }

  const loans: StatusDriftLoan[] = loanRows.map((loan) => ({
    id: loan.id,
    status: loan.status,
    statusOverride: loan.status_override,
    dueDate: loan.due_date,
    loanInvestors: (allocationsByLoan.get(loan.id) ?? []) as never,
  }));
  return collectStatusDrift(loans);
}

async function main() {
  const url = resolveUrl();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "(unparseable)";
    }
  })();

  const sql = postgres(url, { max: 1 });
  const results: Array<{
    id: string;
    title: string;
    count: number;
    sample: unknown[];
    note?: string;
  }> = [];

  try {
    for (const check of HEALTH_CHECKS) {
      const rows = await sql.unsafe(check.sql);
      results.push({
        id: check.id,
        title: check.title,
        count: rows.length,
        sample: rows.slice(0, 10),
        note: check.note,
      });
    }

    const drift = await loadDrift(sql);
    results.push({
      id: "period-status-drift",
      title: "Interest periods whose stored status disagrees with the ledger",
      count: drift.periods.length,
      sample: drift.periods.slice(0, 10),
      note: "The daily status sweep or a repair run clears these.",
    });
    results.push({
      id: "loan-status-drift",
      title: "Loans whose stored status disagrees with the ledger",
      count: drift.loans.length,
      sample: drift.loans.slice(0, 10),
      note: "The daily status sweep or a repair run clears these.",
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        { host, generatedAt: new Date().toISOString(), results },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Money health report · ${host} · ${new Date().toISOString()}`);
  console.log("Read-only. No rows were written.\n");
  for (const result of results) {
    console.log(
      `${result.count === 0 ? "OK  " : "WARN"} ${result.id} (${result.count})`,
    );
    console.log(`     ${result.title}`);
    if (result.note) console.log(`     note: ${result.note}`);
    for (const row of result.sample) {
      console.log(`     ${JSON.stringify(row)}`);
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
