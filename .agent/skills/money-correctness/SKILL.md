---
name: money-correctness
description: "Use for any change that touches loans, interest, payments, balances, status, reports, PDFs, CSV, calendar, Telegram, or push amounts."
---

# Money correctness

Read [`docs/architecture/money-model.md`](../../../docs/architecture/money-model.md) first.

## Rules

1. **One engine.** All amounts come from `buildLoanLedger()` in `src/lib/money/ledger.ts`. Never write an interest formula in a component, route, PDF, CSV, calendar event, Telegram message, or reminder.
2. **Centavos.** Use `src/lib/money/centavos.ts`. Parse decimal strings once with `toCentavos`, multiply rates with `mulRate`, and format with `formatPHP`. No `toFixed` money math and no `0.02` tolerances.
3. **Group by loan, then investor.** Two loans for one investor never share a schedule.
4. **Status is derived.** Use `src/lib/money/status.ts`. Overdue starts the day after the due date in Asia/Manila. Only a manual `Completed` override is allowed, and it needs a reason.
5. **Dates.** Use `src/lib/dates/business-date.ts`. Forms use `todayKey()`, not `new Date()` or `toLocalDateString(new Date())`.
6. **Persistence.** Money writes run in `db.transaction`. Never delete-and-recreate rows that payments reference. Match by stable id. Soft delete (`deleted_at`) instead of hard delete. Write `recordMoneyAudit(tx, …)` for every money mutation.
7. **Validation.** Mutating routes parse bodies with a schema in `src/lib/schemas/`. Ignore client-supplied status and totals. Use `parseIdParam` and `publicJsonError`.

## Required tests

- A golden case in `src/lib/money/__fixtures__/` or `ledger.test.ts` for the new behavior.
- Property test when an invariant is involved (`ledger.property.test.ts`).
- Timezone matrix when dates are involved: `bun run test:unit:tz`.
- Reconciliation: list, card, detail, PDF data, CSV, calendar, and message all get the same ledger value.

## Review checklist

- [ ] No new interest formula outside `src/lib/money/`.
- [ ] New route uses a schema, a transaction, an audit event, and a derived status.
- [ ] Overdue uses "day after", not "on the due date".
- [ ] Money displays go through `formatCurrency` / `formatPHP` so price masking and `₱NaN` guards apply.
- [ ] `bun run check && bun run test:unit` green.
