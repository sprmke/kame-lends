# Witnessed

**Route:** `/witnessed`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is a contract witness (`witnesses.witness_user_id` on a signing invitation for that loan). Phone chrome matches the shared native shell. `PageHeader` title sits in content below the brand bar. PageHeader actions render in MobileTopBar as frosted icon wells. View toggle stays in the list toolbar on phone. Calendar defaults to day view under `lg`. Phone calendar chrome is a compact day toolbar (title + Today/prev/next; no Day-only toggle). Week/month stay `lg+`. List pagination on phone is range + page-size, then prev / page of total / next (numbered pills `lg+`). Search, status/type filters, More Filters (amount ranges plus investor, borrower, and witness multi-selects), and table/list chrome match `/loans`.

Read-only list and detail. On desktop, table rows and calendar event cards open `LoanDetailModal`; on phone, navigation goes to `/loans/[id]`. Row/card ⋯ menu includes **Contract Details** → `LoanContractDetailsModal`. Sign via `/loans/[id]/sign` when their witness slot is unsigned.

## Load

[`src/routes/witnessed/+page.server.ts`](../../../src/routes/witnessed/+page.server.ts) → `getCachedLoansByScope(userId, 'witnessed', 'list')`.

## Permissions

Requires session. Always in the sidebar. Empty list if the user has no witness linkage. No create/edit/delete/payment actions.
