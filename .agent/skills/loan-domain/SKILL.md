# Loan domain — Kame Lends / PawnTracker

Use when changing loans, investors, interest periods, payments, debts, or the investor portal.

## Loan types

- **Lot Title**, **OR/CR**, **Agent** — each has type-specific fields and contract templates.
- Status flow is mostly manual completion today; overdue is derived from due dates and period state.

## Interest periods

- Loans can have **multiple interest periods** per investor allocation.
- Periods link to received payments; `interest_incomplete` flags partial collection.
- **Extend interest** creates a new period; **consolidate payment** rolls periods on debts.
- Money math lives in `lib/calculations.ts` and `lib/debt-calculations.ts` — never duplicate formulas in UI.

## Investors

- **Admin** sees full workspace; **investor** role sees shared loans via Google email linkage.
- Per-investor: principal disbursement, received payments (cannot exceed disbursed principal), rates, schedules.
- Copy investor / copy period modals duplicate configuration across loans.

## Borrowers & debts

- Borrowers are first-class entities linked to loans.
- Debts have their own interest periods and payment schedules (`lib/debt-calculations.ts`).

## Multi-role access

- Memberships: owner, investor (`investor_user_id`), borrower (`borrower_user_id`), witness (`witness_user_id`).
- Owner: full edit. Investor: own allocation/payments only. Borrower/witness: read-only.
- Menus: `/loans`, `/investments`, `/borrowed`, `/witnessed`.

## Contracts & signing

- Authenticated `/loans/[id]/sign`; Google email must match party email.
- Legacy `/sign/[token]` redirects after login. New invitations do not use tokens or expiry.

## Calendar sync

- Optional Google Calendar: disbursements, due dates, interest due, daily summaries.
- Sync is **manual** from settings (not on every save).

## Privacy toggle

- Price visibility store masks names, amounts, dates, rates, counts across the app.

## Where to look

| Concern        | Legacy (Next.js)        | Target (SvelteKit)                    |
| -------------- | ----------------------- | ------------------------------------- |
| Schema         | `db/schema.ts`          | `new-app/src/lib/server/db/schema.ts` |
| Calculations   | `lib/calculations.ts`   | `new-app/src/lib/`                    |
| Access control | `lib/access-control.ts` | `new-app/src/lib/server/`             |
| Feature flag   | `lib/feature-flags.ts`  | same path under `new-app/`            |

When porting, preserve behavior exactly; add Vitest coverage for calculation changes.
