# Group hub (`/groups/[id]`)

**Status:** Documented (Loan Groups v2)
**Updated:** 2026-10-17

## Behavior

Hub for one group. Tabs via `?tab=`: **Overview · Loans · People · Settings** (Settings is owner-only).

- **Header:** back link, title, color dot; meta line (`N loans · N people · Next due …`) with viewer role pill (**Owner** or party roles) on the same row; optional notes below. Owner actions (**Add loans** with plus icon, Settings/Delete overflow) top-right on desktop; on phone both actions sit in the brand hero bar (`GroupHubHeader.svelte`)
- **Overview:** loan summary cards, needs-attention (overdue), then **Group** (description/notes), **Channels** (calendar + Telegram status: Not connected / Not set up / Connected / Needs attention; no helper line), **Upcoming** (next open loans by due date)
- **Loans:** same list chrome as `/loans` (`LoanListPage` `scope="group"`). **Phone:** full-width date range directly under hub tabs and above summary cards (defaults to all-time via `?range=all`; all-time is not treated as an active filter for **Clear**). Then summary cards, then a stacked toolbar (full-width search, then a left-aligned row: view toggle / **More Filters** (bottom sheet) / **Select**). **Export PDF** sits in the group hub header beside **Add loans** (desktop and mobile brand bar), not in the list toolbar. View toggle on phone is cards and timeline (timeline is the default; **Select** switches to cards); calendar and table are `lg+`. Timeline lists in/out by day inside the selected range. **Desktop:** summary cards first, then toolbar with inline date range beside search. Search, status/type/more filters, export, and pagination match `/loans`. On phone, **Select** toggles card checkboxes; the toolbar stays the same (**Done** replaces **Select** in the action row). The bulk bar replaces the tab dock. Bulk bar **Summary** opens the same selection stats modal as `/loans`. Owner can **Add loans** (picker + access preview), **Remove from group** (row ⋯ and bulk), and still edit/delete owned loans. Members are view-only.
- **People:** role-grouped roster (`GroupPeopleTab.svelte`); no access banner. Each role is one list with a count. Closed rows are one vertically centered line: name, extra roles (not the section's own), principal or capital, interest, and loan count. Phone hides the amount labels and truncates the name. Expanding a row reuses investor detail (`InvestorDetailContent`, no header or Bank Loans tab) scoped to that person's loans in this group: investors see their allocations, owner/borrower/witness rows use full loan principal. Emails stay stripped from SSR and `GET /api/groups/[id]` for non-managers.
- **Settings:** name/color/description, **Auto-add loans** (each rule is separate; a new loan you own is added when any rule matches an investor or borrower on that loan), **Default witnesses** (up to two; the same person from several groups is added once; **Auto-sign** records a saved signature on new and edited loans in the group), **Google Calendar** card (batched sync via `POST /api/groups/[id]/calendar/sync`, subscribe link). **Clear events** deletes every event on that group's Google calendar in batches (orphans, duplicate copies, and Total Summary rows), not only current loans. Run Clear on each group calendar you subscribe to if duplicates span groups. Telegram card (per-group bot token + chat ID connect, optional env `startgroup` link, notifications switch plus grouped Reminders / Updates lists). Reminders include lead-time chips for upcoming dues, and **Unsigned contracts**: how often (1 hour through daily, default every hour) and who must sign (Borrower and Investor on, Witness off). Message templates (one template at a time, including **Unsigned**, Edit/Preview, highlighted `{{placeholders}}`, insert from a placeholders sheet, reset to the default), test/disconnect, delete. Card actions use `groupSettingsActionClass` (full width below `lg`, auto width on desktop) and `groupSettingsActionsLayoutClass` for button rows; one primary action per card where needed (e.g. **Save**, **Connect**, **Create calendar**), secondary actions **outline**. **Disconnect** / **Delete group** stay destructive. After a successful general save, client calls `invalidate('app:groups')`; load uses `depends('app:groups')` in `+page.server.ts`
- Owner can **Add loans** from the hub header or Loans tab (picker + access preview). Add-loan picker and rule contact lists load from `GET /api/groups/[id]/addable-loans` when the sheet or **Add rule** modal opens.

## Load

`+page.server.ts` loads group metadata (members, rules, channels) and group loans via `getCachedLoansByIds` (list relations, 45s process cache; cleared with `invalidateGroupData` / `invalidateLoanData`). No full owned-loan scan on initial hub load.

Membership is recomputed on loan/party writes (`recomputeGroupMembers`), not on page load. Access preview on a group requires manage access. Creating a Telegram link invalidates prior unused tokens for that group.

## Access

`hasGroupViewAccess` / `hasGroupManageAccess` in `src/lib/server/group-access.ts`. Group loan detail uses `hasLoanGroupViewAccess` + `projectLoanForGroupViewer` (PII redacted). Payment/contract/storage endpoints still require party `hasLoanViewAccess`.

## Integrations

- Google Calendar: provisioned per group via jobs (`group.calendar.*`); subscribe URL for members
- Default witnesses: `GET/PUT /api/groups/[id]/default-witnesses` (owner saves; a contract holds two). Loan create, loan edit, `PUT /api/loans/[id]/groups`, and adding loans from the group apply them. Empty witness slots are filled. Occupied slots that name someone else stay. **Auto-sign** sets the invitation signed when that witness has a saved signature, and those witnesses are left off the new-loan signing email.
- Telegram: `POST /api/groups/[id]/telegram/connect` (verify `getMe` + `getChat`, store chat; optional per-group `bot_token`), `GET/PUT/DELETE /api/groups/[id]/telegram` (toggles + merged `templates`; never returns raw token, only `botTokenConfigured`), optional env `startgroup` link (`POST …/telegram/link` when `TELEGRAM_BOT_*` + webhook secret set); webhook `POST /api/webhooks/telegram`; daily due reminders on `/api/cron/groups`; unsigned-contract reminders on `/api/cron/signing-reminders` (daily at 00:00 UTC, each group still sends only on its interval)

## Implementation map

| Piece              | Path                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Page               | `src/routes/groups/[id]/+page.svelte`                                                                              |
| Load               | `src/routes/groups/[id]/+page.server.ts`                                                                           |
| Loans tab          | `src/lib/components/loans/LoanListPage.svelte` (`scope="group"`)                                                   |
| Header             | `src/lib/components/groups/GroupHubHeader.svelte`                                                                  |
| People             | `src/lib/components/groups/GroupPeopleTab.svelte`, `GroupPersonPanel.svelte`                                       |
| Settings           | `src/lib/components/groups/GroupSettingsTab.svelte`                                                                |
| Default witnesses  | `src/lib/components/groups/GroupDefaultWitnessesCard.svelte`, `src/lib/groups/default-witnesses.ts`                |
| Calendar           | `src/lib/server/group-calendar.ts`                                                                                 |
| Telegram           | `src/lib/server/telegram/*`, template editor `src/lib/components/groups/TelegramTemplateEditor.svelte`             |
| Sync now           | `POST /api/groups/[id]/sync` (members + ACL + provision)                                                           |
| Full calendar sync | `POST /api/groups/[id]/calendar/sync` (`prepare` / `wipe` / `loans` / `summaries`) via shared `SyncCalendarButton` |
