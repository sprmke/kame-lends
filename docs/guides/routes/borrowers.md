# Borrowers list (`/borrowers`)

**Status:** Documented  
**Updated:** 2026-09-10

## Behavior

- Admin workspace only (`isAdminWorkspace` in nav). Lists borrower contacts owned by the signed-in user.
- Search by name, email, or contact number. Inline filters: loan activity (All / With loans / No loans). Table or card view. Card view footer: **Open** plus a **⋯** menu (Edit, Delete; same as table row actions). Toolbar uses shared `ListPageToolbar` (search full width on phone; filters and view toggle on the row below; view toggle hidden when the list is empty).
- Empty card view: shared `ListEmptyState` (message only, or **Clear filters** when filters hide all rows). **Add Borrower** stays in the page header.
- **Phone (`<lg`):** row/card opens `/borrowers/[id]`. Add Borrower and row edit open a bottom sheet (`BorrowerCreateModal` / `BorrowerDetailModal` in edit mode), not `/borrowers/new`. Detail-page edit also uses a sheet (`EditFormSheet`).
- **Desktop (`lg+`):** row click opens `BorrowerDetailModal` (view + in-modal edit). Add Borrower opens `BorrowerCreateModal`. Edit from row actions opens the detail modal in edit mode.
- Delete blocked when the borrower still has loans.

## Permissions

| Role                                | Access                                        |
| ----------------------------------- | --------------------------------------------- |
| Admin workspace owner               | Full list/create/edit/delete                  |
| Investor / borrower / witness party | Nav item hidden; API scoped to owner `userId` |

## Load

[`src/routes/borrowers/+page.server.ts`](../../../src/routes/borrowers/+page.server.ts) → `getCachedBorrowers(userId, 'list')` with loan summary columns.

## Implementation map

| Concern      | Path                                                      |
| ------------ | --------------------------------------------------------- |
| Page         | `src/routes/borrowers/+page.svelte`                       |
| Table        | `src/lib/components/borrowers/BorrowersTable.svelte`      |
| Cards        | `src/lib/components/borrowers/BorrowerCard.svelte`        |
| Detail modal | `src/lib/components/borrowers/BorrowerDetailModal.svelte` |
| Create modal | `src/lib/components/borrowers/BorrowerCreateModal.svelte` |
| Nav          | `src/lib/nav/app-nav.ts`                                  |
