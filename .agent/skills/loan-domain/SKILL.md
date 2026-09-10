# Loan domain — Kame Lends / PawnTracker

Use when changing loans, investors, interest periods, payments, debts, or the investor portal.

## Loan types

- **Lot Title**, **OR/CR**, **Agent** — each has type-specific fields and contract templates.
- Status flow is mostly manual completion today; overdue is derived from due dates and period state.

## Interest periods

- Loans can have **multiple interest periods** per investor allocation.
- Periods link to received payments; `interest_incomplete` flags partial collection.
- **Extend interest** creates a new period; **consolidate payment** rolls periods on debts.
- Money math lives in `src/lib/calculations.ts` and `src/lib/debt-calculations.ts` — never duplicate formulas in UI.

## Investors

- **Admin** sees full workspace and can create, edit, and delete.
- **Investor / borrower / witness** memberships are links on one Auth user (Google email), not separate accounts.
- Per-investor: principal disbursement, received payments (cannot exceed disbursed principal), rates, schedules. Only the workspace admin records payments.
- Copy investor / copy period modals duplicate configuration across loans.

## Borrowers & debts

- Borrowers are first-class entities linked to loans.
- Debts have their own interest periods and payment schedules (`src/lib/debt-calculations.ts`).

## Multi-role access

- Memberships: owner, investor (`investor_user_id`), borrower (`borrower_user_id`), witness (`witness_user_id`).
- One user can hold all three party memberships. `users.role` is a label, not an exclusive type.
- Owner: full edit. Investor, borrower, and witness: read-only. Signing still allowed for their slot.
- Party users: `/investments`, `/borrowed`, `/witnessed` (empty states stay open). Admins also get `/loans`, `/debts`, `/investors`, `/borrowers`, `/witnesses`.

## Contracts & signing

- Authenticated `/loans/[id]/sign`; Google email must match party email.
- Legacy `/sign/[token]` redirects after login. New invitations do not use tokens or expiry.

## Calendar sync

- Optional Google Calendar: disbursements, due dates, interest due, daily summaries.
- Sync is **manual** from settings (not on every save).

## Privacy toggle

- Price visibility store masks names, amounts, dates, rates, counts across the app.

## Where to look

| Concern        | Path                                |
| -------------- | ----------------------------------- |
| Schema         | `src/lib/server/db/schema.ts`       |
| Calculations   | `src/lib/calculations.ts`           |
| Access control | `src/lib/server/access-control.ts`  |
| Feature flag   | `src/lib/feature-flags.ts`          |
| Calendar       | `src/lib/server/google-calendar.ts` |

Preserve behavior exactly; add Vitest coverage for calculation changes.
