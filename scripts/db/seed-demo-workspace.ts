/**
 * Synthetic demo workspace for assistant evals, integration tests, screenshots,
 * and the portfolio case study. Never real borrower data.
 *
 * Idempotent: removes the demo users (cascading their rows) and re-creates them.
 * Refuses any Neon URL. Local Postgres only.
 *
 *   bun scripts/db/seed-demo-workspace.ts
 *   DATABASE_URL=postgresql://…/demo bun scripts/db/seed-demo-workspace.ts
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

function envValue(key: string): string | undefined {
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split("\n")) {
      if (line.startsWith(`${key}=`))
        return line.slice(key.length + 1).replace(/^"|"$/g, "");
    }
  } catch {
    // no .env.local
  }
  return undefined;
}

const url = process.env.DATABASE_URL ?? envValue("DATABASE_URL");
if (!url) throw new Error("Set DATABASE_URL to a local Postgres database.");
if (/neon\.tech/i.test(url)) {
  throw new Error("Refusing to seed a Neon database. Use local Postgres only.");
}

const sql = postgres(url, { max: 1 });
const OWNER = "demo-owner";
const INVESTOR_USER = "demo-investor";
const BORROWER_USER = "demo-borrower";
const WITNESS_USER = "demo-witness";

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);

await sql.begin(async (tx) => {
  await tx`delete from "user" where id in (${OWNER}, ${INVESTOR_USER}, ${BORROWER_USER}, ${WITNESS_USER})`;

  await tx`
    insert into "user" (id, name, email, role) values
      (${OWNER}, 'Camille Owner', 'demo.owner@kamelends.local', 'admin'),
      (${INVESTOR_USER}, 'Elena Torres', 'demo.investor@kamelends.local', 'investor'),
      (${BORROWER_USER}, 'Maria Santos', 'demo.borrower@kamelends.local', 'borrower'),
      (${WITNESS_USER}, 'Paolo Reyes', 'demo.witness@kamelends.local', 'witness')
  `;

  const borrowerRows = await tx`
    insert into borrowers (user_id, borrower_user_id, name, email, contact_number, address, notes) values
      (${OWNER}, ${BORROWER_USER}, 'Maria Santos', 'demo.borrower@kamelends.local', '09170000001', 'Quezon City', 'Long-time borrower'),
      (${OWNER}, null, 'Juan Dela Cruz', 'juan@example.test', '09170000002', 'Makati', null),
      (${OWNER}, null, 'Ana Reyes', 'ana@example.test', '09170000003', 'Pasig', null),
      (${OWNER}, null, 'Pedro Lim', 'pedro@example.test', '09170000004', 'Cebu', null),
      (${OWNER}, null, 'Liza Cruz', 'liza@example.test', '09170000005', 'Davao', null),
      (${OWNER}, null, 'Rosa Garcia', 'rosa@example.test', '09170000006', 'Baguio', null)
    returning id, name
  `;
  const borrower = (name: string) =>
    borrowerRows.find((row) => row.name === name)!.id as number;

  const investorRows = await tx`
    insert into investors (user_id, investor_user_id, name, email, contact_number) values
      (${OWNER}, ${OWNER}, 'Kame Capital', 'demo.owner@kamelends.local', '09180000001'),
      (${OWNER}, ${INVESTOR_USER}, 'Elena Torres', 'demo.investor@kamelends.local', '09180000002'),
      (${OWNER}, null, 'Marco Silva', 'marco@example.test', '09180000003'),
      (${OWNER}, null, 'Nina Bautista', 'nina@example.test', '09180000004')
    returning id, name
  `;
  const investor = (name: string) =>
    investorRows.find((row) => row.name === name)!.id as number;

  const witnessRows = await tx`
    insert into witnesses (user_id, witness_user_id, name, email) values
      (${OWNER}, ${WITNESS_USER}, 'Paolo Reyes', 'demo.witness@kamelends.local'),
      (${OWNER}, null, 'Grace Villanueva', 'grace@example.test')
    returning id, name
  `;
  const witness = (name: string) =>
    witnessRows.find((row) => row.name === name)!.id as number;

  type Allocation = {
    investor: string;
    amount: number;
    rate: number;
    type?: "rate" | "fixed";
    paid?: boolean;
    periods?: Array<{ due: string; rate: number; type?: "rate" | "fixed" }>;
    payments?: Array<{ amount: number; date: string; period?: number }>;
  };
  type Loan = {
    name: string;
    borrower: string;
    type: "Lot Title" | "OR/CR" | "Agent";
    status: "Partially Funded" | "Fully Funded" | "Overdue" | "Completed";
    due: string;
    allocations: Allocation[];
    witnesses?: string[];
    completed?: string;
    waived?: number;
  };

  const loans: Loan[] = [
    {
      name: "Lot Title · Maria Santos",
      borrower: "Maria Santos",
      type: "Lot Title",
      status: "Fully Funded",
      due: "2026-12-05",
      witnesses: ["Paolo Reyes"],
      allocations: [
        {
          investor: "Kame Capital",
          amount: 300_000,
          rate: 4,
          periods: [
            { due: "2026-09-05", rate: 4 },
            { due: "2026-10-05", rate: 4 },
            { due: "2026-11-05", rate: 4 },
          ],
          payments: [
            { amount: 12_000, date: "2026-09-04", period: 0 },
            { amount: 50_000, date: "2026-10-20" },
          ],
        },
        { investor: "Elena Torres", amount: 200_000, rate: 4 },
      ],
    },
    {
      name: "OR/CR · Juan Dela Cruz",
      borrower: "Juan Dela Cruz",
      type: "OR/CR",
      status: "Completed",
      due: "2026-03-01",
      completed: "2026-03-02",
      allocations: [
        {
          investor: "Marco Silva",
          amount: 300_000,
          rate: 3,
          periods: [
            { due: "2026-01-01", rate: 3 },
            { due: "2026-03-01", rate: 3 },
          ],
          payments: [{ amount: 318_000, date: "2026-03-01" }],
        },
      ],
    },
    {
      name: "Agent · Ana Reyes",
      borrower: "Ana Reyes",
      type: "Agent",
      status: "Partially Funded",
      due: "2027-01-15",
      allocations: [
        { investor: "Marco Silva", amount: 120_000, rate: 3, paid: false },
      ],
    },
    {
      name: "Lot Title · Pedro Lim",
      borrower: "Pedro Lim",
      type: "Lot Title",
      status: "Overdue",
      due: "2026-10-01",
      allocations: [
        {
          investor: "Kame Capital",
          amount: 250_000,
          rate: 3,
          payments: [{ amount: 20_000, date: "2026-10-15" }],
        },
      ],
    },
    {
      name: "Agent · Liza Cruz",
      borrower: "Liza Cruz",
      type: "Agent",
      status: "Fully Funded",
      due: "2026-12-20",
      allocations: [
        { investor: "Kame Capital", amount: 0, rate: 0 },
        { investor: "Marco Silva", amount: 120_000, rate: 3 },
      ],
    },
    {
      name: "Agent · Rosa Garcia",
      borrower: "Rosa Garcia",
      type: "Agent",
      status: "Fully Funded",
      due: "2026-11-30",
      allocations: [{ investor: "Nina Bautista", amount: 80_000, rate: 2.5 }],
    },
    {
      name: "Lot Title · Maria Santos (fixed)",
      borrower: "Maria Santos",
      type: "Lot Title",
      status: "Fully Funded",
      due: "2026-12-15",
      allocations: [
        {
          investor: "Kame Capital",
          amount: 100_000,
          rate: 20_000,
          type: "fixed",
          payments: [{ amount: 30_000, date: "2026-10-01" }],
        },
      ],
    },
    {
      name: "OR/CR · Juan Dela Cruz (overpaid)",
      borrower: "Juan Dela Cruz",
      type: "OR/CR",
      status: "Completed",
      due: "2026-09-01",
      completed: "2026-09-02",
      allocations: [
        {
          investor: "Elena Torres",
          amount: 200_000,
          rate: 2,
          payments: [{ amount: 220_000, date: "2026-09-01" }],
        },
      ],
    },
    {
      name: "Agent · Ana Reyes (waived)",
      borrower: "Ana Reyes",
      type: "Agent",
      status: "Fully Funded",
      due: "2026-11-25",
      waived: 10_000,
      allocations: [{ investor: "Nina Bautista", amount: 90_000, rate: 3 }],
    },
    {
      name: "Lot Title · Pedro Lim (due today)",
      borrower: "Pedro Lim",
      type: "Lot Title",
      status: "Fully Funded",
      due: "2026-11-21",
      allocations: [{ investor: "Kame Capital", amount: 150_000, rate: 3 }],
    },
    {
      name: "OR/CR · Liza Cruz (multi-period)",
      borrower: "Liza Cruz",
      type: "OR/CR",
      status: "Fully Funded",
      due: "2027-03-01",
      witnesses: ["Grace Villanueva"],
      allocations: [
        {
          investor: "Kame Capital",
          amount: 180_000,
          rate: 2.5,
          periods: [
            { due: "2026-10-01", rate: 2.5 },
            { due: "2026-11-01", rate: 2.5 },
            { due: "2026-12-01", rate: 2.5 },
            { due: "2027-01-01", rate: 2.5 },
            { due: "2027-02-01", rate: 2.5 },
            { due: "2027-03-01", rate: 2.5 },
          ],
          payments: [
            { amount: 4_500, date: "2026-10-01", period: 0 },
            { amount: 4_500, date: "2026-11-01", period: 1 },
          ],
        },
      ],
    },
    {
      name: "Agent · Rosa Garcia (overdue)",
      borrower: "Rosa Garcia",
      type: "Agent",
      status: "Overdue",
      due: "2026-08-01",
      allocations: [{ investor: "Marco Silva", amount: 150_000, rate: 3 }],
    },
  ];

  const loanIds: number[] = [];
  for (const loan of loans) {
    const [row] = await tx`
      insert into loans (user_id, borrower_id, loan_name, type, status, due_date, created_at, updated_at, completed_at, waived_amount)
      values (${OWNER}, ${borrower(loan.borrower)}, ${loan.name}, ${loan.type}, ${loan.status}, ${d(loan.due)}, ${d("2026-06-01")}, ${d("2026-06-01")}, ${loan.completed ? d(loan.completed) : null}, ${loan.waived ?? null})
      returning id
    `;
    const loanId = row.id as number;
    loanIds.push(loanId);

    for (const allocation of loan.allocations) {
      const [alloc] = await tx`
        insert into loan_investors (loan_id, investor_id, amount, interest_rate, interest_type, sent_date, is_paid, has_multiple_interest, created_at, updated_at)
        values (${loanId}, ${investor(allocation.investor)}, ${allocation.amount}, ${allocation.rate}, ${allocation.type ?? "rate"}, ${d("2026-06-01")}, ${allocation.paid ?? true}, ${Boolean(allocation.periods?.length)}, ${d("2026-06-01")}, ${d("2026-06-01")})
        returning id
      `;
      const allocationId = alloc.id as number;
      const periodIds: number[] = [];
      for (const period of allocation.periods ?? []) {
        const [periodRow] = await tx`
          insert into interest_periods (loan_investor_id, due_date, interest_rate, interest_type, status, created_at, updated_at)
          values (${allocationId}, ${d(period.due)}, ${period.rate}, ${period.type ?? "rate"}, 'Pending', ${d("2026-06-01")}, ${d("2026-06-01")})
          returning id
        `;
        periodIds.push(periodRow.id as number);
      }
      for (const payment of allocation.payments ?? []) {
        const periodId =
          payment.period === undefined
            ? null
            : (periodIds[payment.period] ?? null);
        await tx`
          insert into received_payments (loan_investor_id, interest_period_id, amount, received_date, created_at, updated_at)
          values (${allocationId}, ${periodId}, ${payment.amount}, ${d(payment.date)}, ${d(payment.date)}, ${d(payment.date)})
        `;
      }
    }

    for (const name of loan.witnesses ?? []) {
      await tx`
        insert into loan_witnesses (loan_id, witness_id, profit_type, profit_value)
        values (${loanId}, ${witness(name)}, 'rate', 0)
      `;
    }
  }

  // Private commission for the owner on the first loan only.
  await tx`
    insert into loan_user_commissions (loan_id, user_id, profit_type, profit_value)
    values (${loanIds[0]}, ${OWNER}, 'rate', 1)
  `;

  // One bank loan for the owner, funded by Elena.
  const [debt] = await tx`
    insert into debts (user_id, investor_id, name, amount, date, interest_rate, interest_interval, duration_months, additional_fees)
    values (${OWNER}, ${investor("Elena Torres")}, 'Bank of the Islands term loan', 250000, ${d("2026-07-01")}, 1.2, 'Monthly', 12, '[]'::jsonb)
    returning id
  `;
  for (let index = 1; index <= 3; index += 1) {
    await tx`
      insert into debt_interest_periods (debt_id, period_number, due_date, expected_installment, status)
      values (${debt.id}, ${index}, ${d(`2026-0${6 + index}-01`)}, 24800, 'Pending')
    `;
  }

  // One group with the borrower and two loans.
  const [group] = await tx`
    insert into loan_groups (creator_user_id, name, notes, color)
    values (${OWNER}, 'Santos family', 'Synthetic demo group', 'orange')
    returning id
  `;
  await tx`
    insert into loan_group_loans (group_id, loan_id, added_by_user_id, source)
    values (${group.id}, ${loanIds[0]}, ${OWNER}, 'manual'), (${group.id}, ${loanIds[6]}, ${OWNER}, 'manual')
  `;
  await tx`
    insert into loan_group_members (group_id, user_id, party_roles, synced_at)
    values (${group.id}, ${OWNER}, '{owner}'::text[], now()), (${group.id}, ${BORROWER_USER}, '{borrower}'::text[], now())
  `;

  // A second group for a pure group viewer (the witness account).
  const [shared] = await tx`
    insert into loan_groups (creator_user_id, name, notes, color)
    values (${OWNER}, 'Witness shared set', 'Synthetic demo group for group viewing', 'purple')
    returning id
  `;
  await tx`
    insert into loan_group_loans (group_id, loan_id, added_by_user_id, source)
    values (${shared.id}, ${loanIds[10]}, ${OWNER}, 'manual')
  `;
  await tx`
    insert into loan_group_members (group_id, user_id, party_roles, synced_at)
    values (${shared.id}, ${WITNESS_USER}, '{witness}'::text[], now())
  `;
});

const counts = await sql`
  select
    (select count(*) from loans where user_id = ${OWNER})::int as loans,
    (select count(*) from loan_investors li join loans l on l.id = li.loan_id where l.user_id = ${OWNER})::int as allocations,
    (select count(*) from received_payments rp join loan_investors li on li.id = rp.loan_investor_id join loans l on l.id = li.loan_id where l.user_id = ${OWNER})::int as payments
`;
console.log("Demo workspace ready:", counts[0]);
console.log(
  "Owner: demo.owner@kamelends.local (sign in with the dev auth path)",
);
await sql.end();
