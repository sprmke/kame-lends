# Bank Loan detail (`/debts/[id]`)

**Status:** Documented  
**Updated:** 2026-09-23

## Behavior

- Shows one bank loan: **Bank Loan Summary**, payment schedule, and edit/delete for workspace admins.
- Payment rows: **Mark paid** records an installment; **Consolidate** merges partial payments into the first row (its id survives) and soft-deletes the rest. Deleting a payment soft-deletes it.
- Editing the schedule keeps any period that still has payment history; only empty, out-of-term periods are removed.
- Back label: **Back to Bank Loans**. Delete confirm: **Delete bank loan?**
- `?edit=1` opens the edit form on desktop. On phone, edit uses `EditFormSheet`.
- Fallback title when the name is missing: **Bank loan**. Document title uses the loan name.

## Load

[`src/routes/debts/[id]/+page.server.ts`](../../../src/routes/debts/[id]/+page.server.ts). Mutations via `GET`/`PUT`/`DELETE` `/api/debts/[id]`.

## Permissions

Owner: view, edit, delete, mark installments paid, consolidate payments.

Linked investor (the lender contact on the bank loan): view only. `GET /api/debts/[id]` returns the row; every mutation returns 404. Debt mutation routes check `hasDebtAdminAccess`, not the broader `hasDebtAccess` view check.

Other signed-in users and anonymous sessions: 404 / 401.

## Implementation map

| Concern | Path                                               |
| ------- | -------------------------------------------------- |
| Page    | `src/routes/debts/[id]/+page.svelte`               |
| Client  | `src/lib/components/debts/DebtDetailClient.svelte` |
| Form    | `src/lib/components/debts/DebtForm.svelte`         |
