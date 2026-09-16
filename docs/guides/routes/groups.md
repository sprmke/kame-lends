# Groups (`/groups`)

**Status:** Documented (Loan Groups v2)
**Updated:** 2026-09-16

## Behavior

List splits into **Your groups** (you created) and **Shared with you** (derived membership). Each section has its own empty state. Workspace admins also see every other workspace group under Shared. Card grids support search (after 6 groups) and sort (needs attention / name / updated). Cards show **Owner** for groups you created, or your party role(s) when shared. Calendar and Telegram icons use the same status words as the hub Channels card (`Calendar: Setting up`, `Telegram: Not connected`). **New group** is available to any signed-in user and opens `CreateGroupWizard` (`?create=1`; `/groups/new` redirects there). The wizard body mounts immediately (no deferred shell skeleton). Footer actions are two columns (Cancel/Back | Next/Review/Create). **Add loans from** (None, plus Investor and/or Borrower) can select multiple people of each type. Their loans are unioned on the next step until **All loans**. None starts with nothing selected. Step 2 has one search (loan name or borrower), a count above the list, **Select all** (visible rows), and **Unselect all**. The lists include only contacts who already appear on **loans you own**. Empty is normal when you own no such loans; use None and pick loans on step 2. Contact pages can prefill with `?create=1&investorId=` or `borrowerId=` plus optional `loanIds=` and `name=`.

Behind `SHOW_GROUPS_UI` in `src/lib/feature-flags.ts` (currently on for local QA). While false: nav and `groupsIndex` are empty; routes stay reachable.

**Access model (v2):** People on any loan in a group can view the group and **all of its loans, read-only**. Membership is fully derived from loan parties (no leave/remove). Any signed-in user can create a group; only the creator (or workspace admin) manages it. Adding loans still requires ownership of those loans.

## Load

`src/routes/groups/+page.server.ts` streams aggregated cards via `getCachedGroupsForUser`, plus wizard loan options for create (loans the viewer owns).

## Create

Any authenticated user. `POST /api/groups` accepts `{name, color, description?, loanIds?, rules?, createCalendar?}` in one transaction, then recomputes members and enqueues calendar jobs. Each `loanId` must be owned by the creator.

## Permissions

- Nav: any signed-in user when `SHOW_GROUPS_UI` is on
- View: creator, derived member, or workspace admin
- Create: any signed-in user
- Manage: creator or workspace admin

## Implementation map

| Piece           | Path                                                 |
| --------------- | ---------------------------------------------------- |
| Page            | `src/routes/groups/+page.svelte`                     |
| Load            | `src/routes/groups/+page.server.ts`                  |
| Card            | `src/lib/components/groups/GroupCard.svelte`         |
| Create wizard   | `src/lib/components/groups/CreateGroupWizard.svelte` |
| List/create API | `src/routes/api/groups/+server.ts`                   |
| Access          | `src/lib/server/group-access.ts`                     |
| Jobs            | `src/lib/server/jobs/*`                              |
