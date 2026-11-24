# Money model

Source of truth for every amount, date, and status in Kame Lends. Code lives in
`src/lib/money/` and `src/lib/dates/`. If a screen or API disagrees with this
document, the screen or API is wrong.

Last updated: 2026-11-13.

## Units

- Money is stored in the database as `decimal(15, 2)`.
- In code, the engine works in **integer centavos** (`src/lib/money/centavos.ts`).
  A JS number is exact for integers up to 2^53 (about ₱90 trillion), so no
  decimal library is needed.
- Every rate multiplication rounds **once, half-up, to the nearest centavo**
  (D-3). Totals are sums of already-rounded parts. There is no tolerance:
  `AMOUNT_TOLERANCE_CENTAVOS = 0`.

## Entities

| Term                 | Meaning                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Loan                 | The borrower's obligation. One due date.                                                                        |
| Allocation / tranche | One `loan_investors` row: an investor's money for this loan. An investor may have several tranches in one loan. |
| Investor capital     | Sum of that investor's allocation amounts **within one loan**.                                                  |
| Interest period      | A dated interest row for one investor's schedule (`interest_periods`).                                          |
| Rate period          | `interest_type = rate`; the value is a percent.                                                                 |
| Fixed period         | `interest_type = fixed`; the value is a peso amount.                                                            |
| Agent / zero capital | An allocation with amount `0`. Its rate applies to the **loan principal** (D-1).                                |
| Received payment     | Money the borrower paid back (`received_payments`). Optionally linked to one period.                            |
| Interest collected   | Cash received that has been allocated to interest (D-6, D-14).                                                  |
| Interest expected    | Scheduled interest on every loan, open or completed.                                                            |
| Balance              | `principal + interest expected − received`, per investor and per loan.                                          |

## Formulas

All amounts are centavos.

### Period interest

```
investorCapital = Σ allocation.amount for this investor in this loan
base            = investorCapital > 0 ? investorCapital : loanPrincipal
ratePeriod      = roundHalfUp(base × ratePercent / 100)
fixedPeriod     = toCentavos(period value)          // charged once per investor
```

This is D-1 and D-4. A zero-capital agent earns on the whole loan principal.
A fixed amount is never multiplied by the number of tranches (D-5).

### Single-interest investor (no periods)

```
for each tranche:
  base      = tranche.amount > 0 ? tranche.amount : loanPrincipal
  interest += rate ? roundHalfUp(base × rate / 100) : fixed amount
```

### Payments

```
linked(period)   = Σ payments where interest_period_id = period.id
unlinked         = Σ payments with no period (oldest interest first, D-14)
periodPaid       = linked + allocated unlinked
interestPaid     = Σ min(periodPaid, expected)
principalPaid    = max(received − interestPaid, 0)
```

A payment with no period is **not** junk. It is applied to the oldest open
interest and then to principal (D-13). No automatic job may delete it.

### Balance and status

```
due      = Σ (principal + interest expected)
received = Σ all payments
balance  = due − received
overdue  =
  Σ remaining interest of periods whose due date is before today
  + unpaid principal when the loan due date is before today
```

Status (`src/lib/money/status.ts`), in order:

1. Manual override (only `Completed`, with a reason) wins (D-7).
2. `balance <= 0` → `Completed`.
3. `overdue > 0` → `Overdue`.
4. Any allocation `is_paid = false` → `Partially Funded`.
5. Otherwise → `Fully Funded`.

A loan is **never** `Completed` while principal is outstanding (STAT-03).

## Dates and timezone

- Business timezone: `Asia/Manila` (D-2).
- Date-only fields (loan due date, sent date, period due date, received date,
  debt date) are stored at UTC midnight of the business date.
- `toDateKey()` reads every timestamp in Manila; a stored UTC-midnight value and
  a local-midnight value resolve to the same day.
- `todayKey()` is today in Manila. Forms use it instead of
  `toLocalDateString(new Date())`.
- **Overdue starts the day after the due date.** `2026-03-31` is not overdue on
  `2026-03-31`; it is overdue on `2026-04-01`.
- Month math clamps to the last day: Jan 31 + 2 months = Mar 31, not Mar 3.
  `formatDurationBetweenKeys("2026-01-31", "2026-03-31")` = `2 Months`.

## Decisions D-1 … D-14

| ID   | Decision                                                                                | Implemented in                                            |
| ---- | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| D-1  | Agent interest is part of the borrower's total and uses the loan principal as its base. | `ledger.ts` (base fallback)                               |
| D-2  | Overdue is the day after the due date, in Asia/Manila.                                  | `dates/business-date.ts` `isAfterDueDate`                 |
| D-3  | Round each period's interest once, half-up, to the centavo; sum rounded parts.          | `money/centavos.ts`                                       |
| D-4  | A multi-period rate uses the investor's total disbursed capital for that loan.          | `ledger.ts`                                               |
| D-5  | A fixed period amount is charged once per investor per period.                          | `ledger.ts` (`fixedPeriod`)                               |
| D-6  | Report **interest collected** and **interest expected** separately.                     | `loan-list-summary.ts`, dashboard labels                  |
| D-7  | Manual completion requires a reason; store the waived amount.                           | `loans.status_override`, `status_reason`, `waived_amount` |
| D-8  | Deletes are soft (`deleted_at`); restore is available.                                  | migration `0039_money_integrity.sql`                      |
| D-9  | First debt installment is one interval after the debt date.                             | `debt-calculations.ts`                                    |
| D-10 | Reverting a paid period never deletes payments; delete the payment explicitly.          | `interest-periods/[id]/+server.ts`                        |
| D-11 | Extend interest is removed; a proper Extend term action is planned separately.          | route deleted                                             |
| D-12 | Settings repair buttons are removed; a read-only Data health card replaces them.        | `routes/settings`, `api/admin/money-health`               |
| D-13 | An unlinked payment is allowed and treated as principal/unallocated, never deleted.     | `ledger.ts`                                               |
| D-15 | Data health status drift uses the ledger rule, not raw SQL per-allocation interest.     | `money/status-drift.ts`, `server/status-drift.ts`         |
| D-14 | Payments apply to the oldest open interest first, then principal.                       | `ledger.ts`                                               |

## Invariants

1. Sum of due rows + interest rows for a loan equals `principal + interest expected`.
2. `received` is the sum of payment rows; no screen may invent a payment.
3. Period status is derived from linked payments, never trusted from the DB.
4. Moving "today" one day forward can only move a loan from funded to overdue,
   never the reverse, unless payments change.
5. Reordering tranches or periods does not change totals.
6. A loan's two schedules are never merged with another loan's (CALC-02).
7. Every money mutation writes a `money_audit_events` row.
8. Every write that touches more than one money table runs in `db.transaction`.
9. A loan edit matches rows by id. It never re-creates a payment or a period,
   never revives a soft-deleted row, and refuses a stale id (409) instead of
   inserting a duplicate.
10. Removing an investor from the edit form soft-deletes their disbursement,
    its periods, and (only with `confirmRemovals`) their payments. Nothing is
    left active for a row the form no longer shows.
11. A removed disbursement never keeps a schedule behind; the debt sync keeps
    periods that still have payment history instead of cascading it away.

## Where to change things

- New money logic: `src/lib/money/ledger.ts` only.
- New dates: `src/lib/dates/business-date.ts` only.
- New API money route: validate with `src/lib/schemas/`, read totals from
  `loadLoanLedger`, write in a transaction, and call `recordMoneyAudit`.
- Never re-implement interest in a component, PDF, CSV, Telegram message, or
  calendar event.
- The AI assistant (`src/lib/server/ai/tools/`) reads this engine through
  `buildLoanLedger`, `sumLedgers`, and `investorLedger`. It must never
  re-implement a definition. `bun run check:ai-tools` keeps it read-only.

## Known repairs

`bun run db:health:money` is read-only and reports anomalies. The 2026-11-13
snapshot of production showed receipt-less payments created by the removed
repair button, unlinked principal payments, zero-capital allocations stored as
fixed, and duplicate period dates. See Phase 8 of
`docs/workflow/planned/full-app-audit-and-money-correctness.md`.
