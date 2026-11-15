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

type Check = {
  id: string;
  title: string;
  sql: string;
  note?: string;
};

const checks: Check[] = [
  {
    id: "unlinked-payments",
    title: "Payments with no interest period on a multi-interest allocation",
    sql: `
      select rp.id, rp.loan_investor_id, li.loan_id, rp.amount
      from received_payments rp
      join loan_investors li on li.id = rp.loan_investor_id
      where rp.interest_period_id is null
        and li.has_multiple_interest = true
      order by rp.id`,
    note: "Legitimate unlinked principal payments are allowed; this is a count to review, not an error. The old repair endpoint deleted these.",
  },
  {
    id: "completed-underpaid",
    title:
      "Completed periods whose linked payments are below the expected interest",
    sql: `
      with base as (
        select li.id as li_id, li.loan_id, li.amount::numeric as li_amount,
               sum(li.amount::numeric) over (partition by li.loan_id) as loan_total
        from loan_investors li
      ),
      expected as (
        select ip.id as period_id, ip.status, li.loan_id,
               case when ip.interest_type = 'fixed' then ip.interest_rate::numeric
                    else (case when b.li_amount = 0 then b.loan_total else b.li_amount end)
                         * ip.interest_rate::numeric / 100
               end as expected
        from interest_periods ip
        join base b on b.li_id = ip.loan_investor_id
        join loan_investors li on li.id = ip.loan_investor_id
      ),
      linked as (
        select interest_period_id, sum(amount::numeric) as paid
        from received_payments
        where interest_period_id is not null
        group by interest_period_id
      )
      select e.period_id, e.loan_id, e.expected, coalesce(l.paid, 0) as paid
      from expected e
      left join linked l on l.interest_period_id = e.period_id
      where e.status = 'Completed'
        and coalesce(l.paid, 0) + 0.02 < e.expected
      order by e.period_id`,
  },
  {
    id: "pending-overpaid",
    title:
      "Pending or Incomplete periods whose linked payments already cover them",
    sql: `
      with base as (
        select li.id as li_id, li.loan_id, li.amount::numeric as li_amount,
               sum(li.amount::numeric) over (partition by li.loan_id) as loan_total
        from loan_investors li
      ),
      expected as (
        select ip.id as period_id, ip.status, li.loan_id,
               case when ip.interest_type = 'fixed' then ip.interest_rate::numeric
                    else (case when b.li_amount = 0 then b.loan_total else b.li_amount end)
                         * ip.interest_rate::numeric / 100
               end as expected
        from interest_periods ip
        join base b on b.li_id = ip.loan_investor_id
        join loan_investors li on li.id = ip.loan_investor_id
      ),
      linked as (
        select interest_period_id, sum(amount::numeric) as paid
        from received_payments
        where interest_period_id is not null
        group by interest_period_id
      )
      select e.period_id, e.loan_id, e.status, e.expected, coalesce(l.paid, 0) as paid
      from expected e
      join linked l on l.interest_period_id = e.period_id
      where e.status in ('Pending', 'Incomplete')
        and coalesce(l.paid, 0) + 0.02 >= e.expected
      order by e.period_id`,
  },
  {
    id: "receiptless-created-payments",
    title:
      "Payments with no receipt that match a period's expected amount and due date",
    sql: `
      with base as (
        select li.id as li_id, li.loan_id, li.amount::numeric as li_amount,
               sum(li.amount::numeric) over (partition by li.loan_id) as loan_total
        from loan_investors li
      ),
      expected as (
        select ip.id as period_id, ip.due_date,
               case when ip.interest_type = 'fixed' then ip.interest_rate::numeric
                    else (case when b.li_amount = 0 then b.loan_total else b.li_amount end)
                         * ip.interest_rate::numeric / 100
               end as expected
        from interest_periods ip
        join base b on b.li_id = ip.loan_investor_id
      )
      select rp.id, rp.loan_investor_id, rp.interest_period_id, rp.amount
      from received_payments rp
      join expected e on e.period_id = rp.interest_period_id
      where coalesce(jsonb_array_length(rp.receipts), 0) = 0
        and rp.receipt_image_url is null
        and abs(rp.amount::numeric - e.expected) <= 0.02
        and rp.received_date::date = e.due_date::date
      order by rp.id`,
    note: "Likely rows created by the removed fix-received-payments endpoint.",
  },
  {
    id: "loan-zero-allocations",
    title: "Loans with no allocations",
    sql: `
      select l.id, l.status
      from loans l
      left join loan_investors li on li.loan_id = l.id
      where li.id is null
      order by l.id`,
  },
  {
    id: "zero-capital-fixed",
    title: "Zero-capital allocations stored as a fixed amount",
    sql: `
      select li.id, li.loan_id, li.interest_rate
      from loan_investors li
      where li.amount::numeric = 0
        and li.interest_type = 'fixed'
      order by li.id`,
    note: "Agent investors converted to a fixed peso amount at save (CALC-10).",
  },
  {
    id: "duplicate-period-dates",
    title: "Duplicate interest period dates on one allocation",
    sql: `
      select ip.loan_investor_id, ip.due_date::date as due, count(*) as rows
      from interest_periods ip
      join loan_investors li on li.id = ip.loan_investor_id
      join loans l on l.id = li.loan_id
      where li.deleted_at is null and l.deleted_at is null
      group by ip.loan_investor_id, ip.due_date::date
      having count(*) > 1
      order by ip.loan_investor_id, due`,
  },
  {
    id: "periods-on-removed-allocations",
    title: "Interest periods left on a removed disbursement",
    sql: `
      select ip.id, ip.loan_investor_id, li.loan_id
      from interest_periods ip
      join loan_investors li on li.id = ip.loan_investor_id
      join loans l on l.id = li.loan_id
      where li.deleted_at is not null and l.deleted_at is null
      order by ip.id`,
    note: "A removed disbursement should not keep a schedule behind.",
  },
  {
    id: "payments-on-removed-allocations",
    title: "Active payments left on a removed disbursement",
    sql: `
      select rp.id, rp.loan_investor_id, li.loan_id
      from received_payments rp
      join loan_investors li on li.id = rp.loan_investor_id
      join loans l on l.id = li.loan_id
      where li.deleted_at is not null and l.deleted_at is null
        and rp.deleted_at is null
      order by rp.id`,
    note: "Removing an investor must remove or re-home their payments.",
  },
  {
    id: "missing-interest-periods",
    title: "Multi-interest allocations with no periods",
    sql: `
      select li.id, li.loan_id
      from loan_investors li
      left join interest_periods ip on ip.loan_investor_id = li.id
      where li.has_multiple_interest = true
        and ip.id is null
      order by li.id`,
  },
  {
    id: "completed-underpaid-loans",
    title: "Completed loans whose payments do not cover principal + interest",
    sql: `
      with base as (
        select li.id as li_id, li.loan_id, li.amount::numeric as li_amount,
               li.interest_type, li.interest_rate::numeric as li_rate,
               sum(li.amount::numeric) over (partition by li.loan_id) as loan_total
        from loan_investors li
        where li.deleted_at is null
      ),
      period_interest as (
        select b.loan_id,
               sum(case when ip.interest_type = 'fixed' then ip.interest_rate::numeric
                        else (case when b.li_amount = 0 then b.loan_total else b.li_amount end)
                             * ip.interest_rate::numeric / 100
                   end) as amount
        from interest_periods ip
        join base b on b.li_id = ip.loan_investor_id
        group by b.loan_id
      ),
      flat_interest as (
        select b.loan_id,
               sum(case when b.interest_type = 'fixed' then b.li_rate
                        else (case when b.li_amount = 0 then b.loan_total else b.li_amount end)
                             * b.li_rate / 100
                   end) as amount
        from base b
        where not exists (
          select 1 from interest_periods ip where ip.loan_investor_id = b.li_id
        )
        group by b.loan_id
      ),
      totals as (
        select b.loan_id,
               sum(b.li_amount) as principal,
               coalesce(max(pi.amount), 0) as period_interest,
               coalesce(max(fi.amount), 0) as flat_interest
        from base b
        left join period_interest pi on pi.loan_id = b.loan_id
        left join flat_interest fi on fi.loan_id = b.loan_id
        group by b.loan_id
      ),
      paid as (
        select li.loan_id, sum(rp.amount::numeric) as received
        from received_payments rp
        join loan_investors li on li.id = rp.loan_investor_id
        where rp.deleted_at is null and li.deleted_at is null
        group by li.loan_id
      )
      select l.id, l.status, t.principal, t.period_interest, t.flat_interest,
             coalesce(p.received, 0) as received
      from loans l
      join totals t on t.loan_id = l.id
      left join paid p on p.loan_id = l.id
      where l.deleted_at is null
        and l.status = 'Completed'
        and l.status_override is null
        and coalesce(p.received, 0) + 0.02
            < t.principal + t.period_interest + t.flat_interest
      order by l.id`,
    note: "Completed without a manual override should be fully received.",
  },
  {
    id: "overdue-without-overdue-periods",
    title: "Overdue loans with no overdue or incomplete period",
    sql: `
      select l.id
      from loans l
      where l.status = 'Overdue'
        and not exists (
          select 1
          from interest_periods ip
          join loan_investors li on li.id = ip.loan_investor_id
          where li.loan_id = l.id
            and ip.status in ('Overdue', 'Incomplete')
        )
      order by l.id`,
  },
  {
    id: "debts-orphan-periods",
    title: "Debt periods outside the debt term",
    sql: `
      select dip.id, dip.debt_id, dip.due_date
      from debt_interest_periods dip
      join debts d on d.id = dip.debt_id
      where dip.due_date > (d.date + (d.duration_months || ' months')::interval) + interval '31 days'
      order by dip.id`,
    note: "Periods after a shortened term are left behind by the debt sync.",
  },
];

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
    for (const check of checks) {
      const rows = await sql.unsafe(check.sql);
      results.push({
        id: check.id,
        title: check.title,
        count: rows.length,
        sample: rows.slice(0, 10),
        note: check.note,
      });
    }
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
