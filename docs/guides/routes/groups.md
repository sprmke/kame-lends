# Groups (`/groups`)

**Status:** Documented
**Updated:** 2026-09-11

## Behavior

List of loan groups the viewer created, is an active member of, or (workspace admin) all groups. Card grid with search by name; "New Group" opens a create modal. Behind the `SHOW_GROUPS_UI` feature flag in `src/lib/feature-flags.ts` — nav entry is hidden while the flag is `false`, but the route stays reachable directly.

Groups are organizational only: adding a loan to a group never grants loan access. `hasLoanViewAccess` (`src/lib/server/access-control.ts`) stays the only security boundary — see [`groups-detail.md`](./groups-detail.md).

## Load

`src/routes/groups/+page.server.ts` calls `getCachedGroupsForUser(userId, isAdmin)` (`src/lib/server/cached-data.ts`), scoped to groups the viewer created or is an active member of, or every group when the viewer is the workspace admin (`isWorkspaceAdmin`).

## Create

Any signed-in user, any role. `POST /api/groups` — the creator is auto-added as an active `loan_group_members` row. No admin gate (unlike Investors/Borrowers/Witnesses, which are workspace-admin CRUD only).

## Permissions

Any signed-in user can create groups. Viewing requires being the creator, an active member, or the workspace admin.

## Implementation map

| Piece          | Path                                             |
| -------------- | ------------------------------------------------- |
| Page           | `src/routes/groups/+page.svelte`                   |
| Load           | `src/routes/groups/+page.server.ts`                |
| Card           | `src/lib/components/groups/GroupCard.svelte`       |
| Create modal   | `src/lib/components/groups/GroupFormModal.svelte`  |
| Form           | `src/lib/components/groups/GroupForm.svelte`       |
| List API       | `src/routes/api/groups/+server.ts`                 |
| Access/sync    | `src/lib/server/group-access.ts`                   |
