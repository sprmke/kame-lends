# Group hub (`/groups/[id]`)

**Status:** Documented (Loan Groups v2)
**Updated:** 2026-09-17

## Behavior

Hub for one group. Tabs via `?tab=`: **Overview · Loans · People · Settings** (Settings is owner-only).

- **Header:** back link, title, color dot; meta line (`N loans · N people · Next due …`) with viewer role pill (**Owner** or party roles) on the same row; optional notes below. Owner actions (**Add loans** with plus icon, Settings/Delete overflow) top-right on desktop; on phone both actions sit in the brand hero bar (`GroupHubHeader.svelte`)
- **Overview:** loan summary cards, needs-attention (overdue), then **Group** (description/notes), **Channels** (calendar + Telegram status: Not connected / Setting up / Connected / Needs attention; no helper line), **Upcoming** (next open loans by due date)
- **Loans:** same list chrome as `/loans` (`LoanListPage` `scope="group"`): summary cards, date range (defaults to all-time via `?range=all` when params are missing), search, status/type/more filters, table/cards/calendar, export (desktop toolbar row; hidden under the embedded date row on phone), and pagination. On phone, **Select** for bulk actions shares the list toolbar row with search and view toggle. Owner can **Add loans** (picker + access preview), **Remove from group** (row ⋯ and bulk), and still edit/delete owned loans. Members are view-only.
- **People:** role-grouped roster (`GroupPeopleTab.svelte`); no access banner. Each role is one list with a count. Closed rows are one vertically centered line: name, extra roles (not the section's own), principal or capital, interest, and loan count. Phone hides the amount labels and truncates the name. Expanding a row reuses investor detail (`InvestorDetailContent`, no header or Borrowings tab) scoped to that person's loans in this group: investors see their allocations, owner/borrower/witness rows use full loan principal. Emails stay stripped from SSR and `GET /api/groups/[id]` for non-managers.
- **Settings:** name/color/description, smart rules (add/remove), **Google Calendar** card (batched sync via `POST /api/groups/[id]/calendar/sync`, subscribe link), **Telegram** card (per-group bot token + chat ID connect, optional env `startgroup` link, notification toggles, HTML templates, test/disconnect), delete. Card actions use `groupSettingsActionClass` (full width below `lg`, auto width on desktop) and `groupSettingsActionsLayoutClass` for button rows; one primary action per card where needed (e.g. **Save**, **Connect**, **Create calendar**), secondary actions **outline**. **Disconnect** / **Delete group** stay destructive. After a successful general save, client calls `invalidate('app:groups')`; load uses `depends('app:groups')` in `+page.server.ts`
- Owner can **Add loans** from the hub header or Loans tab (picker + access preview). Add-loan picker and rule contact lists load from `GET /api/groups/[id]/addable-loans` when the sheet or **Add rule** modal opens.

## Load

`+page.server.ts` loads group metadata (members, rules, channels) and group loans via `getCachedLoansByIds` (list relations, 45s process cache; cleared with `invalidateGroupData` / `invalidateLoanData`). No full owned-loan scan on initial hub load.

Membership is recomputed on loan/party writes (`recomputeGroupMembers`), not on page load. Access preview on a group requires manage access. Creating a Telegram link invalidates prior unused tokens for that group.

## Access

`hasGroupViewAccess` / `hasGroupManageAccess` in `src/lib/server/group-access.ts`. Group loan detail uses `hasLoanGroupViewAccess` + `projectLoanForGroupViewer` (PII redacted). Payment/contract/storage endpoints still require party `hasLoanViewAccess`.

## Integrations

- Google Calendar: provisioned per group via jobs (`group.calendar.*`); subscribe URL for members
- Telegram: `POST /api/groups/[id]/telegram/connect` (verify `getMe` + `getChat`, store chat; optional per-group `bot_token`), `GET/PUT/DELETE /api/groups/[id]/telegram` (toggles + merged `templates`; never returns raw token, only `botTokenConfigured`), optional env `startgroup` link (`POST …/telegram/link` when `TELEGRAM_BOT_*` + webhook secret set); webhook `POST /api/webhooks/telegram`; daily reminders on `/api/cron/groups`

## Implementation map

| Piece              | Path                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Page               | `src/routes/groups/[id]/+page.svelte`                                                                              |
| Load               | `src/routes/groups/[id]/+page.server.ts`                                                                           |
| Loans tab          | `src/lib/components/loans/LoanListPage.svelte` (`scope="group"`)                                                   |
| Header             | `src/lib/components/groups/GroupHubHeader.svelte`                                                                  |
| People             | `src/lib/components/groups/GroupPeopleTab.svelte`, `GroupPersonPanel.svelte`                                       |
| Settings           | `src/lib/components/groups/GroupSettingsTab.svelte`                                                                |
| Calendar           | `src/lib/server/group-calendar.ts`                                                                                 |
| Telegram           | `src/lib/server/telegram/*`                                                                                        |
| Sync now           | `POST /api/groups/[id]/sync` (members + ACL + provision)                                                           |
| Full calendar sync | `POST /api/groups/[id]/calendar/sync` (`prepare` / `wipe` / `loans` / `summaries`) via shared `SyncCalendarButton` |
