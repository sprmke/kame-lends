# Bank Loan detail (`/debts/[id]`)

**Status:** Documented  
**Updated:** 2026-09-23

## Behavior

- Shows one bank loan: **Bank Loan Summary**, payment schedule, and edit/delete for workspace admins.
- Back label: **Back to Bank Loans**. Delete confirm: **Delete bank loan?**
- `?edit=1` opens the edit form on desktop. On phone, edit uses `EditFormSheet`.
- Fallback title when the name is missing: **Bank loan**. Document title uses the loan name.

## Load

[`src/routes/debts/[id]/+page.server.ts`](../../../src/routes/debts/[id]/+page.server.ts). Mutations via `GET`/`PUT`/`DELETE` `/api/debts/[id]`.

## Permissions

Workspace admin only.

## Implementation map

| Concern | Path                                               |
| ------- | -------------------------------------------------- |
| Page    | `src/routes/debts/[id]/+page.svelte`               |
| Client  | `src/lib/components/debts/DebtDetailClient.svelte` |
| Form    | `src/lib/components/debts/DebtForm.svelte`         |
