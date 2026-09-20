# Investments

**Route:** `/investments`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is linked as an investor (`investors.investor_user_id` + `loan_investors`). A loan can list "Michael D. Manlulu" as an investor contact without appearing here until that contact row is portal-linked to the login. Run `bun run db:backfill:investor-links` (see `docs/archive/operations/investor-portal-link-backfill.md`) to link workspace contacts that share the owner's email.

Read-focused list with in-app calendar. No New Loan or Google Calendar sync controls. Table checkboxes and bulk add-to-group match **Managing** (add to group still requires loan ownership). Phone chrome matches the shared native shell (brand lockup in MobileTopBar, floating dock, `ListPageToolbar`). `PageHeader` title sits in content below the bar. PageHeader actions render in MobileTopBar as frosted icon wells. View toggle stays in the list toolbar on phone. Calendar defaults to day view under `lg`. Phone calendar chrome is a compact day toolbar (title + Today/prev/next; no Day-only toggle). Week/month stay `lg+`. List pagination on phone is range + page-size, then prev / page of total / next (numbered pills `lg+`). Inline search, status/type filters, and More Filters (amount ranges plus investor, borrower, and witness multi-selects) match `/loans`. Table/list chrome uses the same white card surfaces as `/loans`.

**Date range + summary cards** match `/loans`: `from`/`to` due-date filter in the header (defaults to current month), or `?range=all` for all-time. Summary row (Principal, Interest Estimate, Interest Earned, Completed completed/total) scoped to the date range. Principal dedupes reused capital across non-overlapping loan periods; all-completed ranges show capital used. See `docs/guides/routes/loans.md` for URL and filter semantics.

On desktop, table rows and calendar event cards open `LoanDetailModal`; on phone, navigation goes to `/loans/[id]`. Month-view **+N more** stacks loan detail on top of the day events overlay. Row/card ⋯ menu: **Add Commission** → `LoanCommissionModal` and **Contract Details**. The list modal and Contract Details follow the same instant-row + background refresh and in-memory list patch as `/loans`. Contract Details (and other `ResponsiveModal` overlays) paint an opaque shell first, then mount the contract body so the investments table does not show through. Contract Details shows an **Open** button on the investor's own unsigned signing row (links to `/loans/[id]/sign`). The **Signing** column badge reflects only the investor's own slot (pending or signed). Investors cannot record payments; only the workspace admin can create, edit, or delete.

## Load

[`src/routes/investments/+page.server.ts`](../../../src/routes/investments/+page.server.ts) → `getCachedLoansByScope(userId, 'investments', 'list')`.

## Permissions

Requires session. Always in the sidebar. Empty list if the user has no investor linkage. Loan fields stay read-only. Bulk select (checkboxes, add to group, export selected) matches `/loans`.
