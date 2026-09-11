# Group detail (`/groups/[id]`)

**Status:** Documented
**Updated:** 2026-09-11

## Behavior

Shows one group's loans and members. Loans can be added via a searchable picker (loans the viewer already has access to); each loan link goes to `/loans/[id]`. Members list shows active members only, with the creator badged "Owner".

**Access does not widen inside a group.** The loan list shown to a viewer is always filtered through `hasLoanViewAccess(loanId, viewerId)` per loan — a group member who isn't independently a party on one of the group's loans will not see that loan, even though they're a member of the group that contains it.

## Load

`src/routes/groups/[id]/+page.server.ts`:

1. `requireUserSession`, then `hasGroupViewAccess(groupId, userId)` — redirects to `/groups` on failure (creator, active member, or workspace admin).
2. `syncGroupMembers(groupId)` (`src/lib/server/group-access.ts`) — re-syncs membership for every loan currently in the group. Additive-only: inserts an active row for any loan party with no existing membership row; never touches an existing row, so a member who left or was removed is never silently re-added.
3. Loads the group, its loans, and its members; filters loans through `hasLoanViewAccess` per viewer.
4. Computes `canEdit` (`hasGroupEditAccess` — creator or workspace admin), `canLeave` (`canLeaveGroup` — active, non-creator member), and `isCreator`.

## Membership sync

`resolveLoanPartyUserIds(loanId)` (`src/lib/server/group-access.ts`) resolves every user id linked to a loan as owner, investor (`investors.investorUserId`), borrower (`borrowers.borrowerUserId`), or witness (`witnesses.witnessUserId`). Email-only signing invitations not yet linked to a `users` row are skipped and picked up on a later sync once that contact is linked (`findOrCreatePartyUser`, `src/lib/server/party-user.ts`).

Sync runs when a loan is added to the group (`POST /api/groups/[id]/loans`) and again on every group-detail page load (covers parties added to an already-in-group loan after the fact, without hooking every loan/investor/witness mutation endpoint).

## Edit / Actions

- **Creator or workspace admin:** rename/delete the group (`PUT`/`DELETE /api/groups/[id]`), add/remove loans (`POST`/`DELETE /api/groups/[id]/loans[/…]`), remove a member (`DELETE /api/groups/[id]/members/[userId]`, sets status `removed`; the creator cannot be removed).
- **Any other active member:** leave the group (`POST /api/groups/[id]/leave`, sets status `left`). Cannot edit or delete.
- Leaving/removal is sticky — a later sync will not re-add that member unless they're added back by editing (out of scope; no explicit re-add UI).

## Permissions

`hasGroupViewAccess` / `hasGroupEditAccess` / `canLeaveGroup` in `src/lib/server/group-access.ts`. The workspace admin (`isWorkspaceAdmin`, `src/lib/server/workspace-admin.ts`) can view and manage every group regardless of creator, as an oversight override.

## Implementation map

| Piece          | Path                                                        |
| -------------- | ------------------------------------------------------------ |
| Page           | `src/routes/groups/[id]/+page.svelte`                          |
| Load           | `src/routes/groups/[id]/+page.server.ts`                       |
| Members list   | `src/lib/components/groups/GroupMembersList.svelte`            |
| Loan picker    | `src/lib/components/groups/GroupLoanPicker.svelte`              |
| Edit modal     | `src/lib/components/groups/GroupFormModal.svelte`               |
| Group API      | `src/routes/api/groups/[id]/+server.ts`                         |
| Loan sub-API   | `src/routes/api/groups/[id]/loans/+server.ts`, `[loanId]/+server.ts` |
| Leave API      | `src/routes/api/groups/[id]/leave/+server.ts`                    |
| Member API     | `src/routes/api/groups/[id]/members/[userId]/+server.ts`         |
| Access/sync    | `src/lib/server/group-access.ts`                                |
