# Witnesses list (`/witnesses`)

**Status:** Documented  
**Updated:** 2026-09-10

## Behavior

- Admin workspace only (`isAdminWorkspace` in nav). Lists witness contacts owned by the signed-in user.
- Search by name, email, or contact number. Inline filters: loan activity (All / With loans / No loans) and signing status (All / Signed / Pending). Table or card view. Card view footer: **Open** plus a **⋯** menu (Edit, Delete; same as table row actions). Toolbar uses shared `ListPageToolbar` (search full width on phone; filters and view toggle on the row below; view toggle hidden when the list is empty).
- Empty card view: shared `ListEmptyState` (message only, or **Clear filters** when filters hide all rows). **Add Witness** stays in the page header.
- **Phone (`<lg`):** row/card opens `/witnesses/[id]`. Add Witness and row edit open a bottom sheet (`WitnessCreateModal` / `WitnessDetailModal` in edit mode), not `/witnesses/new`. Detail-page edit also uses a sheet (`EditFormSheet`).
- **Desktop (`lg+`):** row click opens `WitnessDetailModal` (view + in-modal edit). Add Witness opens `WitnessCreateModal`. Edit from row actions opens the detail modal in edit mode.
- Delete blocked when the witness has signing invitations on loans.

## Permissions

| Role                                | Access                                        |
| ----------------------------------- | --------------------------------------------- |
| Admin workspace owner               | Full list/create/edit/delete                  |
| Investor / borrower / witness party | Nav item hidden; API scoped to owner `userId` |

## Load

[`src/routes/witnesses/+page.server.ts`](../../../src/routes/witnesses/+page.server.ts) → `getCachedWitnesses(userId, 'list')` with signing invitation + loan summary columns.

## Implementation map

| Concern      | Path                                                     |
| ------------ | -------------------------------------------------------- |
| Page         | `src/routes/witnesses/+page.svelte`                      |
| Table        | `src/lib/components/witnesses/WitnessesTable.svelte`     |
| Cards        | `src/lib/components/witnesses/WitnessCard.svelte`        |
| Detail modal | `src/lib/components/witnesses/WitnessDetailModal.svelte` |
| Create modal | `src/lib/components/witnesses/WitnessCreateModal.svelte` |
| Nav          | `src/lib/nav/app-nav.ts`                                 |
