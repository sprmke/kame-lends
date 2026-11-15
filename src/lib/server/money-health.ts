/**
 * Read-only money health checks shared by the admin API and Settings card.
 * Counts and anonymized ids only; never names, emails, notes, or receipts.
 */
import { sql } from "drizzle-orm";
import { db } from "$lib/server/db";

export interface MoneyHealthCheck {
  id: string;
  title: string;
  count: number;
  sample: Array<Record<string, unknown>>;
  note?: string;
}

type Row = Record<string, unknown>;

const checks: Array<{
  id: string;
  title: string;
  query: ReturnType<typeof sql>;
  note?: string;
}> = [
  {
    id: "unlinked-payments",
    title: "Payments with no interest period on a multi-interest allocation",
    query: sql`
      select rp.id, li.loan_id, rp.amount
      from received_payments rp
      join loan_investors li on li.id = rp.loan_investor_id
      join loans l on l.id = li.loan_id
      where rp.interest_period_id is null
        and rp.deleted_at is null
        and li.deleted_at is null
        and l.deleted_at is null
        and li.has_multiple_interest = true
      order by rp.id`,
    note: "Allowed. Unlinked payments are applied to interest then principal.",
  },
  {
    id: "receiptless-created-payments",
    title: "Receipt-less payments matching a period amount and due date",
    query: sql`
      with base as (
        select li.id as li_id, li.loan_id, li.amount::numeric as li_amount,
               sum(li.amount::numeric) over (partition by li.loan_id) as loan_total
        from loan_investors li
        join loans l on l.id = li.loan_id
        where li.deleted_at is null and l.deleted_at is null
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
      where rp.deleted_at is null
        and coalesce(jsonb_array_length(rp.receipts), 0) = 0
        and rp.receipt_image_url is null
        and abs(rp.amount::numeric - e.expected) <= 0.02
        and rp.received_date::date = e.due_date::date
      order by rp.id`,
    note: "Likely created by the removed fix-received-payments button.",
  },
  {
    id: "completed-underpaid",
    title: "Completed periods below their expected interest",
    query: sql`
      with base as (
        select li.id as li_id, li.amount::numeric as li_amount,
               sum(li.amount::numeric) over (partition by li.loan_id) as loan_total
        from loan_investors li
        join loans l on l.id = li.loan_id
        where li.deleted_at is null and l.deleted_at is null
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
        where interest_period_id is not null and deleted_at is null
        group by interest_period_id
      )
      select e.period_id, e.loan_id, e.expected, coalesce(l.paid, 0) as paid
      from expected e
      left join linked l on l.interest_period_id = e.period_id
      where e.status = 'Completed' and coalesce(l.paid, 0) + 0.02 < e.expected
      order by e.period_id`,
  },
  {
    id: "loan-zero-allocations",
    title: "Loans with no allocations",
    query: sql`
      select l.id, l.status
      from loans l
      left join loan_investors li on li.loan_id = l.id and li.deleted_at is null
      where l.deleted_at is null and li.id is null
      order by l.id`,
  },
  {
    id: "zero-capital-fixed",
    title: "Zero-capital allocations stored as fixed",
    query: sql`
      select li.id, li.loan_id, li.interest_rate
      from loan_investors li
      where li.deleted_at is null and li.amount::numeric = 0
        and li.interest_type = 'fixed'
      order by li.id`,
    note: "Agent allocations converted to a peso amount at save (CALC-10).",
  },
  {
    id: "duplicate-period-dates",
    title: "Duplicate period dates on one allocation",
    query: sql`
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
    query: sql`
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
    query: sql`
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
    id: "completed-with-balance",
    title: "Completed loans with money still outstanding",
    query: sql`
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
    id: "debts-orphan-periods",
    title: "Debt periods outside the debt term",
    query: sql`
      select dip.id, dip.debt_id, dip.due_date
      from debt_interest_periods dip
      join debts d on d.id = dip.debt_id
      where d.deleted_at is null
        and dip.due_date > (d.date + (d.duration_months || ' months')::interval) + interval '31 days'
      order by dip.id`,
  },
];

export async function runMoneyHealthChecks(): Promise<MoneyHealthCheck[]> {
  const results: MoneyHealthCheck[] = [];
  for (const check of checks) {
    const rows = (await db.execute(check.query)) as unknown as Row[];
    results.push({
      id: check.id,
      title: check.title,
      count: rows.length,
      sample: rows.slice(0, 10),
      note: check.note,
    });
  }
  return results;
}
