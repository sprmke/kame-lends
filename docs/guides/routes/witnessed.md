# Witnessed

**Route:** `/witnessed`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is a contract witness — either via a signing invitation (`witnesses.witness_user_id` on `loan_signing_invitations`) or via a `loan_witnesses` assignment (see below). Phone chrome matches the shared native shell. `PageHeader` title sits in content below the brand bar. PageHeader actions render in MobileTopBar as frosted icon wells. View toggle stays in the list toolbar on phone. Calendar defaults to day view under `lg`. Phone calendar chrome is a compact day toolbar (title + Today/prev/next; no Day-only toggle). Week/month stay `lg+`. List pagination on phone is range + page-size, then prev / page of total / next (numbered pills `lg+`). Search, status/type filters, More Filters (amount ranges plus investor, borrower, and witness multi-selects), and table/list chrome match `/loans`.

Read-only list and detail. On desktop, table rows and calendar event cards open `LoanDetailModal`; on phone, navigation goes to `/loans/[id]`. Row/card ⋯ menu includes **Contract Details** → `LoanContractDetailsModal`. Sign via `/loans/[id]/sign` when their witness slot is unsigned.

**Profit.** Same pattern as `/borrowed`: `LoanProfitSummaryCards` shows Principal / Profit Estimate / Profit Earned / Completed, computed by `computeWitnessProfitStats` over the signed-in user's own rows in the `loan_witnesses` junction table (a loan can have up to two witnesses; profit is tracked per witness, not per signing slot, so it survives a witness being swapped in contract customization). On the loan detail page a **Witnesses** section (`LoanWitnessesSection`) lists everyone assigned to the loan; a witness may add/edit only their own row's profit (rate-of-principal or fixed amount), via `PATCH /api/loans/[id]/witnesses/[witnessLoanId]`. Assigning witnesses to a loan and editing anyone else's row is owner-only.

## Load

[`src/routes/witnessed/+page.server.ts`](../../../src/routes/witnessed/+page.server.ts) → `getCachedLoansByScope(userId, 'witnessed', 'list')`, plus a `profitStats` promise that filters each loan's `loanWitnesses` down to the signed-in user's own rows before calling `computeWitnessProfitStats`.

## Permissions

Requires session. Always in the sidebar. Empty list if the user has no witness linkage. No create/edit/delete/payment actions — the one exception is a witness's own profit value on a loan they're assigned to (`resolveWitnessProfitWriteAccess` in `src/lib/server/access-control.ts`).
