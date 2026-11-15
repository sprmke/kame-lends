---
name: loan-domain
description: "Use when changing loans, investors, interest periods, payments, debts, or the investor portal."
---

# Loan domain — Kame Lends / PawnTracker

Use when changing loans, investors, interest periods, payments, debts, or the investor portal.

## Loan types

- **Lot Title**, **OR/CR**, **Agent** — each has type-specific fields and contract templates.
- Status is **derived** by `src/lib/money/status.ts`: Completed when balance ≤ 0 (principal and interest), Overdue when anything is past due, Partially Funded when a disbursement is unpaid, otherwise Fully Funded. Overdue starts the **day after** the due date in Asia/Manila.
- A manual `Completed` is the only override. It requires a reason and stores `status_override`, `status_reason`, `completed_at`, and an optional `waived_amount` (D-7).

## Interest periods

- Loans can have **multiple interest periods** per investor allocation.
- Periods link to received payments. Status is derived from the linked sum: Completed, Incomplete, Pending, or Overdue.
- **Consolidate payment** replaces the linked rows in one transaction and keeps prior receipts. **Extend interest** was removed (D-11); plan a proper Extend term action instead.
- Money math lives in `src/lib/money/` only. `src/lib/calculations.ts` and `src/lib/loan-payment-schedule.ts` are thin adapters over `buildLoanLedger`.
- Calendar, timeline, Google Calendar, Telegram, and daily summary amounts come from `buildLoanPaymentSchedule`, which is a view over the ledger. Unpaid/overdue interest rolls into the loan due row; paid or future interest keeps its own date.
- Reverting a paid period never deletes payments. Delete the payment explicitly (D-10).
- Read `docs/architecture/money-model.md` before changing any formula.

## Investors

- **Admin** sees full workspace and can create, edit, and delete.
- **Investor / borrower / witness** memberships are links on one Auth user (Google email), not separate accounts.
- Per-investor: principal disbursement, received payments, rates, schedules. Only the workspace admin records payments.
- An investor's totals are grouped **by loan, then by investor**. Two loans never share a schedule (CALC-02).
- A zero-capital (agent) allocation earns its rate on the loan principal (D-1).
- Copy investor / copy period duplicates interest configuration only. It never copies payments or receipts.

## Borrowers & debts

- Borrowers are first-class entities linked to loans.
- Debts have their own interest periods and payment schedules (`src/lib/debt-calculations.ts`).

## Multi-role access

- Memberships: owner, investor (`investor_user_id`), borrower (`borrower_user_id`), witness (`witness_user_id`).
- One user can hold all three party memberships. `users.role` is a label, not an exclusive type.
- Owner: full edit. Investor, borrower, and witness: read-only. Signing still allowed for their slot.
- Party users: `/investments`, `/borrowed`, `/witnessed` (empty states stay open). Admins also get `/loans`, `/debts`, `/investors`, `/borrowers`, `/witnesses`.
- **Groups** (`/groups`, `src/lib/server/group-access.ts`) — Loan Groups v2: derived membership from loan parties; group members get read-only view of every loan in the group (separate from `hasLoanViewAccess`). Any signed-in user can create; creator/workspace admin manage. Behind `SHOW_GROUPS_UI`.

## Contracts & signing

- Authenticated `/loans/[id]/sign`; Google email must match party email.
- Legacy `/sign/[token]` redirects after login. New invitations do not use tokens or expiry.

## Calendar sync

- Optional Google Calendar: disbursements, due dates, interest due, daily summaries.
- Sync is **manual** from settings (not on every save).

## Privacy toggle

- Price visibility store masks names, amounts, dates, rates, counts across the app.

## Where to look

| Concern        | Path                                                                |
| -------------- | ------------------------------------------------------------------- |
| Schema         | `src/lib/server/db/schema.ts`                                       |
| Money engine   | `src/lib/money/` (`ledger.ts`, `centavos.ts`, `status.ts`)          |
| Money spec     | `docs/architecture/money-model.md`                                  |
| Access control | `src/lib/server/access-control.ts`                                  |
| Feature flag   | `src/lib/feature-flags.ts`                                          |
| Calendar       | `src/lib/server/group-calendar.ts`, `src/lib/calendar-summaries.ts` |

## Invariants

1. Balances, schedules, and status come from `buildLoanLedger`.
2. Payments are never re-created by an edit; ids, receipts, and period links survive.
3. Money writes run in `db.transaction` and write `money_audit_events`.
4. A loan is never Completed while principal is outstanding.
5. Overdue is the day after the due date, in Manila.

Add Vitest coverage (golden + property + timezone) for any money change.
