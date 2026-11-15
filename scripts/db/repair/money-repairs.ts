/**
 * Safe money repairs. Dry-run by default.
 *
 * Usage:
 *   bun scripts/db/repair/money-repairs.ts --category=duplicate-period-dates
 *   bun scripts/db/repair/money-repairs.ts --category=duplicate-period-dates \
 *     --apply --backup-id=20261113-050618
 *   bun scripts/db/repair/money-repairs.ts --category=duplicate-period-dates \
 *     --loan-id=19
 *   bun scripts/db/repair/money-repairs.ts --category=duplicate-period-dates \
 *     --source=prod
 *
 * Rules:
 * - never runs without `--apply` and a backup id;
 * - runs inside one transaction;
 * - writes a money_audit_events row with reason `repair:<category>`;
 * - re-run `bun run db:health:money` afterwards.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const args = process.argv.slice(2);
const category = args.find((a) => a.startsWith("--category="))?.split("=")[1];
const apply = args.includes("--apply");
const loanIdArg = args.find((a) => a.startsWith("--loan-id="))?.split("=")[1];
const loanId = loanIdArg ? Number(loanIdArg) : null;
if (loanIdArg && (!Number.isInteger(loanId) || loanId! <= 0)) {
  console.error("--loan-id must be a positive integer");
  process.exit(1);
}
const backupId = args.find((a) => a.startsWith("--backup-id="))?.split("=")[1];
const source =
  args.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "local";
if (source !== "local" && source !== "prod") {
  console.error("--source must be local or prod");
  process.exit(1);
}

function envValue(key: string): string | undefined {
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split("\n")) {
      if (line.startsWith(`${key}=`)) {
        return line.slice(key.length + 1).replace(/^"|"$/g, "");
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function main() {
  if (!category) {
    console.error(
      "Pass --category=duplicate-period-dates|zero-capital-fixed|receiptless-created-payments|unlinked-payments",
    );
    process.exit(1);
  }
  if (apply && !backupId) {
    console.error(
      "--apply requires a fresh --backup-id (see bun run backup:neon).",
    );
    process.exit(1);
  }

  const url =
    source === "prod"
      ? (process.env.DATABASE_URL_PROD ?? envValue("DATABASE_URL_PROD"))
      : (process.env.DATABASE_URL ?? envValue("DATABASE_URL"));
  if (!url) {
    throw new Error(
      source === "prod"
        ? "Set DATABASE_URL_PROD in .env.local"
        : "Set DATABASE_URL or pass --source=prod",
    );
  }
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "(unparseable)";
    }
  })();
  if (source === "prod" && !url.includes("neon.tech")) {
    throw new Error("--source=prod requires a Neon DATABASE_URL_PROD");
  }
  if (source === "local" && url.includes("neon.tech")) {
    throw new Error(
      "Refusing a Neon URL with --source=local; pass --source=prod",
    );
  }
  console.log(
    `Target: ${host} · ${apply ? "APPLY" : "dry run"}${loanId ? ` · loan ${loanId}` : ""}`,
  );

  const sql = postgres(url, { max: 1 });
  const scope = loanId ? sql`and li.loan_id = ${loanId}` : sql``;
  try {
    if (apply) await sql.begin(async (tx) => run(tx, true, scope));
    else await run(sql, false, scope);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function audit(sql: postgres.Sql, action: string, count: number) {
  await sql`
    insert into money_audit_events (entity_type, action, reason, after)
    values ('repair', ${action}, ${`repair:${category}`}, ${sql.json({ count, backupId })})
  `;
}

function printRows(label: string, rows: readonly Record<string, unknown>[]) {
  console.log(`${label}: ${rows.length}`);
  for (const row of rows) console.log(`  ${JSON.stringify(row)}`);
}

async function run(
  sql: postgres.Sql,
  apply: boolean,
  scope: postgres.PendingQuery<postgres.Row[]>,
) {
  if (category === "duplicate-period-dates") {
    const rows = await sql`
      select a.id as keep_id, b.id as drop_id, a.loan_investor_id,
             a.due_date::date, li.loan_id, l.loan_name
      from interest_periods a
      join interest_periods b
        on b.loan_investor_id = a.loan_investor_id
       and b.due_date = a.due_date
       and b.id > a.id
      join loan_investors li on li.id = a.loan_investor_id
      join loans l on l.id = li.loan_id
      where true ${scope}
      order by a.loan_investor_id, a.due_date, b.id
    `;
    printRows("duplicate periods", rows);
    if (!apply) return;
    for (const row of rows) {
      await sql`
        update received_payments
        set interest_period_id = ${row.keep_id}, updated_at = now()
        where interest_period_id = ${row.drop_id}
      `;
      await sql`delete from interest_periods where id = ${row.drop_id}`;
    }
    await audit(sql, "repair:duplicate-period-dates", rows.length);
    console.log(`deleted ${rows.length} duplicate period(s)`);

    // Migration 0042 can only add this when the database is already clean.
    // Complete the guard here after the repair.
    await sql`
      do $$
      begin
        if not exists (
          select 1 from pg_constraint
          where conname = 'interest_periods_loan_investor_due_date_unique'
        ) and not exists (
          select 1 from interest_periods
          group by loan_investor_id, due_date
          having count(*) > 1
        ) then
          alter table interest_periods
            add constraint interest_periods_loan_investor_due_date_unique
            unique (loan_investor_id, due_date);
        end if;
      end $$;
    `;
    console.log("unique period-date constraint ensured");
    return;
  }

  if (category === "zero-capital-fixed") {
    const rows = await sql`
      select li.id, li.loan_id, l.loan_name, li.investor_id,
             li.interest_rate::numeric as amount,
             (select sum(x.amount::numeric) from loan_investors x
               where x.loan_id = li.loan_id and x.deleted_at is null) as loan_total
      from loan_investors li
      join loans l on l.id = li.loan_id
      where li.deleted_at is null and li.amount::numeric = 0
        and li.interest_type = 'fixed'
        ${scope}
    `;
    printRows("zero-capital fixed allocations", rows);
    if (!apply) return;
    let converted = 0;
    for (const row of rows) {
      const total = Number(row.loan_total) || 0;
      if (total <= 0) continue;
      const rate = ((Number(row.amount) / total) * 100).toFixed(2);
      await sql`
        update loan_investors
        set interest_type = 'rate', interest_rate = ${rate}, updated_at = now()
        where id = ${row.id}
      `;
      converted += 1;
    }
    await audit(sql, "repair:zero-capital-fixed", converted);
    console.log(`converted ${converted} allocation(s) to rate`);
    return;
  }

  if (category === "receiptless-created-payments") {
    const rows = await sql`
      with base as (
        select li.id as li_id, li.amount::numeric as li_amount,
               sum(li.amount::numeric) over (partition by li.loan_id) as loan_total
        from loan_investors li where li.deleted_at is null
      ),
      expected as (
        select ip.id as period_id, ip.due_date,
               case when ip.interest_type = 'fixed' then ip.interest_rate::numeric
                    else (case when b.li_amount = 0 then b.loan_total else b.li_amount end)
                         * ip.interest_rate::numeric / 100 end as expected
        from interest_periods ip join base b on b.li_id = ip.loan_investor_id
      )
      select rp.id, rp.loan_investor_id, li.investor_id, li.loan_id,
             l.loan_name, rp.interest_period_id, rp.amount,
             rp.received_date::date
      from received_payments rp
      join loan_investors li on li.id = rp.loan_investor_id
      join loans l on l.id = li.loan_id
      join expected e on e.period_id = rp.interest_period_id
      where rp.deleted_at is null and li.deleted_at is null and l.deleted_at is null
        and coalesce(jsonb_array_length(rp.receipts), 0) = 0
        and rp.receipt_image_url is null
        and abs(rp.amount::numeric - e.expected) <= 0.02
        and rp.received_date::date = e.due_date::date
        ${scope}
      order by rp.id
    `;
    printRows(
      "receipt-less payments that may have been created by the removed button",
      rows,
    );
    console.log("No automatic action: confirm each row with the owner first.");
    return;
  }

  if (category === "unlinked-payments") {
    const rows = await sql`
      select rp.id, rp.loan_investor_id, li.investor_id, li.loan_id,
             l.loan_name, rp.amount, rp.received_date::date
      from received_payments rp
      join loan_investors li on li.id = rp.loan_investor_id
      join loans l on l.id = li.loan_id
      where rp.interest_period_id is null
        and rp.deleted_at is null and li.deleted_at is null and l.deleted_at is null
        and li.has_multiple_interest = true
        ${scope}
      order by rp.id
    `;
    printRows("unlinked payments on multi-interest allocations", rows);
    console.log(
      "No automatic action: unlinked money is applied to the oldest open interest, then principal.",
    );
    return;
  }

  console.error(`Unknown category: ${category}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
