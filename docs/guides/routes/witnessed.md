# Witnessed

**Route:** `/witnessed`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is a contract witness — either via a signing invitation (`witnesses.witness_user_id` on `loan_signing_invitations`) or via a `loan_witnesses` assignment (see below). Phone chrome matches the shared native shell. `PageHeader` title sits in content below the brand bar. PageHeader actions render in MobileTopBar as frosted icon wells. View toggle stays in the list toolbar on phone. Calendar defaults to day view under `lg`. Phone calendar chrome is a compact day toolbar (title + Today/prev/next; no Day-only toggle). Week/month stay `lg+`. List pagination on phone is range + page-size, then prev / page of total / next (numbered pills `lg+`). Search, status/type filters, More Filters (amount ranges plus investor, borrower, and witness multi-selects), and table/list chrome match `/loans`.

Read-only list and detail. On desktop, table rows and calendar event cards open `LoanDetailModal`; on phone, navigation goes to `/loans/[id]`. Month-view **+N more** stacks loan detail on top of the day events overlay. Row/card ⋯ menu: **Add Commission** (opens detail with witness profit editor) and **Contract Details** → `LoanContractDetailsModal`. List modal and Contract Details use the same instant-row + background refresh, in-memory list patch, and overlay paint defer as `/loans`. Sign via `/loans/[id]/sign` when their witness slot is unsigned.

**Summary cards** match **Investing** and **Borrowed**: Principal, Interest Estimate, Interest Earned, and Completed for the selected due-date range (`LoanListSummaryCards` via `computeLoanListSummaryStats` on date-filtered `scopedLoans` in `LoanListPage`).

**Commission** on loan detail: a **Witnesses** section (`LoanWitnessesSection`) lists everyone assigned to the loan; a witness may add/edit only their own row's profit (rate-of-principal or fixed amount), via `PATCH /api/loans/[id]/witnesses/[witnessLoanId]`. Commission totals live on the **Commissioned** tab. Assigning witnesses and editing anyone else's row is owner-only.

## Load

[`src/routes/loans/+page.server.ts`](../../../src/routes/loans/+page.server.ts) → `getCachedLoansByScope(userId, 'witnessed', 'list')`. Summary stats use the same path as **Investing** / **Borrowed** (`computeLoanListSummaryStats` on `scopedLoans` after the due-date range filter).

## Permissions

Requires session. Always in the sidebar. Empty list if the user has no witness linkage. No create/edit/delete/payment actions — the one exception is a witness's own profit value on a loan they're assigned to (`resolveWitnessProfitWriteAccess` in `src/lib/server/access-control.ts`).
