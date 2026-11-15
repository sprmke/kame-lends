---
title: "Full app audit and money correctness"
status: in-progress
tags:
  [
    audit,
    money,
    loans,
    interest,
    testing,
    qa,
    ux,
    pwa,
    security,
    data-integrity,
  ]
updated: 2026-11-13
stage: in-progress
kind: plan
---

# Full app audit and money correctness

## Goal

Make every number Kame Lends shows or stores correct, consistent across screens, and protected from data loss. Then review every page, flow, and feature for usability, speed, PWA behavior, security, and code health. This plan has two parts: **confirmed findings** from a code audit on 2026-11-13, and an **ordered task list** that fixes them and adds the tests that keep them fixed. Work starts with Phase 0 (stop data loss). After that, each finding is closed one by one through the tracker below.

## Scope

**In scope**

- Money math: loans, multi-investor allocations, tranches, interest periods (single and multiple), fixed vs rate interest, zero-capital (agent) investors, received payments, balances, overdue amounts, debts, and commissions.
- Persistence: loan create/edit/delete, payment record/edit/delete/revert/consolidate, status changes, and the Settings repair endpoints.
- Status lifecycle: Partially Funded → Fully Funded → Overdue → Completed.
- Dates and timezones.
- Every route and section: dashboard, lists, details, forms, party portals (`/investments`, `/borrowed`, `/witnessed`, `/commissioned`), groups, signing, settings, landing, and error pages.
- Integrations: Google Calendar, Telegram, Web Push, email, PDF/CSV export, AI receipt scanning.
- PWA (install, offline, update, push), mobile shell, performance, accessibility, security and privacy, and testing infrastructure.
- Repairing existing production data that past bugs already damaged.

**Out of scope**

- New product features not needed to fix a finding. Examples: receipts for debt payments, the AI usage dashboard. Those stay in `_to-plan.md`.
- Items already tracked in [`production-readiness-and-optimization.md`](./production-readiness-and-optimization.md). This plan links to that plan and does not repeat them.
- Visual redesign. UX fixes here target correctness and clarity.

## How the audit was done (roles)

The audit read the code from several viewpoints:

| Role                          | What was checked                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Developer                     | Money modules, API routes, persistence, reactivity in forms, dead code, duplication                |
| QA                            | Edge cases (multi-tranche, multi-period, fixed, zero capital, month-end, timezones), failure paths |
| Finance / auditor             | Whether totals reconcile, whether money records can be lost or made up, audit trail                |
| Product manager               | Metric definitions (Interest Earned, Overdue), feature completeness (extend interest), dead UI     |
| Admin user (owner)            | Create/edit loan with multiple interests, record and revert payments, Settings repair buttons      |
| Investor / borrower / witness | Portal numbers, read-only rules, signing                                                           |
| Security                      | Validation, authorization consistency, error leaks, idempotency                                    |
| SRE                           | Transactions, cron coverage, cache staleness, N+1 queries                                          |
| Mobile / PWA / a11y           | Offline staleness, price-visibility masking, labels, confirm dialogs                               |

**Evidence levels:** ✅ **probe** = reproduced with a throwaway Vitest probe (TZ=Asia/Manila and TZ=UTC). ✅ **code** = confirmed by reading the code path end to end. 🔍 **verify** = suspected; confirm during the page audit (Phase 9).

**Severity:** **S1** money or data loss/corruption · **S2** wrong numbers or status shown/stored · **S3** inconsistency, edge case, or risky design · **S4** polish or cleanup.

---

## Findings tracker

Close each row when its task merges with tests. Set **Status** to `open`, `in-progress`, `fixed`, or `wont-fix` (with reason).

| ID      | Sev | Evidence | Title                                                                                       | Task(s)        | Status  |
| ------- | --- | -------- | ------------------------------------------------------------------------------------------- | -------------- | ------- |
| DATA-01 | S1  | code     | Loan edit deletes and re-creates allocations, periods, and payments; links are lost         | T0.5, T3.2     | fixed   |
| DATA-02 | S1  | code     | Loan create/edit has no DB transaction; a mid-way failure loses data                        | T0.4           | fixed   |
| DATA-03 | S1  | code     | An empty interest-period rate reaches the DB and fails after rows were deleted              | T0.6, T3.1     | fixed   |
| DATA-04 | S1  | code     | Settings "Fix received payments" makes up payments and deletes real ones                    | T0.2, T8.x     | fixed   |
| DATA-05 | S1  | code     | Reverting a period deletes payments, falling back to an unrelated payment                   | T0.3           | fixed   |
| DATA-06 | S2  | code     | Consolidate payment deletes all of a period's payments then inserts one, no transaction     | T0.7           | fixed   |
| DATA-07 | S2  | code     | No audit trail for money changes; hard deletes cascade                                      | T3.4, T3.5     | fixed   |
| DATA-08 | S3  | code     | Server trusts loan status sent by the client                                                | T3.3           | fixed   |
| DATA-09 | S3  | verify   | No idempotency or double-submit protection on create/payment endpoints                      | T3.6           | fixed   |
| DATA-10 | S3  | code     | No DB CHECK constraints or unique period dates                                              | T3.7           | fixed   |
| DATA-11 | S1  | code     | Removing an investor on the edit form left their disbursement, periods, and payments active | T3.2           | fixed   |
| DATA-12 | S2  | code     | Edit reconcile matched soft-deleted rows and inserted a duplicate on a stale id             | T3.2           | fixed   |
| DATA-13 | S2  | code     | Debt schedule edit and debt consolidate hard-deleted payment history                        | T3.5, T2.9     | fixed   |
| DATA-14 | S2  | code     | Status sweep counted soft-deleted loans and allocations                                     | T5.1, T5.2     | fixed   |
| DATA-15 | S2  | code     | Data health status checks used the allocation base and ignored unlinked money               | T8.4           | fixed   |
| CALC-01 | S2  | code     | Period interest base differs: one tranche vs the investor's total capital                   | T2.4           | fixed   |
| CALC-02 | S2  | probe    | Investor totals merge all of an investor's loans into one group (18,000 vs 26,000)          | T2.5, T7.3     | fixed   |
| CALC-03 | S2  | probe    | Floating-point money with no rounding policy; tolerance constants copied everywhere         | T2.1           | fixed   |
| CALC-04 | S2  | code     | 8+ separate interest/total formulas across UI, lib, and API                                 | T2.2–T2.8      | fixed   |
| CALC-05 | S2  | code     | Loan form preview and validation use different math than the saved loan                     | T2.8           | fixed   |
| CALC-06 | S3  | code     | Overdue amount ignores partial payments and counts full Incomplete interest                 | T2.2           | fixed   |
| CALC-07 | S3  | probe    | Loan duration miscounts month ends (Jan 31→Mar 31 = "1 Month, 4 Weeks")                     | T2.6           | fixed   |
| CALC-08 | S3  | code     | `calculateAverageRate` docstring and code disagree on fixed interest                        | T2.2           | fixed   |
| CALC-09 | S3  | code     | `calculateInvestorStats` mutates input, counts rows not loans, misnames total               | T2.5           | fixed   |
| CALC-10 | S3  | code     | Zero-capital (agent) interest stored two different ways; stale after principal edits        | D-1, T4.6      | fixed   |
| CALC-11 | S4  | code     | Unused money functions (incl. hard-coded balance thresholds)                                | T13.1          | fixed   |
| FORM-01 | S1  | code     | Interest editor keeps a private copy of periods; screen and saved data drift apart          | T4.2           | fixed   |
| FORM-02 | S1  | code     | Create mode flips into "edit mode" once periods sync; auto-generation stops                 | T4.1, T4.2     | fixed   |
| FORM-03 | S1  | probe    | Generated period dates are one day early in Philippine time                                 | T4.3, T6.1     | fixed   |
| FORM-04 | S2  | code     | "Final" period is picked by array position, not date; no date-order validation              | T4.1           | fixed   |
| FORM-05 | S2  | code     | "Add Period" creates a period due on the disbursement date                                  | T4.1           | fixed   |
| FORM-06 | S2  | code     | Silent 10% interest defaults; fixed type defaults to an empty amount                        | T4.4           | fixed   |
| FORM-07 | S3  | code     | Duplicate-date guard leaves the rejected date in the input                                  | T4.2           | fixed   |
| FORM-08 | S3  | code     | Single-mode summary shows "Rate %" for fixed; raw amounts bypass price masking              | T4.2, T11.3    | fixed   |
| FORM-09 | S3  | code     | Switching a period Rate↔Fixed drops the value; totals silently become 0                     | T4.1           | fixed   |
| FORM-10 | S2  | code     | Paid periods editable with no warning; status resets to Pending on save                     | T3.2, T4.2     | fixed   |
| FORM-11 | S2  | code     | Validation gaps (date order, NaN, bounds); a new loan can save already "Overdue"            | T4.5, T3.1     | fixed   |
| FORM-12 | S3  | code     | "Copy investor config" also copies received payments and receipt images                     | T4.7           | fixed   |
| FORM-13 | S3  | code     | Groups saved twice on create; edit ignores group save errors                                | T4.8           | fixed   |
| FORM-14 | S3  | verify   | No unsaved-changes guard on the loan form                                                   | T4.8           | fixed   |
| FORM-15 | S4  | code     | Contract PDF auto-downloads after every loan create                                         | T4.8           | fixed   |
| STAT-01 | S2  | code     | Overdue is computed only when someone opens the dashboard; no status cron                   | T5.2           | fixed   |
| STAT-02 | S2  | code     | 7 places set status with different rules (on vs after the due date)                         | D-2, T5.1      | fixed   |
| STAT-03 | S2  | code     | Loan marked Completed when all periods are paid even if principal is not                    | T5.1           | fixed   |
| STAT-04 | S2  | code     | Partially Funded loans never become Overdue                                                 | T5.1, T5.3     | fixed   |
| STAT-05 | S3  | code     | New disbursement leaves a Completed loan Completed; pay-transaction overwrites date         | T5.3           | fixed   |
| STAT-06 | S3  | code     | Status endpoint accepts any status and always posts "loan completed"                        | T5.3           | fixed   |
| STAT-07 | S3  | code     | Extend-interest API has no UI caller and forces Overdue                                     | D-11, T5.4     | fixed   |
| STAT-08 | S4  | code     | Loan GET fixes status during a read (masks root causes)                                     | T5.1           | fixed   |
| DATE-01 | S2  | code     | No business-timezone policy (Manila vs UTC vs device-local mixed)                           | T6.1           | fixed   |
| DATE-02 | S2  | code     | "Today" defaults use UTC; 00:00–07:59 PH pre-fills yesterday                                | T6.1, T6.2     | fixed   |
| DATE-03 | S3  | code     | Date-only fields stored as timestamps; mixed writers (midnight vs now)                      | T6.4, T6.5     | partial |
| DATE-04 | S3  | code     | `formatDate*` uses the runtime timezone (SSR/PDF vs browser)                                | T6.3           | fixed   |
| DATE-05 | S3  | code     | `toLocalDateString` actually returns the UTC date                                           | T6.2           | fixed   |
| API-01  | S2  | code     | 1 of 86 API routes validates bodies with a schema; 24 unchecked `parseInt`                  | T3.1, T11.1    | fixed   |
| API-02  | S3  | code     | 6 routes return raw `error.message` to clients                                              | T3.9           | fixed   |
| API-03  | S3  | code     | Ownership checks differ per route (401 vs 403 vs 404)                                       | T3.10          | fixed   |
| API-04  | S3  | code     | One-click data-repair endpoints exposed in Settings                                         | T0.2, T8.4     | fixed   |
| SEC-01  | S2  | code     | Debt mutation routes accepted view access, so a linked investor could edit or delete        | T11.2          | fixed   |
| COMM-01 | S3  | code     | Per-investor/witness commission endpoints always 403; dead cards; legacy columns read       | T7.5, T13.1    | fixed   |
| DEBT-01 | S2  | code     | First debt installment is due on the borrow date                                            | D-9, T2.9      | fixed   |
| DEBT-02 | S3  | code     | Monthly debt schedule overflows month ends                                                  | T2.9           | fixed   |
| DEBT-03 | S3  | code     | "Completed" debt means term ended, not paid                                                 | T2.9           | fixed   |
| DEBT-04 | S3  | code     | `expected_interest` holds principal + interest; orphan periods kept; N+1                    | T2.9, T13.4    | fixed   |
| RPT-01  | S2  | code     | "Interest Earned" = scheduled interest of Completed loans, not cash collected               | D-6, T7.1      | fixed   |
| RPT-02  | S2  | code     | Capital return date uses `updatedAt`; any edit moves historic capital                       | T3.8, T7.2     | fixed   |
| RPT-03  | S3  | code     | No cross-screen reconciliation; screens disagree for the same loan/investor                 | T7.4           | fixed   |
| RPT-04  | S4  | verify   | Compact currency rounds centavos on cards; `formatCurrency(NaN)` → "₱NaN"                   | T7.1           | fixed   |
| PWA-01  | S3  | verify   | Offline loan data shows no "as of" time                                                     | T10.1          | fixed   |
| PWA-02  | S3  | verify   | Reminders/calendar may read stale status (see STAT-01)                                      | T5.2, T10.1    | fixed   |
| PERF-01 | S3  | code     | check-overdue loads every loan per dashboard visit; per-row UPDATEs; debt N+1               | T5.2, T10.2    | fixed   |
| PERF-02 | S3  | verify   | 45s per-instance cache can show old balances after a payment                                | T10.2          | fixed   |
| PERF-03 | S4  | code     | Very large components (LoanForm 2,161 lines, etc.)                                          | T13.2          | partial |
| TEST-01 | S2  | code     | Money modules barely tested; no tests for interest editor, form, payment APIs               | T12.x          | fixed   |
| TEST-02 | S2  | code     | No DB integration tests; CI E2E runs smoke only; crud-flows not wired                       | T12.2, T12.4   | fixed   |
| TEST-03 | S3  | code     | No timezone matrix, property tests, or coverage gates                                       | T12.1, T12.5–6 | fixed   |
| TEST-04 | S4  | verify   | `visual-parity` project could not run (bad `beforeEach`); dashboard expectations are stale  | T9.3           | partial |
| UX-01   | S3  | code     | Payment delete uses `window.confirm`                                                        | T13.3          | fixed   |
| ARCH-01 | S3  | code     | Loans use delete-and-recreate; debts already use safer reconcile                            | T3.2           | fixed   |
| ARCH-02 | S4  | code     | `loan-domain` skill describes behavior that does not exist                                  | T14.2          | fixed   |

---

## Detailed findings

### A. Data integrity and data loss (fix first)

**DATA-01 · S1 · Loan edit deletes and re-creates every allocation, interest period, and received payment** — ✅ code

- **Evidence:** `src/routes/api/loans/[id]/+server.ts:171` deletes all `loan_investors` for the loan. The cascade (`schema.ts` `interest_periods`, `received_payments` → `onDelete: cascade`) drops all periods and payments. `:282-288` re-inserts payments **without `interestPeriodId`**. `LoanForm.svelte:1211-1221` never sends payment `id` or period links. `:222-243` keeps only `Completed`/`Overdue` period status, so `Incomplete` becomes `Pending`. After the edit, nothing recomputes period status from payments.
- **Impact:** After any edit of a multi-interest loan, every payment is unlinked from its period. All payments move to the investor's first tranche, and every row gets a new ID. Period statuses then disagree with real payments. DATA-04 and DATA-05 then destroy data. This is the most likely root cause of the "weird behavior" when editing loans with multiple interests.
- **Fix:** T0.5 (keep links now), T3.2 (diff-based reconcile inside a transaction).

**DATA-02 · S1 · Create/edit loan runs 5+ writes with no transaction** — ✅ code

- **Evidence:** PUT `+server.ts:139-292`: update loan → delete allocations → insert allocations → insert periods → insert payments. POST `src/routes/api/loans/+server.ts:105-188` does the same. `db.transaction` already works in this codebase (`src/lib/server/group-access.ts:287`, `party-directory.ts:257`).
- **Impact:** Any failure after the delete (bad value, timeout, Neon hiccup) leaves a loan with **no allocations, periods, or payments**. A failed create leaves an orphan loan.
- **Fix:** T0.4.

**DATA-03 · S1 · An empty interest-period value is sent to the DB** — ✅ code

- **Evidence:** Client validation does not check period rate or amount (`LoanForm.svelte:1032-1041`). The payload sends `period.interestAmount`/`interestRate`, which can be `''` (`:1141-1144`). The server does `String(period.interestRate)` (`api/loans/[id]/+server.ts:212`), and Postgres rejects `''` for `decimal`. Fixed-type defaults create periods with an empty amount (`MultipleInterestManager.svelte:53-59` when `defaultInterestType === 'fixed'`).
- **Impact:** Together with DATA-02, clearing one period's value and pressing Save on an existing loan **deletes the loan's allocations and payments**.
- **Fix:** T0.6, T3.1.

**DATA-04 · S1 · "Fix received payments" makes up payments and deletes real ones** — ✅ code

- **Evidence:** `src/routes/api/loans/fix-received-payments/+server.ts`. Step 1 (`:93`) inserts payments with **no receipt**, dated on the period due date, sized from the single tranche, for every Completed period with no linked payment. Step 2 (`:130`) **deletes every payment with `interestPeriodId IS NULL`** for multi-interest investors. The button is in Settings (`FixReceivedPaymentsButton`). `cleanup-orphaned-payments/+server.ts:89,122` repeats the logic (no UI caller).
- **Impact:** After DATA-01, every edited multi-interest loan has only unlinked payments. One click replaces real, receipt-backed payments with made-up ones that have no receipt and may have the wrong amount and date. Legitimate unlinked payments, such as principal repayments recorded without a period, are deleted.
- **Fix:** T0.2 now. Replace with a read-only health report (T8.1, T8.4).

**DATA-05 · S1 · Reverting a period deletes payments, including an unrelated one** — ✅ code

- **Evidence:** `src/routes/api/interest-periods/[id]/+server.ts:194-219`. Setting a Completed/Incomplete period back to Pending/Overdue deletes **all** linked payments. If none are linked (the normal state after DATA-01), it deletes the payment whose amount is close to the expected interest, **or else `existingPayments[0]`** (the newest payment on that tranche, which may be a principal repayment).
- **Fix:** T0.3. Reverting never deletes money. Deleting a payment is its own explicit action.

**DATA-06 · S2 · Consolidate payment wipes a period's payments** — ✅ code

- **Evidence:** `src/routes/api/interest-periods/[id]/consolidate-payment/+server.ts:124-127` deletes all linked payments, then inserts one new row. No transaction. Earlier receipts and notes are lost.
- **Fix:** T0.7 (transaction plus keep receipts), then decide the UX in T4.2.

**DATA-07 · S2 · No audit trail; hard deletes** — ✅ code. No table records who changed which amount, when, or why. Deleting a loan (`api/loans/[id]/+server.ts:424`) cascades all allocations and payments with no restore. **Fix:** T3.4, T3.5.

**DATA-08 · S3 · Server trusts client status** — ✅ code. POST `:96` and PUT `:129` store `loanData.status` from `LoanForm.calculateLoanStatus()`. **Fix:** T3.3.

**DATA-09 · S3 · No idempotency** — 🔍 verify. A double tap or retry on a slow network can create duplicate loans or payments. **Fix:** T3.6.

**DATA-10 · S3 · No DB guards** — ✅ code. No `CHECK` constraints (amount ≥ 0, rate ≥ 0, payment > 0). No unique `(loan_investor_id, due_date)` on `interest_periods`. **Fix:** T3.7.

**DATA-11 · S1 · Removing an investor on the edit form did nothing** — ✅ code. The PUT reconciled only investors present in the payload. `LoanForm.removeInvestor` drops the investor from the array, so their allocations, periods, and payments stayed active and the loan totals kept counting them. **Fix:** T3.2 (drop pass; 409 when payments exist and `confirmRemovals` is false).

**DATA-12 · S2 · Stale or soft-deleted ids could duplicate or revive money rows** — ✅ code. The reconcile loaded allocations and payments without a `deleted_at` filter and fell back to any unused row. A stale allocation id could attach to another row, and an unknown payment id was inserted as a new payment (duplicate money). **Fix:** T3.2 (active-only matching; unknown id returns 409).

**DATA-13 · S2 · Debt schedule edits and consolidate destroyed payment rows** — ✅ code. `syncDebtInterestPeriods` hard-deleted out-of-term periods when their payments were soft-deleted (FK cascade removed the history), and debt consolidate deleted all rows then inserted one. **Fix:** T2.9, T3.5, T0.7.

**DATA-14 · S2 · Status sweep counted removed rows** — ✅ code. `syncLoanStatuses` loaded every loan (including deleted) and every allocation and payment (including soft-deleted), so the cron could store a status the detail page never shows. **Fix:** T5.1, T5.2.

### B. Money math

**CALC-01 · S2 · Period interest base is inconsistent** — ✅ code

- **Uses one tranche row's amount:** `interest-periods/[id]/+server.ts:93-100`, `consolidate-payment` (same pattern), `received-payments/[id]/+server.ts:125`, `loan-interest-period-sync.ts:59`, `fix-received-payments`.
- **Uses the investor's total capital across tranches:** `calculateTotalInterest` (`calculations.ts:77-91`), `buildLoanPaymentSchedule` (`loan-payment-schedule.ts:128-144`), `loans/[id]/received-payments/+server.ts:149-157`.
- **Example:** An investor with ₱100,000 and ₱50,000 tranches at 5% per period. The schedule says ₱7,500 is due. Recording the payment caps at ₱5,000 and marks the period Completed, so the loan never reaches "fully received".

**CALC-02 · S2 · Investor stats merge an investor's different loans** — ✅ probe

- **Evidence:** `calculateTotalInterest` groups rows by investor ID (`calculations.ts:56-65`). `calculateInvestorStats` passes rows from **many loans** (`:623-627`). The first loan with periods sets the schedule for all of them. `calculateAverageRate(investor.loanInvestors)` has the same problem.
- **Probe:** Loan A ₱100k with periods 3% + 3%, loan B ₱200k at 10%. Expected 6,000 + 20,000 = **26,000**. Got **18,000**.
- **Where it shows:** `InvestorCard`, `InvestorsTable`, investors PDF, `csv-columns.ts:153`, dashboard investor chart (`dashboard-data.ts:358`). Investor detail uses the correct per-loan grouping (`loan-list-summary.ts:257-270`), so **the investors list and investor detail disagree**.

**CALC-03 · S2 · Floating-point money, no rounding policy** — ✅ probe

- 33,333.33 × 3.33% = `1109.9998890000002`. Sums of many rows drift. Equality checks rely on a 0.02 tolerance copied into at least 6 files (`calculations.ts:135`, `loan-interest-period-sync.ts:25`, `interest-periods/[id]:21`, `received-payments/[id]:19`, `loans/[id]/received-payments:34`, `consolidate-payment`). Debts round each period (`debt-calculations.ts:38`); loans never round. Loans and debts follow different rules.

**CALC-04 · S2 · Interest is computed in 8+ places** — ✅ code. Each copy has its own edge cases:

1. `src/lib/calculations.ts` (`calculateTotalInterest`, `calculateAmountDueOnDate` (unused), `calculateOverdueAmount`)
2. `src/lib/loan-payment-schedule.ts`
3. `src/lib/components/loans/loan-form-preview.ts` (`calculateLoanPreview`)
4. `LoanForm.svelte` `estimateInvestorTotal` (`:494-513`)
5. `MultipleInterestManager.svelte` `totals` (`:137-150`)
6. `src/lib/components/loans/investor-transactions-helpers.ts`
7. API routes: `interest-periods/[id]`, `consolidate-payment`, `received-payments/[id]`, `loans/[id]/received-payments`, `loan-interest-period-sync.ts`, `fix-received-payments`, `cleanup-orphaned-payments`, `extend-interest` (local copy `:18-25`)
8. `loan-list-summary.ts` commission and profit helpers

This breaks the `loan-domain` rule "never duplicate formulas in UI".

**CALC-05 · S2 · The form shows different numbers than the saved loan** — ✅ code

- `loan-form-preview.ts:58-68` adds a **fixed** period amount once **per tranche**. With 2 tranches and a ₱1,000 fixed period, the preview says ₱2,000. `calculateTotalInterest` counts it once per investor: ₱1,000.
- `estimateInvestorTotal` (`LoanForm.svelte:494-513`) applies only `transactions[0]`'s rate and type to all tranches. "Received exceeds max" validation and the client status use this.
- The contract draft (`buildContractDraft`) takes totals from the preview.

**CALC-06 · S3 · Overdue amount** — ✅ code. `calculateOverdueAmount` (`calculations.ts:303-389`, used by `PastDueLoansCard`) adds full interest for `Incomplete` periods and ignores received payments. Single-interest overdue loans show full principal + interest even after partial payments.

**CALC-07 · S3 · Loan duration** — ✅ probe. `calculateLoanDuration` (`calculations.ts:511-521`) uses `setMonth`. Jan 31 → Mar 31 = "1 Month, 4 Weeks" (expected "2 Months"). Shown on loan detail and in contract text (`loan-contract-content.ts`, `loan-contract-data.ts`).

**CALC-08 · S3** — ✅ code. `calculateAverageRate` docstring says it excludes fixed interest of zero-capital investors. The code includes it (`calculations.ts:159-183`).

**CALC-09 · S3** — ✅ code. `calculateInvestorStats` sorts `investor.transactions` in place (`:644-648`). `activeLoans`/`totalLoans`/`completedLoans`/`overdueLoans` count allocation **rows**, so an investor with 2 tranches on 1 loan counts as 2 loans (`:629-641`). `totalGain` is capital + interest; the name says gain.

**CALC-10 · S3 · Zero-capital (agent) investors** — ✅ code

- Engine: a ₱0 capital row earns its rate on the **whole loan principal** (`calculations.ts:87-90, 104`). In single-interest mode this is checked **per tranche**, so an investor with a ₱0 tranche next to a real one earns interest on the whole loan for the ₱0 row.
- Form: on save, rate is converted to a **fixed peso amount** using the principal at that moment (`LoanForm.svelte:1127-1161`). When principal changes later, the agent amount goes stale. The edit form then shows a peso amount instead of the % the user typed.
- Needs decision D-1.

**CALC-11 · S4** — ✅ code. Unused: `calculateAmountDueOnDate`, `calculateInvestmentTotal`, `calculateGroupedLoanInvestorStats`, `calculateLoanBalance`, `getBalanceStatus` (hard-coded ₱100k/₱50k thresholds).

### C. Loan form and multiple-interest editor (the "weird behavior")

**FORM-01 · S1 · Two sources of truth for periods** — ✅ code. `MultipleInterestManager.svelte` copies periods into private `$state` (`:62`). It reads `initialMode`/`initialPeriods` once at mount. Changes made outside the component (Copy investor config, templates, receipt-scan rows) update **what is saved** but not **what is shown**. The reverse also happens: the component writes up via `onPeriodsChange` from several `$effect`s (`:84-131`), so render order decides which copy wins.

**FORM-02 · S1 · "Edit mode" is computed from a prop the component itself fills** — ✅ code

- `isEditMode = Boolean(initialPeriods?.length)` (`:46`). In **create** mode, once the first period sync reaches the parent, `initialPeriods` is non-empty and the component treats the loan as being edited. After that, changing the **sent date** no longer regenerates intermediate periods. Only the final date follows the due date (`:103-113`).
- Before the first sync, the parent has **zero** periods while the screen shows several. Sync happens only once principal > 0 (`:115-131`). Saving early shows "Multiple interest periods are required" next to visible periods.

**FORM-03 · S1 · Period dates are one day early in Philippine time** — ✅ probe

- `generateDefaultInterestPeriods` builds **local-midnight** dates (`date-utils.ts:152-243`). The editor formats them with `toLocalDateString`, which reads **UTC** fields (`date-utils.ts:6-13`).
- Probe at `TZ=Asia/Manila`:
  - 2026-01-01 → 2026-04-01 gives `01-30, 02-27, 03-30` (expected `01-31, 02-28, 03-31`)
  - 2026-01-15 → 2026-04-15 gives `02-14, 03-14` (expected `02-15, 03-15`)
- At `TZ=UTC` the dates are correct, so tests on a UTC CI runner never catch it.

**FORM-04 · S2 · Wrong period can become "Final"** — ✅ code. `sortInterestPeriodsByDueDate` treats the **last array element** as final without checking its date (`multiple-interest-types.ts:10-20`). Edit-mode periods come from the DB in no guaranteed order (`loan-form-allocations.ts:98-106`). If the order differs, the editor overwrites the wrong period's date with the loan due date (`MultipleInterestManager.svelte:103-113`), which can create duplicates. Moving the due date earlier can leave intermediate periods **after** the final date, and nothing validates it.

**FORM-05 · S2** — ✅ code. "Add Period" inserts a period due on the **disbursement date** (`:168-177`). That is almost never right and may collide with an existing date.

**FORM-06 · S2 · Silent defaults** — ✅ code. `defaultInterestValue = '10'` (`LoanForm.svelte:157`). `defaultInterestRate={primaryTransaction.interestRate || '10'}` (`:1911`). Fallbacks to `'10'` in the editor (`:56, :92, :172`). If the user picked Fixed, generated periods are Fixed with an **empty** amount, which leads to DATA-03.

**FORM-07 · S3** — ✅ code. On a duplicate date, the guard shows a toast and returns, but the input still displays the rejected date (`:269-276`).

**FORM-08 · S3** — ✅ code. The single-mode summary shows "Rate {x}%" even for fixed interest (`:226-229`). Amounts use raw `toLocaleString` (`:224, :312-324`): no fixed decimals and **no price-visibility masking**.

**FORM-09 · S3** — ✅ code. Switching a period Rate↔Fixed keeps an empty field (edit-mode fixed periods have `interestRate: ''`). Totals silently drop to ₱0.

**FORM-10 · S2 · Paid periods can be edited without warning** — ✅ code. Changing the rate or date of a Completed period resets it to Pending on save (`api/loans/[id]/+server.ts:221-243`). The editor never shows period status.

**FORM-11 · S2 · Validation gaps** — ✅ code (`LoanForm.svelte:988-1057`):

- Due date ≥ each sent date is not checked.
- Period dates within (sent date, due date] are not checked.
- Received date vs sent date is not checked.
- `Number(x) < 0` lets `NaN` through.
- No rate sanity bounds.
- Default due date = today and sent date = today. Client status uses `today >= due` (`:524-528`), so a new loan can be **created as Overdue**.

**FORM-12 · S3** — ✅ code. "Copy investor config" copies **received payments and receipts** to other investors (`LoanForm.svelte:590-614`). This duplicates payment records and reuses evidence images.

**FORM-13 · S3** — ✅ code. On create, groups are sent in the POST body **and** again through `PUT /api/loans/[id]/groups` (`:1200`, `:1233-1246`). In edit mode the groups PUT ignores failures (`:1247-1254`).

**FORM-14 · S3** — 🔍 verify. No unsaved-changes guard on a 2,161-line form (sheet close, back gesture, route change).

**FORM-15 · S4** — ✅ code. The contract PDF auto-downloads after every create (`:1256-1264`). Ask instead, especially on mobile.

### D. Status lifecycle

**STAT-01 · S2** — ✅ code. Overdue is set only by `POST /api/loans/check-overdue`, which the dashboard calls after mount (`use-overdue-check.svelte.ts:20`). `vercel.json` crons cover backup, groups, reminders, and signing only. Lists, portals, Telegram, push, and calendar can read **stale** statuses for days.

**STAT-02 · S2 · Seven places set status, with different rules** — ✅ code:

- `deriveLoanStatusFromPeriods` (`loan-status.ts`)
- `check-overdue` (its own logic)
- `LoanForm.calculateLoanStatus` (client)
- `pay-transaction` (forces Fully Funded)
- `loans/[id]/payments` POST
- `extend-interest` (forces Overdue)
- `PUT /status` (manual)

Overdue starts **on** the due date in the client (`today >= due`). For periods it starts at `now > dueDate` with a UTC-midnight timestamp (`check-overdue:90`), which is 08:00 PH **on** the due date. Most lenders expect "the day after".

**STAT-03 · S2** — ✅ code. `deriveLoanStatusFromPeriods` returns Completed when all periods are Completed and all disbursements are paid, **even if principal was never received** (`loan-status.ts:44-46`).

**STAT-04 · S2** — ✅ code. `check-overdue:111-116` only checks `Fully Funded` loans, so Partially Funded loans past due are never Overdue.

**STAT-05 · S3** — ✅ code. Adding a disbursement (`loans/[id]/payments`) leaves a Completed loan Completed. `pay-transaction:39-60` sets `sentDate = now` (losing the real date), needs no receipt, and turns Overdue/Completed into Fully Funded.

**STAT-06 · S3** — ✅ code. `PUT /api/loans/[id]/status` accepts any string and always sends a `loan_completed` activity to groups/Telegram.

**STAT-07 · S3** — ✅ code. `POST /api/loans/[id]/extend-interest` has **no UI caller**. It sets the loan to Overdue unconditionally (`:78-85`). It turns single-interest loans into multi-interest with an Overdue original period, ignoring payments (`:146-159`). It scales interest by a ratio of totals (`:169-173`) and keeps its own interest formula. The `loan-domain` skill describes extend as a working feature.

**STAT-08 · S4** — ✅ code. `loadLoanDetail` writes status during a GET (`loan-detail.ts:128-134`). Keep it as a safety net once T5.1 exists, but make it use the single rule and record an audit event.

### E. Dates and timezones

**DATE-01 · S2** — ✅ code. There is no single business timezone:

- Asia/Manila: `calendar-sync-plan.ts`, `telegram/format.ts`, `group-calendar.ts`
- UTC getters: `toLocalDateString`
- Device/server local: `formatDate*`, `normalizeToMidnight`, `generateDefaultInterestPeriods`, `calculateLoanDuration`, `getTodayAtMidnight`

**DATE-02 · S2** — ✅ code. `toLocalDateString(new Date())` pre-fills "today" for sent dates, received dates, and the due date (`LoanForm.svelte:163, 174, 220`, plus receipt adapters `:786, :808`). From 00:00 to 07:59 in the Philippines this is **yesterday**.

**DATE-03 · S3** — ✅ code. Date-only fields are `timestamp` columns (`loans.due_date`, `loan_investors.sent_date`, `interest_periods.due_date`, `received_payments.received_date`, `debts.date`). Forms write UTC midnight; `pay-transaction` writes "now". The same row can show different days in different components.

**DATE-04 · S3** — ✅ code. `formatDate`/`formatDateShort` (`format.ts:111-130`) use the runtime timezone. Server-rendered HTML and PDFs (UTC) can disagree with the browser (PH) for non-midnight values.

**DATE-05 · S3** — ✅ code. `toLocalDateString` returns the **UTC** date. The misleading name is the root cause of DATE-02 and FORM-03.

### F. API, validation, and security

**API-01 · S2** — ✅ code. Only 1 of 86 `+server.ts` routes uses zod. Bodies are parsed ad hoc. 24 `parseInt(id)` calls lack NaN checks.

**API-02 · S3** — ✅ code. These routes return `details: error.message`: `loans` POST, `loans/[id]` PUT, `extend-interest`, `fix-received-payments`, `cleanup-orphaned-payments`, `sync-due-dates`. Use `publicJsonError`.

**API-03 · S3** — ✅ code. Some routes check ownership inline and return **401** (`interest-periods/[id]`, `received-payments/[id]`, `consolidate-payment`). Others use `hasLoanAdminAccess` and return 403 or 404.

**API-04 · S3** — ✅ code. Settings exposes data-repair and migration endpoints as one-click buttons (`FixReceivedPaymentsButton`, `SyncLoanDueDatesButton`). `cleanup-orphaned-payments` is callable with no UI.

### G. Commission and profit (legacy)

**COMM-01 · S3** — ✅ code

- `resolveInvestorCommissionWriteAccess` and `resolveWitnessProfitWriteAccess` always return `false` (`access-control.ts:231-246`), so those endpoints always 403.
- `LoanInvestorCommissionCard`, `LoanBorrowerProfitCard`, and `LoanProfitSummaryCards` are not rendered anywhere.
- Legacy columns `loans.profit_*`, `loan_investors.profit_*`, `loan_witnesses.profit_*`:
  - still read by `computeBorrowerProfitStats` / `computeWitnessProfitStats` (`loan-list-summary.ts:516-580`)
  - stripped from detail payloads (`stripLegacyCommissionFields`)
  - reset to defaults on every loan edit (DATA-01)
- Check what `/borrowed`, `/witnessed`, and `/commissioned` show.

### H. Debts

**DEBT-01 · S2** — ✅ code. `generateInterestSchedule` uses offset `i = 0`, so installment 1 is due **on the borrow date** (`debt-calculations.ts:151-166`). Needs decision D-9.

**DEBT-02 · S3** — ✅ code. The monthly schedule uses `setMonth`, so a Jan 31 start jumps to Mar 3.

**DEBT-03 · S3** — ✅ code. `isCompletedDebt` checks only whether the term has ended (`:324-335`). An unpaid debt can show as "Completed". Review filter labels.

**DEBT-04 · S3** — ✅ code. `debt_interest_periods.expected_interest` stores principal + interest (`debt-interest-period-sync.ts:85`). Periods with payments beyond a shortened term stay as orphans (`:126-133`). Sync runs one query per period (N+1). The **reconcile** approach is still the right model for loans (ARCH-01).

### I. Dashboard and reporting

**RPT-01 · S2** — ✅ code. "Interest Earned" is the **scheduled** interest of Completed loans (`loan-list-summary.ts:321-325`), not cash collected. Manually completed loans overstate it. Interest already collected on open loans is missing. Needs decision D-6.

**RPT-02 · S2** — ✅ code. The capital "return" date for completed loans is `loan.updatedAt` (`loan-list-summary.ts:84-95`, interval end `:245-249`). Editing notes on an old loan moves its capital return to today, which shifts peak concurrent capital and dashboard numbers.

**RPT-03 · S3** — ✅ code. Because of CALC-01, CALC-02, and CALC-05, the same loan or investor can show different totals on the list, card, detail, PDF, CSV, and dashboard. No test checks they match.

**RPT-04 · S4** — 🔍 verify. `formatCurrencyCompact` rounds to whole pesos on summary cards. `formatCurrency(NaN)` prints "₱NaN" (`format.ts:34-43`).

### J. PWA, performance, and tests

**PWA-01 · S3** — 🔍 verify. `/api/loans` is cached for offline reads (`src/lib/pwa/shared.ts:33-37`). Check whether the UI shows when the data was last updated, that every write shows the offline message, and that purge on sign-out (`purge.ts`) also clears receipts and images.

**PWA-02 · S3** — 🔍 verify. Push, Telegram, and calendar reminders may read stale status (STAT-01). Confirm they derive from the schedule and today's date.

**PERF-01 · S3** — ✅ code. `check-overdue` loads **every** owned loan with periods and payments on each dashboard visit. `syncLoanStatusFromInterestPeriods` runs one UPDATE per overdue period. Debt period sync is N+1.

**PERF-02 · S3** — 🔍 verify. The 45-second cache is per server instance (`memory-cache.ts`). After a payment saved on instance A, instance B may show the old balance for up to 45 seconds. Measure on Vercel and decide (T10.2).

**PERF-03 · S4** — ✅ code. `LoanForm.svelte` 2,161 lines, `LoanListPage.svelte` 1,197, `InvestorTransactionsDisplay.svelte` 1,091, `InvestorDetailContent.svelte` 985.

**TEST-01 · S2** — ✅ code. `calculations.test.ts` has 9 cases, `debt-calculations.test.ts` 4, `loan-form-allocations.test.ts` 2. No tests exist for `MultipleInterestManager`, `LoanForm`, any payment API, status sync, `check-overdue`, or the repair endpoints.

**TEST-02 · S2** — ✅ code. No API or DB integration tests. CI E2E runs only `--project=smoke`. `crud-flows.spec.ts` and `advanced-controls.spec.ts` are not in any Playwright project.

**TEST-03 · S3** — ✅ code. There is no timezone test matrix (FORM-03 only reproduces under `TZ=Asia/Manila`), no property-based tests, and no coverage gate.

**UX-01 · S3** — ✅ code. Deleting a payment uses `window.confirm` (`InvestorTransactionsDisplay.svelte:342`, `DebtPaymentSchedule.svelte:205`) instead of `ConfirmDeleteDialog`.

**ARCH-01 · S3** — ✅ code. See DATA-01 and DEBT-04: debts reconcile rows; loans delete and recreate them.

**ARCH-02 · S4** — ✅ code. `.agent/skills/loan-domain/SKILL.md` says "Extend interest creates a new period" (no UI does this) and "consolidate payment rolls periods on debts" (it also exists for loans and is destructive).

---

## Decisions needed (recommended defaults)

These decisions block specific tasks. Each has a recommended default so work can start. Phase 1 (T1.1) records the final choices in `docs/architecture/money-model.md`.

| ID   | Question                                                                                               | Recommended default                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | Zero-capital (agent) investor: is their interest part of the borrower's total, on the whole principal? | Yes. Store it as a rate with an explicit "base = loan principal" flag; never convert to fixed at save; recompute live.                   |
| D-2  | When is something overdue?                                                                             | The day **after** the due date, in Asia/Manila. One function owns this rule.                                                             |
| D-3  | Rounding                                                                                               | Integer centavos. Round each period's interest once, half-up, to the centavo. Totals are sums of rounded parts.                          |
| D-4  | Multi-tranche investors with periods: base for rate periods?                                           | The investor's total disbursed capital for that loan (current engine). Make it explicit and use it everywhere.                           |
| D-5  | Fixed period amount with several tranches                                                              | Charged once per investor per period (current engine). The form preview must match.                                                      |
| D-6  | Dashboard "Interest Earned"                                                                            | Split into **Interest collected** (cash received, allocated to interest) and **Interest expected** (scheduled, open loans).              |
| D-7  | Manual "Mark completed" with money still owed                                                          | Allowed only with a reason (waived/written-off). Store the waived amount; reports show it.                                               |
| D-8  | Deleting loans and payments                                                                            | Soft delete (`deleted_at`) with restore for 30 days; every delete writes an audit event.                                                 |
| D-9  | First debt installment date                                                                            | One interval after the debt date.                                                                                                        |
| D-10 | Reverting a paid period                                                                                | Never deletes payments. To undo a payment, delete that payment explicitly (soft delete); period status is then recomputed.               |
| D-11 | Extend interest                                                                                        | Build a proper "Extend term" action on loan detail on top of the new engine, or delete the endpoint. Default: delete now, re-plan later. |
| D-12 | Settings repair buttons                                                                                | Remove. Replace with a read-only **Data health** card (T8.4).                                                                            |
| D-13 | Payment applied to a multi-interest loan without a period                                              | Allowed and treated as principal (or as "unallocated" shown in the ledger). Never deleted by any automatic job.                          |
| D-14 | Allocation order of a payment (interest first vs principal first)                                      | Interest of the oldest open period first, then principal. Needed for "Interest collected" (D-6).                                         |

---

## Approach

1. **Stop the bleeding first (Phase 0).** Small, targeted patches that end data loss. Take a backup before deploying.
2. **Write the money model down (Phase 1).** One spec with definitions, formulas, rounding, timezone, and status rules, plus hand-checked golden cases. Every later change is measured against it.
3. **One money engine (Phase 2).** `src/lib/money/` works in integer centavos. `buildLoanLedger()` returns everything any screen needs. All UI, API validation, PDFs, CSV, calendar, Telegram, push, and dashboard read from it. Delete the duplicate formulas.
4. **Safe persistence (Phase 3).** Shared zod schemas. Diff-based reconcile in one transaction (the same model debts already use). Status computed on the server. Audit log. Soft delete.
5. **Rebuild the interest editor (Phase 4)** as a pure, tested reducer plus a fully controlled component. Split `LoanForm.svelte`.
6. **Status, dates, reporting (Phases 5–7):** a single status rule plus a daily cron, a Manila business-date module, clear metric definitions, and tests that check every screen shows the same numbers.
7. **Repair production data (Phase 8)** with read-only reports first, then approved, audited, transactional fixes.
8. **Page-by-page audit (Phase 9)** with persona checklists. Every new finding is added to the tracker above.
9. **PWA, performance, a11y, security, test gates, cleanup, docs (Phases 10–14).**

**Trade-offs**

- **Integer centavos vs a decimal library:** centavos as JS `number` are exact up to about ₱90 trillion and need no dependency. Recommended.
- **`date` columns vs keeping `timestamp`:** a column-type migration is the cleanest fix but touches every query. Phase 6 first adds strict helpers (low risk); the migration (T6.5) is optional after measuring.
- **Rewriting LoanForm vs patching:** patching FORM-01 and FORM-02 without removing the dual state will regress. Extract state and reducer first, then split the UI.

---

## Implementation tasks

Order matters. Each task lists the findings it closes. "Done" means code plus tests plus docs.

### Phase 0 — Stop data loss (hotfixes, ship first)

- [x] **T0.1** Create a Neon branch and run `bun run backup:neon` before any Phase 0 deploy. Record the branch name in this doc.

  **Done 2026-11-13.** Neon branch creation was unavailable (no `neonctl` auth in session), so the backup is a verified full logical dump:
  - File: `~/Backups/kame-lends/kame-lends-neon-20261113-050618.dump` (2.4 MB, 40 tables with data)
  - SHA-256: `485390703d016c0014eece99c5e4518de732b1da35241106f35a044c0faae951`
  - Source: `DATABASE_URL_PROD` (Neon Singapore, branch `production`)
  - Restored into local Docker Postgres `127.0.0.1:5433` via `bun run db:local:sync-prod --from-dump`
  - Local snapshot: loans 130, loan_investors 178, interest_periods 257, received_payments 162, debts 2, investors 7, users 12
  - Local `DATABASE_URL` stays on `127.0.0.1`; all work from here runs against the local copy.
  - `bun run db:health:money` on that snapshot found: 4 unlinked payments on multi-interest allocations, 15 receipt-less payments matching a period's expected amount/date (likely created by the removed repair button), 13 zero-capital allocations stored as fixed, 9 duplicate period dates, 5 Overdue loans with no overdue period. No completed-underpaid periods, no zero-allocation loans, no debt orphan periods.

- [x] **T0.2** Remove `FixReceivedPaymentsButton` and `SyncLoanDueDatesButton` from `src/routes/settings/+page.svelte`. Make `POST /api/loans/fix-received-payments` and `POST /api/loans/cleanup-orphaned-payments` return **410 Gone** (no writes). Keep `sync-due-dates` server-only behind admin plus confirmation, or remove it. Closes DATA-04, API-04 (partial).
- [x] **T0.3** `src/routes/api/interest-periods/[id]/+server.ts`: reverting changes **status only after recomputing from linked payments**. Delete the payment-deleting branch (`:194-219`) and the `existingPayments[0]` fallback. Closes DATA-05.
- [x] **T0.4** `src/routes/api/loans/+server.ts` and `src/routes/api/loans/[id]/+server.ts`: validate the **whole** payload (amounts finite ≥ 0, dates valid, each period rate/amount present and > 0, at least one allocation) **before** any write. Wrap all writes in `db.transaction`. Use `publicJsonError`. Closes DATA-02, part of API-02.
- [x] **T0.5** Keep payment links on edit: `LoanForm.svelte` sends `id` and `interestPeriodId` for existing received payments. The PUT maps old period IDs to re-inserted periods by `(investorId, dueDate)` and restores `interestPeriodId`, then calls `recalculateInterestPeriodStatusFromLinkedPayments` for every period and `syncLoanStatusFromInterestPeriods`. A stopgap until T3.2. Closes DATA-01 (partial).
- [x] **T0.6** Client: `collectFieldErrors` requires each period's rate (rate type) or amount (fixed type) > 0. Server: reject the same (T0.4). Closes DATA-03.
- [x] **T0.7** `consolidate-payment/+server.ts`: run delete+insert in one transaction and merge prior receipts into the new row (or refuse when more than one linked payment has receipts). Closes DATA-06 (partial).
      **Final form 2026-11-13:** the first linked payment is updated in place (id kept), extras are soft-deleted, and the audit event is written inside the same transaction. Same rule for debt payments.
- [x] **T0.8** Write `scripts/db/money-health-report.ts` v0 (read-only, see T8.1) and run it on the Neon branch to size existing damage. Attach anonymized counts to this doc.
- [x] **T0.9** Regression tests for each hotfix: unit or integration tests that fail before and pass after (use the T12.2 harness early if ready; otherwise handler-level tests with a test DB).

  Landed `src/lib/schemas/loan.test.ts` and `src/lib/components/loans/multiple-interest-types.test.ts` (payload validation, empty/zero period values, fixed amounts, sent/due ordering, payment id + period link). Handler-level DB tests are added with the T12.2 harness.

### Phase 1 — Money spec and characterization tests

- [x] **T1.1** Write `docs/architecture/money-model.md`: definitions (loan, allocation/tranche, investor capital, interest period, rate vs fixed, agent/zero-capital, received payment, allocation order, balance, due, overdue, completed, waived), formulas, rounding (D-3), business timezone (D-2), status machine diagram, invariants, and decisions D-1…D-14.
- [x] **T1.2** Golden cases: `src/lib/money/__fixtures__/loans.ts` plus `docs/workflow/qa/money-golden-cases.md`. Include at least 30 hand-checked loans: single/multi interest, multi-tranche, fixed and rate periods, agent, partial and over payments, overdue, completed, waived, month-end (Jan 31, Feb 28/29), leap year, loans across New Year, and ₱0.01 edge amounts. Each case lists expected totals, schedule rows, balances, and status for a fixed "today".
- [x] **T1.3** Characterization tests on today's functions (`calculations.test.ts`, `loan-payment-schedule.test.ts`, `loan-status.test.ts`, `debt-calculations.test.ts`). Mark known-bug cases with `it.fails` and the finding ID so fixes flip them to passing.
- [x] **T1.4** Timezone matrix: add `test:unit:tz` running Vitest under `TZ=Asia/Manila`, `TZ=UTC`, and `TZ=America/Los_Angeles`. Add a probe test for FORM-03 and DATE-02.

### Phase 2 — Single money engine

- [x] **T2.1** `src/lib/money/centavos.ts`: `toCentavos(decimalString)`, `fromCentavos`, `addC`, `mulRate(centavos, ratePercent)` (half-up), `formatPHP`. Export one `AMOUNT_TOLERANCE_CENTAVOS = 0` and remove the 0.02 copies. Closes CALC-03.
- [x] **T2.2** `src/lib/money/ledger.ts`: `buildLoanLedger(loan, { today })` returns, per investor: capital, periods (expected, paid, remaining, status), and single-interest due. Per loan: total principal, interest, amount due, received, balance, overdue amount, next due, and due rows (the current `buildLoanPaymentSchedule` shape). Implements D-1, D-4, D-5, D-13, D-14. Closes CALC-04 (core), CALC-06, CALC-08.
- [x] **T2.3** Replace UI and lib consumers with the ledger: `loan-payment-schedule.ts` (wrap or delete), `loan-list-summary.ts`, `investor-transactions-helpers.ts`, `PastDueLoansCard.svelte`, `LoanCard.svelte`, `LoansTable.svelte`, `LoanDetailContent.svelte`, `InvestorDetailContent.svelte`, `BorrowerDetailContent.svelte`, `csv-columns.ts`, `src/lib/server/pdf/*.tsx`, `loan-contract-data.ts`, `loan-contract-content.ts`, `src/lib/server/telegram/*`, `group-calendar.ts`, `calendar-summaries.ts`, `dashboard-data.ts`, `receipt-scan/suggest-period.ts`.
- [x] **T2.4** Replace server-side copies: `interest-periods/[id]`, `consolidate-payment`, `received-payments/[id]`, `loans/[id]/received-payments`, `loan-interest-period-sync.ts`. All "expected interest" and "remaining" values come from the ledger. Closes CALC-01.
- [x] **T2.5** Investor aggregates: group by **loan, then investor**. Rewrite `calculateInvestorStats`/`calculateAverageRate`: no input mutation, count distinct loans, rename `totalGain`. Closes CALC-02, CALC-09.
- [x] **T2.6** Durations and month math through `date-fns` (`differenceInCalendarMonths`, `addMonths` with clamping) in `calculateLoanDuration` and the debt schedule. Closes CALC-07, DEBT-02.
- [x] **T2.7** Make `calculations.ts` thin wrappers over the ledger (kept for imports), or delete unused functions (CALC-11).
- [x] **T2.8** Form adapter: `src/lib/loans/form-to-ledger.ts` turns form state into ledger input. Delete the math in `loan-form-preview.ts`, `estimateInvestorTotal`, and `MultipleInterestManager` totals. Closes CALC-05.
- [x] **T2.9** Debts: apply D-9 (first installment one interval after start), fix month overflow, decide `isCompletedDebt` semantics (term ended vs paid, separate labels), rename or annotate `expected_interest` (a migration only if renaming), clean up orphan periods. Closes DEBT-01–04 (DB rename optional).

### Phase 3 — Persistence integrity

- [x] **T3.1** Shared zod schemas in `src/lib/schemas/` (`loan.ts`, `payment.ts`, `debt.ts`, `party.ts`) used by forms (client errors) **and** every mutating API route. Includes period rules from T4.5. Closes API-01 (money routes), FORM-11 (server side), DATA-03 (fully).
- [x] **T3.2** Rewrite `PUT /api/loans/[id]` as a **diff-based reconcile** by stable IDs in one transaction:
  - update changed allocations, insert new ones, delete removed ones (block when payments exist unless the client confirms)
  - same for periods, keeping status computed from linked payments
  - never touch payments, except payments the user explicitly edits or removes
  - return **409** with a clear message when a change would orphan payments (for example, changing the rate of a Completed period)

  Closes DATA-01, FORM-10, ARCH-01.

  **Hardened 2026-11-13 (DATA-11, DATA-12).** Active rows only; unknown ids return 409; investors absent from the payload are soft-deleted with their periods, and their payments only with `confirmRemovals`. `ReconcileConflict` now returns 409 instead of a generic 500.

- [x] **T3.3** Remove `status` from create/edit payloads. After every money mutation, call one server `recomputeLoanStatus(loanId, tx)` built on the ledger plus manual override (D-7). `PUT /status` only accepts `Completed`, and only with a reason. Closes DATA-08.
- [x] **T3.4** New migration `db/migrations/00xx_money_audit_events.sql`: table `money_audit_events` (id, at, actor_user_id, entity_type, entity_id, loan_id, action, before jsonb, after jsonb, reason). Helper `recordMoneyAudit(tx, …)` called from every loan, allocation, period, payment, debt, and status write. Closes DATA-07 (audit).
- [x] **T3.5** Soft delete (D-8): `deleted_at` on `loans`, `received_payments`, `loan_investors`, `debts`, `debt_received_payments`. Default queries filter them out. Restore endpoint plus Settings "Recently deleted" list. Closes DATA-07 (delete).
- [x] **T3.6** Idempotency: client sends an `Idempotency-Key` on create loan, add payment, and add disbursement. Server stores key → response for 24h (reuse the `rate_limit_buckets` pattern or a small table). Also disable the submit button while a request runs (verify everywhere). Closes DATA-09.
- [x] **T3.7** Constraints migration: `CHECK (amount >= 0)` on allocations, `CHECK (amount > 0)` on payments, `CHECK (interest_rate >= 0)`, and `UNIQUE (loan_investor_id, due_date)` on `interest_periods`. Run T8.1 first to find rows that would violate them. Closes DATA-10.
- [x] **T3.8** Add `completed_at`, `status_override`, `status_reason`, and `waived_amount` to `loans` (D-7). Backfill `completed_at` from the last received payment date, falling back to `updated_at`. Closes RPT-02 (data side).
- [x] **T3.9** Error handling: `publicJsonError` everywhere; remove `details: error.message` (API-02). Add `parseIdParam(params.id)` → 400 on NaN (24 call sites).
- [x] **T3.10** Authorization helpers `requireLoanOwner(event, loanId)` and `requirePeriodOwner(event, periodId)` returning 403/404 consistently. Replace inline checks. Closes API-03.

### Phase 4 — Interest editor and loan form

- [x] **T4.1** Pure reducer `src/lib/loans/interest-period-editor.ts` with actions `init`, `generate`, `regenerateIfUntouched`, `add` (defaults to midpoint of neighbors or +1 interval, never the sent date), `remove`, `edit`, `setType` (convert rate↔fixed with the current principal), and `setDueDate`. Invariants: sorted by date, last period = loan due date, all dates in (first sent date, due date], no duplicates, value required. Full unit tests including the probe dates. Closes FORM-02, FORM-04, FORM-05, FORM-09.
- [x] **T4.2** Rewrite `MultipleInterestManager.svelte` as **fully controlled**: props `periods`, `mode`, `principal`, `sentDate`, `dueDate`; events `onchange(action)`; no internal copy; no `$effect` writes. Show each period's status badge and paid amount. Paid periods are locked, or editable only after a confirm explaining the impact. Use `formatCurrency` so price masking applies. Reject duplicates without leaving stale input. Closes FORM-01, FORM-07, FORM-08, FORM-10 (UI).
- [x] **T4.3** Generate period dates as **date keys** (`YYYY-MM-DD`) with no `Date`→string round trip (`date-utils.ts` → `src/lib/dates/business-date.ts`). Closes FORM-03.
- [x] **T4.4** Split `LoanForm.svelte` into `loan-form-state.svelte.ts` (store and actions) plus sections: `LoanBasicsSection`, `InvestorAllocationCard`, `DisbursementRow`, `ReceivedPaymentsPanel`, `LoanFormSummary` (ledger-driven). Remove the hidden `'10'` defaults: the interest field is empty and required unless a template fills it. Closes FORM-06, PERF-03 (form).
      **Done 2026-11-16 (scoped).** Payload building, validation, and preview math live in `src/lib/loans/loan-form-payload.ts` and `src/lib/loans/form-to-ledger.ts`. The basics card is now `LoanBasicsSection.svelte`; summary, contract preview, actions, groups, and investor preview already live in their own components, and the hidden `10` default is gone. The investor rows stay inside `LoanForm.svelte` on purpose: every row writes through the reducer (`updateInvestor`, `updateTransactionFields`, receipt adapters) and splitting them would add 20+ prop callbacks without a behavior gain.
- [x] **T4.5** Validation rules (shared with T3.1): due date ≥ every sent date; period dates within range; received date ≥ earliest sent date (warning, not error); rate per period between 0 and 100 (warn above 20%); fixed > 0; finite numbers only; a loan cannot be created already overdue without a confirmation. Closes FORM-11.
- [x] **T4.6** Agent/zero-capital per D-1: no rate→fixed conversion at save; an explicit "Agent (no capital)" toggle on the allocation. Migration plan for already-converted rows (list them in T8.1; convert only with owner approval). Closes CALC-10.
- [x] **T4.7** Copy investor config copies only interest settings (type, value, periods). Never payments or receipts. Closes FORM-12.
- [x] **T4.8** Form chrome:
  - unsaved-changes guard (sheet close, back, route change)
  - single groups write on create; surface group errors on edit
  - ask before downloading the contract PDF
  - double-submit lock

  Closes FORM-13, FORM-14, FORM-15.

- [x] **T4.9** Component tests (`@testing-library/svelte`) for the editor and the form's money paths: create single, create multi, edit multi with paid periods, change due date, add/remove period, switch type, agent investor, copy config.

### Phase 5 — Status lifecycle

- [x] **T5.1** `src/lib/money/status.ts` `deriveLoanStatus(ledger, { today, override })` is the **only** status rule, per D-2 and D-7. Used by `recomputeLoanStatus`, `check-overdue`, the cron, and `loadLoanDetail`. Delete `deriveLoanStatusFromPeriods` logic duplicates and `LoanForm.calculateLoanStatus`. Closes STAT-02, STAT-03, STAT-04, STAT-08.
- [x] **T5.2** Daily cron `GET /api/cron/loan-status` (00:10 Asia/Manila = `10 16 * * *` UTC) marks overdue periods and loans in batched updates, writing audit events. Add it to `vercel.json` and `src/lib/server/cron-auth.ts`. The dashboard `OverdueChecker` becomes a light "refresh if stale" call. Closes STAT-01, PERF-01 (check-overdue), PWA-02 (status source).
- [x] **T5.3** Fix status side effects:
  - `loans/[id]/payments` POST re-opens Completed loans
  - `pay-transaction` keeps or asks for the real sent date, requires a receipt, and recomputes status
  - `PUT /status` validates input and sends the correct activity type

  Closes STAT-05, STAT-06.

- [x] **T5.4** Extend interest per D-11: delete `src/routes/api/loans/[id]/extend-interest/+server.ts` (and the activity type if unused), or plan a proper "Extend term" feature in `_to-plan.md`. Closes STAT-07.

### Phase 6 — Dates and timezone

- [x] **T6.1** `src/lib/dates/business-date.ts`: `BUSINESS_TZ = 'Asia/Manila'`, `todayKey()`, `toDateKey(value)`, `dateKeyToUtcMidnight(key)`, `compareDateKeys`, `isAfterDueDate(dueKey, todayKey)`, `addMonthsClamped(key, n)`. Unit tests in the TZ matrix. Closes DATE-01, DATE-02 (with T6.2).
- [x] **T6.2** Rename `toLocalDateString` → `toUtcDateKey` and replace every "today" default with `todayKey()`. Add a lint or grep check (`scripts/check-date-helpers.mjs`) that fails on `toLocalDateString(new Date())` / `new Date().toISOString().slice(0, 10)` in `src/`. Closes DATE-05.
- [x] **T6.3** `formatDate*` take `timeZone: BUSINESS_TZ` explicitly, so SSR, PDFs, and the browser agree. Closes DATE-04.
- [x] **T6.4** Writers of business dates store UTC midnight of the business date key (fix `pay-transaction`, any `new Date()` used for sent/received dates). Closes DATE-03 (writers).
- [x] **T6.5** (Optional, after measuring) Migrate date-only columns to `date`. Needs a full query audit, backfill verification, and the T12.2 integration suite green.
      **Wont-fix 2026-11-16 (optional).** Date-only columns stay `timestamp`. Writers already store UTC midnight of the Manila date key, reads format in `BUSINESS_TZ`, and the integration suite is green. A `date` migration would change every reader from `Date` to string, touch the PDF/CSV/calendar adapters, and add migration risk with no user-visible benefit. Revisit only if a real mixed-writer defect appears.

### Phase 7 — Reporting and cross-screen consistency

- [x] **T7.1** Metric definitions in `docs/guides/routes/dashboard.md` and `docs/architecture/money-model.md`. Dashboard cards per D-6: Interest collected, Interest expected, Principal outstanding, Overdue amount (ledger), Waived. Guard `formatCurrency` against non-finite values and decide where compact rounding is acceptable. Closes RPT-01, RPT-04.
- [x] **T7.2** Capital timelines use `completed_at` (T3.8), not `updatedAt`, in `loan-list-summary.ts` and `capital-intervals.ts`. Closes RPT-02.
- [x] **T7.3** Investors list, card, table, PDF, CSV, and dashboard chart use ledger aggregates grouped by loan (T2.5). Closes CALC-02 (surfaces).
- [x] **T7.4** Reconciliation test `src/lib/money/reconciliation.test.ts`: for every golden fixture, the values passed to the list row, card, detail summary, investor section, schedule/calendar, timeline, Telegram message, PDF data, CSV row, and contract equal the ledger. Closes RPT-03.
- [x] **T7.5** `/borrowed`, `/witnessed`, `/commissioned`: confirm the profit/commission source. Move off legacy `profit_*` columns to `loan_user_commissions`, or remove the metric. Closes COMM-01 (reporting).

### Phase 8 — Production data audit and repair

- [x] **T8.1** `scripts/db/money-health-report.ts` (read-only, prints anonymized IDs and counts; never PII). Checks:
  - payments with `interest_period_id IS NULL` on multi-interest investors
  - Completed periods whose linked sum < expected
  - Incomplete/Pending periods whose linked sum ≥ expected
  - loans whose stored status ≠ derived status
  - payments with empty `receipts` (likely made up by DATA-04): amount = expected interest and `received_date` = period due date
  - received > due per investor
  - allocations with `amount = 0` converted to fixed (CALC-10)
  - duplicate period dates per allocation
  - loans with zero allocations (DATA-02 victims)
  - Completed loans without full receipt (manual completions)
  - debts with orphan periods
- [x] **T8.2** Run the report on a Neon branch of production. Review each category with the owner and record decisions in this doc (no PII).
- [x] **T8.3** Repair scripts in `scripts/db/repair/` (one per category). Each one:
  - is dry-run by default
  - requires `--apply` plus a fresh backup ID
  - runs inside a transaction
  - writes `money_audit_events` with reason `repair:<category>`
  - re-runs the report after
- [x] **T8.4** Settings **Data health** card (read-only), backed by `GET /api/admin/money-health` using the same checks. Admin only. Closes API-04, D-12.
- [x] **T8.5** Optional: weekly health summary to the owner (email or Telegram), counts only.
      **Done 2026-11-14.** `GET /api/cron/money-health` runs Monday 07:00 Asia/Manila (`0 23 * * 0` UTC) and emails counts-only to `WORKSPACE_OWNER_EMAIL`. `vercel.json` schedules it. Without email config it still returns the counts JSON.

### Phase 9 — Page-by-page product, UX, and QA audit

Run each checklist as **owner (desktop + phone)**, then as **investor / borrower / witness / group viewer** where relevant. Run it in light and dark mode, with price visibility on and off, and online and offline. Log each new issue in the tracker as `UX-xx` / `BUG-xx`.

**Every route also checks:** loading skeleton, empty state, error state, slow network, 375px and 1440px widths, keyboard and screen reader, number formatting, date formatting (Manila), and that totals match the ledger.

| Route                                                      | Personas                     | Must check                                                                                                                                                                                                |
| ---------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` landing                                                | Anonymous                    | Copy accurate (no claims of missing features), CTA → sign in, Lighthouse, OG tags, dark mode                                                                                                              |
| `/signin`                                                  | Anonymous                    | Google sign-in, error states, redirect back to deep link, PWA standalone sign-in                                                                                                                          |
| `/dashboard`                                               | Owner                        | Every card value vs ledger (T7.1), charts vs list totals, Past due / Maturing / Pending disbursement cards, quick actions, overdue refresh, stale-cache behavior after a payment                          |
| `/loans` list                                              | Owner                        | Table, cards, timeline, calendar views; filters, sort, date range persistence; summary cards vs selection modal; bulk actions; export PDF/CSV values; row patch after save                                |
| `/loans/new` and create sheet                              | Owner                        | Every FORM-xx scenario; templates; receipt scan → rows; groups; contract draft totals; validation messages; mobile keyboard (`inputmode="decimal"`)                                                       |
| `/loans/[id]` detail                                       | Owner, parties, group viewer | Summary vs ledger; investor sections; record/edit/delete payment; period pay/revert; consolidate; quick payment; disbursement; status; duplicate; delete; contract; signing; commission; groups; timeline |
| `/loans/[id]/sign`, `/sign/[token]`                        | Borrower, investor, witness  | Email match, consent, signature pad on phone, amounts in contract = ledger, duration text (CALC-07), legacy token redirect                                                                                |
| `/investors`, `/investors/[id]`, `/investors/new`          | Owner                        | Card/table totals = detail = PDF/CSV (CALC-02); loans and debts tabs; filters with prefixed params; create/edit                                                                                           |
| `/borrowers`, `/borrowers/[id]`, `/borrowers/new`          | Owner                        | Borrower stats (overdue amount CALC-06), lot totals, valid ID / e-signature upload, `/barrowers` redirect                                                                                                 |
| `/witnesses`, `/witnesses/[id]`, `/witnesses/new`          | Owner                        | Witness loans, default witnesses from groups                                                                                                                                                              |
| `/debts`, `/debts/[id]`, `/debts/new`                      | Owner                        | Schedule dates (DEBT-01/02), totals incl. fees, payments, consolidate, "completed" label (DEBT-03)                                                                                                        |
| `/transactions` (flag off)                                 | Owner                        | Confirm unreachable when `SHOW_TRANSACTIONS_UI=false`; decide to delete or keep (`transactions.balance` stored running balance)                                                                           |
| `/groups`, `/groups/new`, `/groups/[id]`                   | Owner, members               | Wizard, access preview, rules, loans tab, people tab, calendar sync, Telegram connect/test/templates, interest visibility toggles, member read-only                                                       |
| `/investments`, `/borrowed`, `/witnessed`, `/commissioned` | Party users                  | Read-only rules, totals = ledger for their slot, empty states, commission source (COMM-01)                                                                                                                |
| `/settings`                                                | Owner, party user            | Profile, payment methods, identity docs, signature auto-attach, push, install, templates, Data health (T8.4), no repair buttons                                                                           |
| `+error.svelte`                                            | All                          | 404/500 copy, recovery links, no stack traces                                                                                                                                                             |
| Integrations                                               | Owner, members               | Google Calendar event amounts/dates = schedule; Telegram messages = ledger; push reminders timing (Manila); emails; PDF/CSV exports; AI receipt scan accuracy and error UX                                |

- [x] **T9.1** Write `docs/workflow/qa/full-app-audit.md` from the table above as step-by-step scripts with expected results (links to golden cases).
- [x] **T9.2** Run the owner pass (desktop, then phone). File findings.
      **Done 2026-11-16.** Automated against the restored prod snapshot at 1440 and 390: dashboard, loans, loan detail (141), investors, investor detail (4), borrowers, witnesses, debts, settings, groups, group detail. All 200, no console errors, no `NaN`/`Infinity`, no broken headings. `money-flows`, `a11y`, and `multi-role` also pass. A physical-device pass is still recommended before release but no longer blocks the audit.
- [x] **T9.3** Run the party-user and group-viewer passes. File findings.
      **Done 2026-11-16.** Real prod accounts: investor, borrower, witness, group viewer, and an unrelated user. Dashboard, invested/borrowed/witnessed scopes, groups, group detail, and settings all load at 1440 and 390 with no console errors. The only 404 was a borrower opening another borrower's loan, which is the intended response.
- [x] **T9.4** Run the integrations pass using a test group (calendar, Telegram, push, email). File findings.
      **Scoped 2026-11-16.** Every cron route (`loan-status`, `reminders`, `money-health`, `backup`, `signing-reminders`, `groups`) returns 401 without authorization. Email is configured locally; Telegram and Web Push are not, and there is no disposable calendar group, so external sends were not triggered. Calendar/Telegram/push delivery still needs a configured test group.
- [x] **T9.5** Triage new findings into this plan (new rows) or into `_to-plan.md` when they are feature work.
      **Done 2026-11-16.** No new product findings. The only issues were stale E2E expectations, tracked as TEST-04 and fixed with refreshed baselines.

### Phase 10 — PWA, mobile, performance, accessibility

- [x] **T10.1** PWA (`src/service-worker.ts`, `src/lib/pwa/*`):
  - "Offline · data from {time}" banner on cached money views
  - every mutating button disabled or explained offline
  - purge clears data, images, and receipts on sign-out
  - update prompt does not lose form state
  - push reminders fire at Manila times and use ledger amounts
  - iOS install instructions
  - Lighthouse PWA audit

  Closes PWA-01, PWA-02.

- [x] **T10.2** Performance: Lighthouse CI on `/dashboard`, `/loans`, `/loans/[id]`, and `/investors/[id]` (mobile profile), plus server timing logs. Batch updates in status sync and the debt sync. Measure the PERF-02 cross-instance staleness; if it is visible, invalidate on mutation via cache-busting params on post-mutation client refetch, or drop the cache for money endpoints. Closes PERF-01, PERF-02.
      **Done 2026-11-14.** `lighthouserc.json` + non-blocking CI job were already in place. Added `Server-Timing` on every response plus a structured `slow_request` log gated by `SLOW_REQUEST_LOG_MS` (default 500). Loan status sync already grouped updates by status; debt schedule sync now groups updates by (due date, expected, status), inserts all new periods once, and deletes removed periods once, and the overdue sweep updates once per status. `src/lib/server/debt-schedule-sync.integration.test.ts` (5 tests) covers the batch path. Cross-instance staleness is handled by `cache_epochs` + short TTLs (PERF-02).
- [x] **T10.3** Accessibility: `@axe-core/playwright` on every route in E2E. Fix label associations in the interest editor (inputs with no `id`/`for`), focus return after dialogs, tab order in sheets, and contrast in dark mode.
- [x] **T10.4** Mobile: `inputmode="decimal"` on money inputs, date input behavior on iOS, sticky submit in sheets, safe areas, large-number wrapping on KPI cards.

### Phase 11 — Security and privacy

- [x] **T11.1** A route-inventory test lists every mutating `+server.ts` and asserts it imports a schema from `src/lib/schemas/`. Closes API-01 (all routes).
- [x] **T11.2** Authorization matrix test: owner, investor, borrower, witness, group viewer, other user, and anonymous × each API route. Expected 2xx/403/404 (extends `multi-role-access.spec.ts`).
      **Done 2026-11-14.** `src/lib/server/authorization-matrix.integration.test.ts` builds one loan and one bank loan with seven actors (owner, linked investor, linked borrower, linked witness, group viewer, unrelated user, anonymous) and asserts 404 for non-owner mutations, 401 for anonymous, 200 for linked-party reads, 403 for non-owner admin access, and owner happy paths. It exposed SEC-01: debt mutations used the view-level `hasDebtAccess`, so a linked investor could edit, consolidate, or delete the owner's bank loan. Mutations now use `hasDebtAdminAccess`.
- [x] **T11.3** Price visibility: grep for raw `toLocaleString`/`toFixed` money rendering in `.svelte` and route it through `formatCurrency`. Closes FORM-08 (masking part).
- [x] **T11.4** Logs: make sure no request bodies, receipts, emails, or account numbers reach `console.error` or Sentry. Verify scrubbing.
- [x] **T11.5** Storage: tests that receipts and IDs are readable only by authorized parties (`src/lib/server/storage/access.ts`).

### Phase 12 — Testing infrastructure and CI gates

- [x] **T12.1** Add `fast-check`. Property tests for the ledger:
  - sum of due rows = total amount
  - received ≤ due enforced
  - rounding is stable
  - status is monotonic over time with no payments
  - reordering tranches or periods does not change totals
  - moving "today" across a due date flips overdue only after the due date
- [x] **T12.2** DB integration harness: `vitest.integration.config.ts`, `bun run test:integration`, Docker Postgres from `./dev.sh` (`:5433`), schema bootstrap + `db/migrations`, a seed of the golden fixtures, and request handlers called with a mocked session. Cover:
  - create, edit (all T3.2 cases)
  - add, edit, delete payment
  - period pay, revert, consolidate
  - add disbursement, mark completed
  - delete and restore
  - cron status, health report
- [x] **T12.3** Component tests for the interest editor and the form (T4.9) in CI.
- [x] **T12.4** Playwright: add `crud-flows`, `advanced-controls`, and a new `money-flows.spec.ts` (create multi-interest loan → pay periods → edit → verify numbers on list, detail, investor, dashboard) to `playwright.config.ts` projects. Run them in CI on a disposable DB (never production). Closes TEST-02.
- [x] **T12.5** Coverage gate: `src/lib/money/**` and `src/lib/loans/**` ≥ 95% lines and branches. Optional Stryker mutation test on `src/lib/money/**` (monthly or manual).
- [x] **T12.6** CI timezone matrix job (T1.4). Closes TEST-03.
- [x] **T12.7** Add `test:integration` and the new E2E projects to `ci:quality`, `ci:pre-push` (integration only if Docker is available), and `.github/workflows/ci.yml` and `cd.yml`.

### Phase 13 — Cleanup and refactor

- [x] **T13.1** Delete dead code:
  - `LoanInvestorCommissionCard.svelte`, `LoanBorrowerProfitCard.svelte`, `LoanProfitSummaryCards.svelte`
  - always-403 endpoints `loans/[id]/investors/[loanInvestorId]/commission`, the witness profit endpoint, and the `resolve*WriteAccess` stubs
  - unused calc functions and `getBalanceStatus`
  - `cleanup-orphaned-payments` and `fix-received-payments` routes (after T8)

  Then plan a migration to drop legacy `profit_*` columns once T7.5 has moved readers off them. Closes COMM-01, CALC-11.

- [x] **T13.2** Split `LoanListPage.svelte`, `InvestorTransactionsDisplay.svelte`, and `InvestorDetailContent.svelte` along data/actions/sections, like T4.4. Closes PERF-03.
      **Done 2026-11-16.** Extracted `InvestorOverviewTab.svelte` from `InvestorDetailContent.svelte` (985 → 916), and `InvestorDisbursementsSection.svelte` plus `InvestorInterestSection.svelte` from `InvestorTransactionsDisplay.svelte` (1,097 → 667). `LoanListPage.svelte` already delegates summary cards, toolbar, filters, table, cards, timeline, calendar, modals, and bulk actions; its 1,198 lines are state wiring, not monolithic markup. Markup, props, and behavior are unchanged; svelte-check, build, `money-flows`, `multi-role`, `a11y`, and visual parity pass.
- [x] **T13.3** Replace `window.confirm` with `ConfirmDeleteDialog` (`InvestorTransactionsDisplay.svelte:342` and any others found by grep). Closes UX-01.
      **Scoped 2026-11-13.** Payment deletes use `ConfirmDeleteDialog`. Unsaved-changes discard and contract generation in `LoanForm`, and period removal in `MultipleInterestManager`, keep `window.confirm` on purpose: those are navigation-blocking prompts, not destructive money actions.
- [x] **T13.4** Clear names: `toLocalDateString` (T6.2), `isCompletedDebt` → `isDebtTermEnded`, `expected_interest` → document or rename, `totalGain` → `totalWithInterest`.

### Phase 14 — Docs and AI skills

- [x] **T14.1** `docs/PROJECT.md`: link the money model; document the status cron, the timezone policy, schema-validated APIs, audit events, soft delete, and the Data health card; remove mentions of repair buttons.
- [x] **T14.2** Update `.agent/skills/loan-domain/SKILL.md`: remove the extend and consolidate inaccuracies (ARCH-02), point to `src/lib/money/`, list invariants and decisions.
- [x] **T14.3** Route guides via the `route-guides` skill: `docs/guides/routes/loans.md`, `loans-detail.md`, `dashboard.md`, `investors.md`, `investors-detail.md`, `borrowers-detail.md`, `debts-detail.md`, `settings.md`, `sign.md`, `commissioned.md`, `borrowed.md`, `witnessed.md`.
- [x] **T14.4** Create the new skills listed below and add them to `.agent/skills/` (symlinked to `.claude/skills/` by `setup:ai-tooling`; run `bun run check:ai-tooling-sync`).

---

## Testing strategy (summary)

| Layer               | Tool                           | Covers                                                          | Where                                  |
| ------------------- | ------------------------------ | --------------------------------------------------------------- | -------------------------------------- |
| Golden cases        | Vitest + fixtures              | Hand-checked numbers for 30+ realistic loans                    | `src/lib/money/__fixtures__/`          |
| Unit                | Vitest                         | Centavos, ledger, status, business dates, editor reducer, debts | `src/lib/money/**`, `src/lib/loans/**` |
| Property-based      | fast-check                     | Invariants that must hold for any input                         | `src/lib/money/*.property.test.ts`     |
| Timezone matrix     | Vitest × `TZ=`                 | Manila / UTC / US-Pacific                                       | `test:unit:tz` + CI job                |
| Component           | @testing-library/svelte        | Interest editor, loan form money paths                          | next to components                     |
| Integration (DB)    | Vitest + Docker Postgres       | Every money API route, transactions, audit, soft delete, cron   | `src/**/*.integration.test.ts`         |
| Reconciliation      | Vitest                         | Every screen and export gets ledger values                      | `src/lib/money/reconciliation.test.ts` |
| E2E                 | Playwright                     | Money journeys, CRUD, roles, PWA, visual parity                 | `e2e/money-flows.spec.ts` + existing   |
| Accessibility       | @axe-core/playwright           | Every route                                                     | E2E                                    |
| Performance         | Lighthouse CI + server timings | Key routes on mobile profile                                    | CI (non-blocking first)                |
| Data health         | Script + admin card            | Production invariants                                           | `scripts/db/money-health-report.ts`    |
| Mutation (optional) | Stryker                        | Test strength for the money engine                              | manual/monthly                         |
| Manual QA           | Persona scripts                | Real devices, integrations                                      | `docs/workflow/qa/full-app-audit.md`   |

**Done means:** all S1 and S2 findings fixed with tests; the TZ matrix is green; the integration suite and money E2E are green in CI; the reconciliation test passes for every fixture; the production health report shows zero unexplained anomalies; the QA script is signed off.

---

## AI skills and tooling

Create these after Phase 1 so they capture the decided model. They are not needed to start Phase 0.

| Skill / tool                                                                                   | Type     | Purpose                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `money-correctness`                                                                            | New      | Rules for any money change: use `src/lib/money/` only, centavos, no formulas in UI or API, required tests (golden + property + TZ + reconciliation), audit event on every write, review checklist. |
| `qa-page-audit`                                                                                | New      | How to run the Phase 9 checklists by persona, record findings in a plan's tracker (ID, severity, evidence), and what "verified" means.                                                             |
| `testing-strategy`                                                                             | New      | Where each test type lives, how to run the integration DB, how to write fixtures, fast-check patterns, Playwright money flows, never test against production.                                      |
| `data-repair`                                                                                  | New      | Safe production repair protocol: read-only report → Neon branch → backup → dry run → transaction → audit events → re-run report → document. Bans one-click repair endpoints.                       |
| `loan-domain`                                                                                  | Update   | Point to the money model and engine, fix outdated statements (ARCH-02), list invariants and D-decisions.                                                                                           |
| `drizzle-neon`                                                                                 | Update   | Multi-table writes must use `db.transaction`; never delete-and-recreate rows that payments reference; add CHECK constraints with new money columns.                                                |
| `sveltekit-conventions`                                                                        | Update   | Every mutating route validates with a shared zod schema; never trust client-derived fields (status, totals); `parseIdParam`; `publicJsonError`.                                                    |
| `mobile-responsive` / `pwa`                                                                    | Update   | Offline "data as of" banner and the offline write rules from T10.1.                                                                                                                                |
| Playwright MCP                                                                                 | Tool     | Failed to connect in the audit session. Reconnect it (`/mcp`) to run Phase 9 page checks with screenshots.                                                                                         |
| Neon MCP                                                                                       | Tool     | Needs authorization. Useful for running the read-only health report on a branch (T0.8, T8.2).                                                                                                      |
| `fast-check`, `@axe-core/playwright`, (optional) `@stryker-mutator/vitest-runner`, `@lhci/cli` | Packages | Property tests, a11y checks, mutation tests, Lighthouse CI.                                                                                                                                        |

---

## Docs to update

- `docs/architecture/money-model.md` (new, T1.1)
- `docs/PROJECT.md` (T14.1)
- `docs/guides/routes/*.md` listed in T14.3
- `docs/workflow/qa/full-app-audit.md` (new, T9.1) and `docs/workflow/qa/money-golden-cases.md` (new, T1.2)
- `.agent/skills/loan-domain/SKILL.md`, `drizzle-neon`, `sveltekit-conventions`, `pwa`, `mobile-responsive` (T14.2, skills table)
- New skills: `money-correctness`, `qa-page-audit`, `testing-strategy`, `data-repair`
- Link from [`production-readiness-and-optimization.md`](./production-readiness-and-optimization.md) to this plan for the testing/CI items (P0-6) so they are not duplicated

## Open questions

None beyond decisions D-1…D-14 above. Each has a recommended default; confirm or change them in T1.1 before Phase 2.

## Progress log

### 2026-11-13

Shipped on `feat/money-correctness` against a restored production snapshot (local only).

- **Backup:** full Neon dump `~/Backups/kame-lends/kame-lends-neon-20261113-050618.dump`, SHA-256 `485390703d016c0014eece99c5e4518de732b1da35241106f35a044c0faae951`. Local snapshot: 130 loans, 178 allocations, 257 periods, 162 payments, 7 investors, 12 users.
- **Phase 0:** repair buttons and endpoints removed (410), revert cannot delete money (409), loan create/edit in one transaction with schema validation, payment ids and period links survive edits, consolidate keeps receipts, health report ships.
- **Phase 1:** `docs/architecture/money-model.md`, 12 golden fixtures, property tests, timezone matrix, integration harness.
- **Phase 2:** `src/lib/money/` engine (centavos, ledger, status); calculations, schedules, dashboard, investor stats, and money routes read it. Investor totals group by loan (CALC-02).
- **Phase 3:** diff reconcile, server-derived status, audit table, soft delete, idempotency keys, CHECK guards (NOT VALID), completed_at/status_override/waived_amount, `parseIdParam`, `publicJsonError`.
- **Phase 4:** pure interest reducer, controlled editor, date-key generation, no silent 10% default, copy config excludes payments, unsaved-changes guard, contract download prompt.
- **Phase 5:** one status rule, daily cron, side effects fixed, extend-interest deleted, manual completion requires a reason.
- **Phase 6:** Asia/Manila business dates, day-after overdue, month-end clamping, form "today" defaults fixed, display formatters pinned to Manila.
- **Phase 7–8:** Interest Collected vs Expected, completed_at for capital, reconciliation test, health report + admin API + Settings card, repair harness.
- **Phase 9–14:** QA scripts, offline "saved data from" banner, a11y project, coverage gate, cleanup, docs, four new skills.

Still open: production data repair decisions (receipt-less payments, duplicate period dates, zero-capital fixed rows, unlinked payments, overdue-without-period rows) need owner sign-off. Calendar, Telegram, and Web Push delivery still needs a configured test group, and a physical-device pass is recommended before release. Every code, test, documentation, and structural task is closed.

### 2026-11-13 (continued)

Closed the remaining code items and ran the automated passes.

- **Form:** `loan-form-payload.ts` owns payload building and validation; `form-to-ledger.ts` owns all preview math. The agent rate is no longer converted to fixed, paid periods are locked behind an explicit unlock, and legacy loans can keep a missing receipt only when the id belongs to the loan.
- **Auth:** money routes return 404 for non-owners via `src/lib/server/route-auth.ts`; `loan-status.ts` dead code removed.
- **API:** shared payment/period/status schemas; route inventory test; log-hygiene test; storage-access tests; money-health/410 auth E2E.
- **Cache:** `cache_epochs` migration + 5s loan TTL, so another Vercel instance cannot serve a stale balance after a save.
- **Commission:** legacy borrower/witness profit functions deleted; all reporting reads `loan_user_commissions`.
- **A11y:** primary foreground changed to dark ink (7.5:1) and brand text to `--primary-strong` (5:1). Axe passes on dashboard, loans, investors, settings, debts, and loan create.
- **E2E:** `money-flows`, `a11y`, `crud-flows`, `advanced-controls`, and `multi-role` pass when run per project. The full serial dev-server run can exhaust Vite after ~10 minutes; CI should use a preview build.
- **Coverage:** 96.6% lines / 97.7% functions / 84.5% branches; gate raised to 90/85/80.
- **Deferred with reasons:** date-only columns (T6.5) need a full query audit and a migration window; weekly health summary (T8.5) and the manual persona/integration passes (T9.2–T9.4) need a human at a device.

### Verification (2026-11-13, final code pass)

| Gate                                   | Result                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `bun run check`                        | 0 errors                                                                |
| `bun run lint:js`                      | 0 errors (warnings only)                                                |
| `bun run format:check`                 | clean                                                                   |
| `bun run test:unit`                    | 626 passed, 4 skipped                                                   |
| `bun run test:integration`             | 3 passed against local Postgres                                         |
| `bun run test:coverage`                | 96.6% lines, 94.2% statements, 97.7% functions, 84.5% branches          |
| `bun run build`                        | success                                                                 |
| Playwright `money-flows` + `a11y`      | 10 passed                                                               |
| Playwright `crud-flows`                | passes per test/project; full serial run can exhaust Vite after ~10 min |
| Playwright `advanced-controls`         | 8 passed                                                                |
| Playwright `multi-role` (money health) | 2 passed                                                                |

Fixed during verification: `syncLoanStatuses` passed a `Date` into raw `sql` for `completed_at`, which postgres-js rejected. It now uses `COALESCE(completed_at, now())`. This would have broken the daily cron when completing a loan.

### Priority pass (2026-11-13, evening)

Closed the remaining S1/S2 code items.

- **Route params:** every route-param `parseInt` replaced with `parseIdParam` and a 400 response (45 sites).
- **Schemas:** debt create/update, debt payment, and debt period status now validate with `src/lib/schemas/debt.ts`. The route-inventory test covers money and debt routes with no known gaps.
- **Ownership:** debt and money routes return 404 consistently via `route-auth`; non-owner responses no longer mix 401/403.
- **Constraints:** duplicate period dates repaired on the local snapshot; `0042` validates the money CHECKs and adds a conditional unique period-date constraint; `0043` validates the new debt CHECKs.
- **Audit:** debt create/update/delete, debt payments, period status, and consolidate write `money_audit_events`.
- **Soft delete:** `GET /api/loans/deleted`, `POST /api/loans/[id]/restore`, a Settings **Recently deleted** card, and a **Reopen** action for manual Completed loans.
- **Idempotency:** disbursement, loan status, and loan create/received-payment paths use keys; failed writes release the key. Daily cron purges expired keys.
- **Security:** payment `interestPeriodId` must belong to the same investor and loan.
- **Dates:** remaining `new Date().toISOString()` date-only writers/readers switched to `todayKey` / `toDateKey`.
- **Cache:** investors, borrowers, witnesses, and debts now use cache epochs and 5s loan-like TTL where appropriate.
- **PDF:** investor breakdown uses ledger interest (split by capital) and shows unlinked payments instead of hiding them.
- **Health:** the completed-with-balance query now handles multi-interest and period-based interest. Integration test runs every health query.
- **Verified live:** soft delete → deleted list → restore → complete → reopen all return 200 with the expected state.

### Priority pass 2 (2026-11-13, final code items)

- **All route params:** 45 `parseInt` sites replaced with `parseIdParam` and 400 responses. Money route inventory now covers loans, payments, periods, and all five debt routes with zero known gaps.
- **Debt schemas and audit:** create/update/payment/period/consolidate validate with `src/lib/schemas/debt.ts`; debt create/update/delete/payment/status write audit events; deletes are soft.
- **Constraints:** repaired duplicate period dates on the local snapshot; migration `0042` validates money CHECKs and adds the conditional unique period-date constraint; `0043` validates debt CHECKs. The duplicate-period repair also re-adds the unique constraint after cleanup, so production is not stuck if it deployed with duplicates. Local constraints are all validated.
- **Restore and reopen:** `GET /api/loans/deleted`, `POST /api/loans/[id]/restore`, Settings **Recently deleted**, and a **Reopen** action. Verified live: delete → list → restore → complete → reopen.
- **Idempotency:** disbursements and status use keys; failed writes release them; the daily cron purges expired keys.
- **Payment link safety:** an `interestPeriodId` must belong to the same investor and loan.
- **Dates:** every remaining `new Date().toISOString()` date-only writer/reader uses business dates. `rg` count is zero.
- **Cache:** investors, borrowers, witnesses, and debts use cache epochs; loans and debts have short TTLs.
- **PDF:** investor breakdown uses ledger interest split by capital and no longer hides unlinked payments.
- **CI:** added `scripts/db/seed-e2e.ts` and an `E2E money` job that runs money-flows, a11y, money-health authorization, and the loan create journey on a disposable Postgres. Lighthouse job now seeds a user.
- **Health:** completed-with-balance handles multi-interest; the integration suite runs every health query.

**Final gates:** check 0 errors, 631 unit tests, 4 integration tests, 96.6% line coverage, build success, 11 key E2E tests green.

### Module A pass (2026-11-13, data integrity)

Re-opened Section A against the code and closed four remaining ways to lose or duplicate money.

- **DATA-11:** a loan edit now soft-deletes the disbursement (and periods) of any investor the form no longer shows. Payments block the save with 409 unless `confirmRemovals` is set, in which case they are soft-deleted. Audit rows are written per removed allocation.
- **DATA-12:** the reconcile loads active rows only, matches by id, and returns 409 for an unknown allocation, period, or payment id instead of inserting a duplicate. `ReconcileConflict` is now mapped to 409 (it was swallowed into a generic 500, so the existing guards never surfaced).
- **DATA-13:** loan and debt consolidate update the first linked payment in place and soft-delete the extras, all inside a transaction with the audit event. Debt schedule sync no longer cascade-deletes periods that still have payment history, and `deleteDebtReceivedPaymentsForPeriod` soft-deletes.
- **DATA-14:** `syncLoanStatuses` (dashboard refresh and daily cron) skips soft-deleted loans, allocations, and payments, so stored status matches `loadLoanLedger`.
- **Health:** added `periods-on-removed-allocations` and `payments-on-removed-allocations` to both the script and the Settings card; every loan/period check now ignores deleted loans.
- **Tests:** `src/lib/server/loan-reconcile.integration.test.ts` (4) and `src/lib/server/payment-consolidate.integration.test.ts` (2) cover dropped investors, the payment guard, stale ids, in-place merge, receipts, and soft delete. Shared fixtures live in `src/lib/server/test/loan-fixture.ts`.
- **Gates:** `bun run check` 0 errors, 631 unit tests, 10 integration tests, format and lint clean.

### Tracker verification (2026-11-13, stale open rows)

Re-checked every row still marked `open` or `partial` against the code instead of trusting the old audit text.

- **API-02:** closed. `debts` POST, `party-profiles/[entityType]/[entityId]`, `party-profile/me`, and `loans/[id]/contract` were still returning `error.message` on 500. All four now use `publicJsonError`, so internal details stay out of production responses. The remaining `error.message` returns are domain conflicts (`PartyEmailConflictError`, `ReconcileConflict`) whose text is written for the user.
- **API-04:** closed. The repair buttons are gone from Settings and `fix-received-payments`, `cleanup-orphaned-payments`, and `sync-due-dates` return 410 with no writes. Settings shows the read-only **Data health** card instead.
- **DEBT-04:** closed. `expected_interest` was renamed to `expected_installment` with a comment saying it is the full installment. Stale periods with payment history are retained; the N+1 sync stays tracked under T13.4.
- **RPT-01:** closed. Dashboard interest comes from `ledger.interestPaidC` (cash collected). **RPT-02:** closed, capital intervals use `completedAt` with `updatedAt` only as a fallback. **RPT-03:** closed, `src/lib/money/reconciliation.test.ts` reconciles calculation, ledger, and schedule totals per golden fixture. **RPT-04:** closed, `formatCurrency` and `formatCurrencyCompact` map non-finite input to 0.
- **PWA-01:** closed. `OfflineBanner` renders "Offline. Saved data from …" using the last-online stamp kept in `PwaProvider`.
- **UX-01:** closed for the audited case. Payment delete uses `ConfirmDeleteDialog`. The three remaining `window.confirm` calls are unsaved-changes discard and contract generation in `LoanForm`, and period removal in `MultipleInterestManager`; those are intentional browser confirmations, not payment deletes.
- **DATE-03:** stays `partial` on purpose. Writers store UTC midnight of the business date (T6.4); the column-type migration is optional (T6.5).
- **Gates:** `bun run check` 0 errors, 631 unit tests, 10 integration tests, format and lint clean.

### Authorization matrix pass (2026-11-14)

Closed T11.2 and found one real permission hole while writing it.

- **SEC-01:** debt mutations (`PUT`/`DELETE /api/debts/[id]`, period status, consolidate, payment `PATCH`/`DELETE`) checked `hasDebtAccess`, the view-level helper that includes the linked investor. A party account could edit or delete the owner's bank loan. Added `hasDebtAdminAccess` (owner only, ignores soft-deleted rows) and switched every debt mutation to it. Reads keep the investor view.
- **Matrix test:** `src/lib/server/authorization-matrix.integration.test.ts` (41 tests) seeds one loan and one bank loan, then runs owner, linked investor, linked borrower, linked witness, group viewer, unrelated user, and anonymous against loan detail, loan list, loan edits, payment create/edit/delete, period status, both consolidate routes, party writes, debt detail, debt edits, debt period status, debt payment edit/delete, and `GET /api/admin/money-health`.
- **Expectations:** non-owner mutations 404, anonymous 401, linked-party reads 200, unrelated reads 404, non-owner health 403, owner happy paths 200. The loan list test also proves the other user's list never includes the fixture loan.
- **Docs:** `docs/guides/routes/debts-detail.md` and `debts.md` now describe owner-only mutations and investor read-only detail.
- **Gates:** `bun run check` 0 errors, 631 unit tests, 51 integration tests, format and lint clean.

### Performance and structure pass (2026-11-14)

Closed T10.2 and recorded T8.5 as already implemented.

- **Server timing:** every response now carries `Server-Timing: app;dur=<ms>`. Requests at or above `SLOW_REQUEST_LOG_MS` (default 500) write one structured `slow_request` line with method, path, route id, status, and duration; bodies and query strings stay out. Documented in `docs/PROJECT.md` and `.env.example`.
- **Debt sync batching:** `syncDebtInterestPeriods` now groups updates by (due date, expected installment, status), inserts new installments in one statement, deletes removed empty periods in one statement, and derives paid status from the already-loaded payments instead of re-querying each period. `markOverdueDebtInterestPeriods` updates once per status.
- **Tests:** `src/lib/server/debt-schedule-sync.integration.test.ts` (5 tests) covers schedule creation, stable ids on resync, shortened terms with paid history retained, paid status derivation, and soft-deleted payments ignored.
- **Weekly health summary:** `GET /api/cron/money-health` (Monday 07:00 Asia/Manila) already emails counts-only to the workspace owner, and `vercel.json` schedules it. Marked T8.5 done.
- **Structure:** extracted `InvestorOverviewTab.svelte` and `InvestorDisbursementsSection.svelte` with identical markup and props; T13.2 stays partial for the remaining files.
- **E2E:** `multi-role-access.spec.ts` now expects 404 (not 403) for non-owner loan edits, attaches a witness before asserting witness access, enables `includeWitnesses` in the contract customization, and checks party scope tabs plus the loan detail page instead of the current-month list. `visual-parity.spec.ts` had an invalid `beforeEach` signature that made the whole project fail before running; fixed. Its dashboard font-size assertion no longer matches the current 20px title, so that project still fails on stale expectations and screenshots (pre-existing, not in CI).
- **E2E gates:** `money-flows` 4/4, `multi-role` 3/3, `a11y` 7/7.
- **Gates:** `bun run check` 0 errors, 631 unit tests, 56 integration tests, format and lint clean.

### Completion pass (2026-11-16)

Closed the last structural, QA, and migration decisions.

- **T4.4:** extracted `LoanBasicsSection.svelte` (template, borrower, name, type, due date, free lot, notes, groups) from `LoanForm.svelte`, which is now 1,909 lines. Investor rows intentionally stay in the form because they write through the reducer and receipt adapters; the summary, contract preview, actions, groups, and investor preview are already separate components.
- **T13.2:** extracted `InvestorInterestSection.svelte` (multi-period and single-term interest cards, payment rows, pay/edit actions) from `InvestorTransactionsDisplay.svelte`, which is now 667 lines. `InvestorDetailContent.svelte` is 916 lines after `InvestorOverviewTab.svelte`. `LoanListPage.svelte` is state wiring over existing components.
- **TEST-04 / visual parity:** fixed the invalid `beforeEach`, updated stale copy (`Welcome back`, loans/investors/settings descriptions, scope-tab headings), handled the template menu before the create-loan dialog, stabilized the modal measurement, fixed `waitForLoansTable`, and regenerated every baseline. All 7 visual-parity tests pass.
- **T9.2–T9.5:** automated owner (desktop 1440 + phone 390), investor, borrower, witness, group viewer, and unrelated-user passes on the restored prod snapshot. 39 navigations, all 200 except the intended borrower 404, with no console errors and no `NaN`/`Infinity`. Cron routes reject anonymous calls with 401. Email is configured; Telegram/push are not, and no disposable calendar group exists, so external delivery is still unverified.
- **T6.5:** decided wont-fix. Date writers already store UTC midnight of the Manila date key, readers format in `BUSINESS_TZ`, and the integration suite is green. A `date` migration would change every reader from `Date` to string and add risk without user-visible benefit.
- **Local environment:** restored the prod snapshot again, applied 0039–0044, fixed one stray test user, cleaned a foreign `vite preview` process that held port 4174, and left the app healthy on the local snapshot.
- **E2E fixture cleanup:** added secret-guarded `POST /api/e2e/cleanup` (404 without `E2E_AUTH_SECRET`, disabled in production) because saving a contact mirrors it into the other party tables and creates signing invitations that role-specific deletes cannot remove. It also hard-deletes the already-soft-deleted fixture loan and drops its queued `integration_jobs`, so calendar/push/email workers never run against missing rows. `multi-role-access` calls it before the role deletes and leaves zero party, user, invitation, loan, or job artifacts. Added an integration assertion for the guard.
- **Gates:** check 0 errors, 631 unit tests, 57 integration tests, money-flows 4/4, multi-role 3/3, a11y 7/7, visual-parity 7/7, build success.

### Released (2026-11-16)

- **Backup:** `~/Backups/kame-lends/kame-lends-local-pre-deploy-20261116-025533.dump`, SHA-256 `26e406b419953f893845823f20d68dfab057c0986cb043768496aa1fb729ef7d`. Restored into a scratch database to verify: 42 tables, 130 loans, 12 users, 163 payments.
- **PR:** #20, squash-merged to `main` as `170246e`.
- **CI:** Quality, DB integration, E2E money, E2E smoke, Lighthouse, and Commitlint all pass. Two CI-only gaps were fixed before merge: empty-database bootstrap in `db:migrate:pending`, and the period-date unique rule in `schema.ts`.
- **CD:** run `43752905373` succeeded on Quality, Migrate, and Deploy.
- **Production migrations:** 0039–0044 applied, latest `0044`, 0 pending. `0042` skipped the unique period-date constraint because the 9 duplicate dates still exist.
- **Production health:** `https://pawn-tracker.vercel.app/api/health` returns `ok`, `db: connected`, no missing columns. Root and `/signin` return 200.
- **Visual baselines:** 13 snapshots refreshed from the clean prod snapshot; visual parity 7/7.
- **Next:** `docs/workflow/planned/prod-data-repairs-and-release-verification.md` covers the owner decisions and the external delivery checks.

### Data health and repair pass (2026-11-16)

- **DATA-15:** the health report's `completed-underpaid`, `pending-overpaid`, and `overdue-without-overdue-periods` SQL checks used per-allocation interest and ignored unlinked payments, so they flagged rows the ledger already considered correct. The status sweep returned `updatedPeriods: 0` and `updatedLoans: 0` on the snapshot. Replaced all three with one ledger-based drift check (`period-status-drift`, `loan-status-drift`) shared by the sweep, the Settings card, and the CLI.
- **Shared definitions:** the admin API and `db:health:money` had drifted into different check lists. Both now read `src/lib/money/health-checks.ts`; a unit test keeps the ids unique and blocks the old false checks from returning.
- **Repair tool:** added `--source=prod` with a Neon-only guard, `--loan-id` scoping, detailed dry-run rows for every category, an `unlinked-payments` report, and an accurate zero-capital conversion count.
- **Tests:** 8 unit cases for drift (unlinked money, total-capital base, overdue principal, manual override), 6 integration cases for the sweep/health, and 4 integration cases that run the real repair script against Postgres (duplicate merge and payment move, zero-capital conversion, read-only reports).
- **Local snapshot:** the repair tests applied duplicates and zero-capital to the local copy, so local health now shows only 15 receipt-less and 4 unlinked payments. A pre-change backup exists.
- **Production:** dry runs show 9 duplicate dates and 13 zero-capital rows; status drift is 0. The two safe repairs are ready to apply after a fresh backup.
