# Bank Loans list (`/debts`)

**Status:** Documented  
**Updated:** 2026-09-23

## Behavior

- Lists bank loans (money you borrow from lender contacts), separate from loans you issue. `PageHeader` title **Bank Loans**. Subtitle: "Bank loans from your lender contacts, separate from loans you issue."
- Search by name, investor, or notes. Inline filters: **Hide Repaid** / **Show Repaid**, accrual period. **More Filters** holds principal range and investor multi-select.
- Table or card view. Card view (`GridListCardShell`): tap the card to open; **⋯** top-right (Edit, Delete). Empty states: **No bank loans yet.** / **No bank loans match your filters.** Header action: **Add Bank Loan**.
- **Phone (`<lg`):** row/card opens `/debts/[id]`. **More Filters** opens a bottom sheet (`MoreFiltersSurface`), not an inline panel. Add Bank Loan and row edit open a bottom sheet (`DebtCreateModal` / `EditFormSheet`), not `/debts/new`.
- **Schedule and formatting:** the debt detail syncs stored installments and due dates with the live schedule before rendering, so **Payment per month**, the schedule, and the Record payment default agree. Dates use the short business-timezone format and rates always show two decimals (for example `0.48%`).
- **Desktop (`lg+`):** row click opens `DebtDetailModal`. Add Bank Loan goes to `/debts/new`. Row edit goes to `/debts/[id]?edit=1`.

Create/edit copy uses **Create Bank Loan** / **Edit Bank Loan**. Detail back label: **Back to Bank Loans**.

- **Loading:** `ListPageSkeleton variant="debts"` mirrors the header, search plus repayment/accrual filters and More Filters, and the resolved view (table card at `lg+`, bank loan cards below `lg`). Table rows use the same date/name/investor/principal/rate/period visibility; cards show the interval badge and 2×2 interest cells.

## Permissions

The list page is owner-only. `requireWorkspaceAdminPage` redirects other signed-in users to `/dashboard`. Linked investors reach their bank loan from the investor detail page instead; see `debts-detail.md` for read-only access.

## Load

[`src/routes/debts/+page.server.ts`](../../../src/routes/debts/+page.server.ts) → `getCachedDebts(userId, null)`.

## Implementation map

| Concern      | Path                                                  |
| ------------ | ----------------------------------------------------- |
| Page         | `src/routes/debts/+page.svelte`                       |
| Create       | `src/routes/debts/new/+page.svelte`                   |
| Detail       | `src/routes/debts/[id]/+page.svelte`                  |
| Table        | `src/lib/components/debts/DebtsTable.svelte`          |
| Cards        | `src/lib/components/debts/DebtCard.svelte`            |
| Detail modal | `src/lib/components/debts/DebtDetailModal.svelte`     |
| Create modal | `src/lib/components/debts/DebtCreateModal.svelte`     |
| Form         | `src/lib/components/debts/DebtForm.svelte`            |
| Nav          | `src/lib/nav/app-nav.ts` (**Bank Loans** under Tools) |
