# Borrowed

**Route:** `/borrowed`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is the borrower (`borrowers.borrower_user_id` → `loans.borrower_id`). Phone chrome matches the shared native shell. `PageHeader` title sits in content below the brand bar. PageHeader actions render in MobileTopBar as frosted icon wells. View toggle stays in the list toolbar on phone. Calendar defaults to day view under `lg`. Phone calendar chrome is a compact day toolbar (title + Today/prev/next; no Day-only toggle). Week/month stay `lg+`. List pagination on phone is range + page-size, then prev / page of total / next (numbered pills `lg+`). Search, status/type filters, More Filters (amount ranges plus investor, borrower, and witness multi-selects), and table/list chrome match `/loans`.

Read-only list and loan detail (create, edit, and payments stay off). Table checkboxes and bulk add-to-group match **Managing**. On desktop, table rows and calendar event cards open `LoanDetailModal`; on phone, navigation goes to `/loans/[id]`. Month-view **+N more** stacks loan detail on top of the day events overlay. Row/card ⋯ menu: **Add Commission** → `LoanCommissionModal` and **Contract Details** → `LoanContractDetailsModal`. List modal and Contract Details use the same instant-row + background refresh, in-memory list patch, and overlay paint defer as `/loans`. Sign CTA when a borrower signature slot is open: `/loans/[id]/sign`.

Loan detail shows the loan owner’s **payment methods** (bank name, account number, QR) when the owner has configured them in Settings. Owners, investors, and witnesses do not see this section.

**Summary cards** match Invested: Principal, Total, Interest (`earned / estimate`), and Completed for the selected due-date range (`LoanListSummaryCards`).

**Commission** lives on the **Commissioned** tab (`?scope=commissioned`) and on loan detail. On detail, the borrower sees **Your Commission** only (`LoanMyCommissionCard`, `GET` / `PATCH /api/loans/[id]/my-commission`). The loan owner and other parties never see it. Everything else on the page stays read-only.

## Load

[`src/routes/borrowed/+page.server.ts`](../../../src/routes/borrowed/+page.server.ts) redirects to `/loans?scope=borrowed`. List load: `getCachedLoansByScope(userId, 'borrowed', 'list')`.

Loan modal refresh uses `GET /api/loans/[id]`, which includes `paymentMethods` only for borrower membership.

## Permissions

Requires session. Always in the sidebar. Empty list if the user has no borrower linkage. No create/edit/delete/payment actions — the one exception is the borrower's own private commission (`hasMyCommissionAccess` in `src/lib/server/loan-user-commission.ts`).
