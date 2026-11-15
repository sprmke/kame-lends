/**
 * Seed a disposable database for Playwright and Lighthouse.
 *
 * Idempotent. Creates one owner user (`E2E_USER_EMAIL`, default
 * e2e@example.com), an investor, a borrower, and one multi-interest loan with
 * a linked payment. Never run against production.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

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

const url = process.env.DATABASE_URL ?? envValue("DATABASE_URL");
if (!url) throw new Error("Set DATABASE_URL");
if (/neon\.tech/.test(url)) {
  throw new Error("Refusing to seed a Neon database. Use local Postgres.");
}

const email = (process.env.E2E_USER_EMAIL ?? "e2e@example.com").toLowerCase();
const sql = postgres(url, { max: 1 });

try {
  await sql.begin(async (tx) => {
    const [user] = await tx`
      insert into "user" (id, name, email, role)
      values ('e2e-user', 'E2E Owner', ${email}, 'admin')
      on conflict (email) do update set name = excluded.name
      returning id
    `;
    if (!user) throw new Error("Could not create seed user");

    const existing = await tx`
      select id from loans
      where user_id = ${user.id} and loan_name = 'E2E Money Loan'
      limit 1
    `;
    if (existing.length > 0) return;

    const [investor] = await tx`
      insert into investors (user_id, investor_user_id, name, email, contact_number)
      values (${user.id}, ${user.id}, 'E2E Investor', ${email}, '09170000000')
      on conflict (user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')))
        where investor_user_id is not null
      do update set email = excluded.email
      returning id
    `;
    const [borrower] = await tx`
      insert into borrowers (user_id, name, email)
      values (${user.id}, 'E2E Borrower', 'e2e-borrower@example.com')
      on conflict (user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')))
        where borrower_user_id is not null
      do update set email = excluded.email
      returning id
    `;

    const [loan] = await tx`
      insert into loans (user_id, borrower_id, loan_name, type, status, due_date, notes)
      values (${user.id}, ${borrower.id}, 'E2E Money Loan', 'Agent', 'Fully Funded', '2026-12-31', 'seed')
      on conflict do nothing
      returning id
    `;
    if (!loan) return;

    const [allocation] = await tx`
      insert into loan_investors (
        loan_id, investor_id, amount, interest_rate, interest_type, sent_date,
        is_paid, has_multiple_interest, receipts
      )
      values (${loan.id}, ${investor.id}, '100000', '0', 'rate', '2026-01-15', true, true, '[]'::jsonb)
      returning id
    `;

    const [period] = await tx`
      insert into interest_periods (
        loan_investor_id, due_date, interest_rate, interest_type, status
      )
      values (${allocation.id}, '2026-06-30', '3', 'rate', 'Completed')
      on conflict (loan_investor_id, due_date) do nothing
      returning id
    `;
    await tx`
      insert into interest_periods (
        loan_investor_id, due_date, interest_rate, interest_type, status
      )
      values (${allocation.id}, '2026-12-31', '3', 'rate', 'Pending')
      on conflict (loan_investor_id, due_date) do nothing
    `;
    if (period) {
      await tx`
        insert into received_payments (
          loan_investor_id, interest_period_id, amount, received_date, receipts
        )
        values (${allocation.id}, ${period.id}, '3000', '2026-06-30', '[]'::jsonb)
      `;
    }
  });
  console.log("E2E seed ready");
} finally {
  await sql.end({ timeout: 5 });
}
