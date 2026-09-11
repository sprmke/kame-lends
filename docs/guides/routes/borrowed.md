# Borrowed

**Route:** `/borrowed`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is the borrower (`borrowers.borrower_user_id` → `loans.borrower_id`). Phone chrome matches the shared native shell. `PageHeader` title sits in content below the brand bar. PageHeader actions render in MobileTopBar as frosted icon wells. View toggle stays in the list toolbar on phone. Calendar defaults to day view under `lg`. Phone calendar chrome is a compact day toolbar (title + Today/prev/next; no Day-only toggle). Week/month stay `lg+`. List pagination on phone is range + page-size, then prev / page of total / next (numbered pills `lg+`). Search, status/type filters, More Filters (amount ranges plus investor, borrower, and witness multi-selects), and table/list chrome match `/loans`.

Read-only list and loan detail. On desktop, table rows and calendar event cards open `LoanDetailModal`; on phone, navigation goes to `/loans/[id]`. Row/card ⋯ menu matches `/loans` (including **Contract Details** → `LoanContractDetailsModal`). Sign CTA when a borrower signature slot is open: `/loans/[id]/sign`.

Loan detail shows the loan owner’s **payment methods** (bank name, account number, QR) when the owner has configured them in Settings. Owners, investors, and witnesses do not see this section.

**Profit.** Below the header, `LoanProfitSummaryCards` shows Principal / Profit Estimate / Profit Earned / Completed across the borrower's loans — the borrower-side counterpart to investors' Interest Estimate/Earned. Estimate = open loans, Earned = `Completed` loans (`computeBorrowerProfitStats` in [`src/lib/loan-list-summary.ts`](../../../src/lib/loan-list-summary.ts)). On the loan detail page, the borrower sees the same Profit/Profit Rate cells as everyone else in `LoanSummarySection`, plus a **Your Profit** card (`LoanBorrowerProfitCard`) that is the one thing a borrower may edit — a rate-of-principal or fixed amount, saved via `PATCH /api/loans/[id]/profit`. Everything else on the page stays read-only.

## Load

[`src/routes/borrowed/+page.server.ts`](../../../src/routes/borrowed/+page.server.ts) → `getCachedLoansByScope(userId, 'borrowed', 'list')`, plus a `profitStats` promise from `computeBorrowerProfitStats`.

Loan modal refresh uses `GET /api/loans/[id]`, which includes `paymentMethods` only for borrower membership.

## Permissions

Requires session. Always in the sidebar. Empty list if the user has no borrower linkage. No create/edit/delete/payment actions — the one exception is the borrower's own profit value (`hasBorrowerProfitWriteAccess` in `src/lib/server/access-control.ts`: the loan owner or the linked borrower).
