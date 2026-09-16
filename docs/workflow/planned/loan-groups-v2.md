# Loan Groups v2: shared access, a Google Calendar per group, Telegram per group

**Status:** Local QA (`SHOW_GROUPS_UI = true` for testing; flip false before prod if QA incomplete)  
**Repo:** kame-lends (SvelteKit at `src/`)  
**Updated:** 2026-09-15

## Implementation status (code)

Core v2 is implemented. UI is currently **on** for local QA (`SHOW_GROUPS_UI = true`):

- Migration `0020_loan_groups_v2.sql`, derived membership, group viewer access + projection
- Job outbox + cron + waitUntil; per-group calendar (incl. daily summaries) + Telegram
- Full group calendar resync: `POST /api/groups/[id]/calendar/sync` (`prepare` / `wipe` / `loans` / `summaries`) via shared `SyncCalendarButton`
- Groups list/hub/wizard, chip bar, badges, bulk bar, loan detail manage, loan form groups, investor/borrower "Group these loans"
- Shared `LoanListPage` for `/loans`, `/investments`, `/borrowed`, `/witnessed`
- Unit tests + expanded `e2e/loan-groups-v2.spec.ts`
- Docs: `PROJECT.md`, route guides, QA checklist

**Do not flip `SHOW_GROUPS_UI` until** `docs/workflow/qa/loan-groups-v2.md` passes on QA (migrate, backfill, calendar share, Telegram webhook).

## Context

Kame Lends has one workspace owner who runs many loans. Each loan has its own investors, borrowers and witnesses. Today there are only two options: give a party access to a single loan, or share one Google Calendar that holds every loan (`GOOGLE_CALENDAR_ID` plus a service account, synced by hand). The goal is to group loans, for example by investor circle or borrower, so that:

1. **Access comes from the loans.** Everyone who is a party on any loan in a group can view that group and all of its loans (read-only). Nobody adds or removes members by hand.
2. **Each group gets its own Google Calendar**, shared automatically with group members only.
3. **Each group can have its own Telegram chat** for reminders (upcoming, due today, overdue), a daily digest, and activity alerts.

**What exists today.** A groups feature already ships behind `SHOW_GROUPS_UI = false`: migration `0016_loan_groups.sql`, `src/lib/server/group-access.ts`, `/api/groups/**` and `/groups/**`. It was built with the opposite rules:

- It only organizes loans. A member sees a loan only if they are already a party on it.
- Membership is "sticky": members can leave or be removed, and are never re-added.
- Any signed-in user can create a group.
- Membership is re-synced every time the detail page loads, one loan at a time, and it only ever adds members.

This plan changes those rules on purpose.

**Decisions you confirmed**

| Topic           | Decision                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Loan visibility | Group members see **every loan in the group, read-only** (in the app, the calendar and Telegram).                                 |
| Membership      | **Fully derived** from the parties on the group's loans. Removing a loan or a party takes access away. No manual leave or remove. |
| Google Calendar | The **service account creates one calendar per group** and keeps its reader sharing in sync with member emails. No user OAuth.    |
| Telegram        | **One app bot.** Each group connects through a one-time `startgroup` deep link, and a webhook captures the chat ID.               |

**UX model (added after plan approval; details in Phase 4)**

| Topic                  | Decision                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where groups appear    | Everywhere loans appear. A **group bar** (chips) sits on Loans, Investments, Borrowed and Witnessed, a **group badge** shows on every loan card and row, and each group has its own **hub page**.                                             |
| Role modules           | Role pages stay role-scoped. Picking a group on `/investments` shows _your investments_ in that group, with a "See all N loans in this group" link to the hub, where every group loan is visible.                                             |
| Groups menu            | Yes, a top-level **Groups** nav item for **any signed-in user** when `SHOW_GROUPS_UI` is on (next to Dashboard for admins; in the main list / phone dock for party users).                                                                    |
| Creating               | Three entry points: a **wizard** from `/groups` (any signed-in user), **bulk "Add to group"** from selected rows on `/loans`, and contact-page deep links. Every add or remove shows an **access preview** first (who gains or loses access). |
| Keeping groups current | **Smart groups** (optional rule): "also add future loans for investor X or borrower Y", so the owner doesn't have to re-file every new loan.                                                                                                  |
| Identity               | Each group has a **name, a color, and an optional short description**. The color makes chips and badges easy to scan.                                                                                                                         |

**Why the service account instead of OAuth (the KameOps approach).** Calendar OAuth scopes are "sensitive". An external production app using them needs Google verification. Refresh tokens also expire or get revoked. KameOps already has a reconnect flow because of `invalid_grant`, and KameHomes removed Google Calendar and OAuth entirely because of verification cost (`kame-homes/docs/workflow/done/remove-google-calendar-sheets.md`). With a service account there are no tokens to rot and no review. The only manual step left is setting the service-account env vars once. The per-calendar "share with the service account" step goes away because the app creates the calendars itself.

## Guardrails (apply to every phase)

- **Security boundary.** The existing party-only `hasLoanViewAccess` in `access-control.ts` **stays unchanged**. Group access is a separate function, used only by the loan-detail loader and group routes. Existing loan sub-endpoints (payments, profit, contract PDF, signing, storage identity documents, exports) therefore never open up by accident.
- **No manual member management.** Only a server recompute function writes to `loan_group_members`.
- **Google and Telegram calls never run inside a loan mutation request.** Mutations add a row to an outbox table. A job runner processes it using `waitUntil`, with a cron as backstop. Every operation can safely run twice.
- **Migrations.** Add `db/migrations/0020_*.sql` (the next free number after the untracked `0019_payment_receipts.sql`). Never edit shipped migrations. Follow the `drizzle-neon` skill.
- **Docs are part of each phase**, not saved for the end: `docs/PROJECT.md`, `docs/guides/routes/groups*.md`, the `google-calendar-integration` skill, and a new `docs/workflow/planned/loan-groups-v2.md`, per the `documentation-maintenance` and `route-guides` skills.
- **Dates in Asia/Manila.** Use `manilaTodayKey` (`src/lib/calendar-sync-plan.ts`) and `googleAllDayRange` (`src/lib/calendar-events.ts`). Never use `new Date(dateKey + "T00:00:00")`.

---

## Phase 0: Spikes and groundwork (do first; each one can change later tasks)

- [ ] **0.1 Calendar spike** (test service-account key, QA Neon branch, throwaway script in `scripts/dev/`). Confirm the service account can:
  - `calendars.insert` a secondary calendar with `timeZone: Asia/Manila`
  - `acl.insert` `{role: "reader", scope: {type: "user", value: <consumer gmail>}}`, both with `sendNotifications: true` and `false`
  - `acl.list` and `acl.delete`
  - `calendars.delete`

  Also confirm which subscribe URL opens "Add calendar" for a shared reader: `https://calendar.google.com/calendar/r?cid=<id>` or a base64 `cid`. Record the quota and rate-limit behavior when sharing to external users.

- [ ] **0.2 Telegram spike.**
  - Create the bot with BotFather.
  - Confirm that `t.me/<bot>?startgroup=<token>` sends `/start@<bot> <token>` to the webhook when privacy mode is on.
  - Confirm that `my_chat_member` fires when the bot is added or removed.
  - Trigger a group-to-supergroup upgrade and capture the `migrate_to_chat_id` error shape.
  - Check the `retry_after` shape on 429 responses.
- [ ] **0.3 Vercel limits.**
  - Confirm the plan tier. Hobby allows only daily crons, so the design assumes one daily cron plus `waitUntil`. If Pro, add a 15-minute job-drain cron.
  - Add `@vercel/functions` and confirm `waitUntil` works under `@sveltejs/adapter-vercel` (sin1).
- [ ] **0.4 Production data audit** (read-only SQL on prod):
  - count of `loan_groups`, `loan_group_loans`, and non-`active` members
  - groups whose creator is not the workspace owner
  - group loans not owned by the group's creator

  These rows would widen access under the new rules. The migration in 1.2 handles them.

- [x] **0.5** Create `docs/workflow/planned/loan-groups-v2.md` (a condensed version of this plan) and add it to the planned README.

---

## Phase 1: Data model (migration `0020_loan_groups_v2.sql` + `schema.ts`)

### 1.1 New and changed tables

| Table                          | Columns / constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Purpose                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `loan_group_members` (changed) | Drop `status` and the `group_member_status` enum. Add `party_roles text[] NOT NULL DEFAULT '{}'` (owner / investor / borrower / witness, collected across the group's loans) and `synced_at timestamp`. Keep `unique(group_id, user_id)`.                                                                                                                                                                                                                                                                                                                                                                                              | Derived membership cache.                        |
| `group_calendars`              | `group_id int PK FK→loan_groups ON DELETE cascade`; `google_calendar_id text UNIQUE`; `status` enum `group_calendar_status` ('provisioning','active','error'); `last_event_sync_at`, `last_acl_sync_at`, `last_error text`, timestamps                                                                                                                                                                                                                                                                                                                                                                                                 | One Google calendar per group.                   |
| `group_telegram_settings`      | `group_id int PK FK cascade`; `chat_id text` with a partial unique index where not null (one chat serves one group); `chat_title`, `chat_type`; `status` enum ('disconnected','connected','bot_removed'); `enabled bool default true`; `notify_upcoming bool default true`; `reminder_days int[] default '{3,1}'`; `notify_due_today bool default true`; `notify_overdue bool default true`; `overdue_repeat_every_days int default 1`; `notify_daily_digest bool default false`; `notify_activity bool default true`; `include_amounts bool default true`; `linked_by_user_id`, `linked_at`, `last_sent_at`, `last_error`, timestamps | Telegram settings for each group.                |
| `telegram_link_tokens`         | `id serial`; `group_id FK cascade`; `token_hash text UNIQUE` (sha256); `created_by_user_id`; `expires_at` (30 min); `used_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | One-time chat-linking tokens.                    |
| `group_notification_log`       | `id`; `group_id FK cascade`; `fingerprint text`; `kind text`; `status` ('claimed','sent','failed'); `attempts int`; `telegram_message_id text`; `error`; `created_at`, `sent_at`; **`unique(group_id, fingerprint)`**; index `(status, created_at)`                                                                                                                                                                                                                                                                                                                                                                                    | Prevents duplicate sends; audit trail.           |
| `integration_jobs`             | `id bigserial`; `kind text`; `group_id int` (no FK, so delete jobs outlive the group); `payload jsonb`; `dedupe_key text`; `status` ('pending','running','done','failed'); `attempts int`; `run_after timestamp default now()`; `locked_at`; `last_error`; timestamps. **Partial unique index on `dedupe_key` where status = 'pending'**; index `(status, run_after)`.                                                                                                                                                                                                                                                                 | Outbox for all Google and Telegram side effects. |

UX-driven additions in the same migration:

| Table                        | Columns / constraints                                                                                                                                                                                                                                               | Purpose                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `loan_groups` (changed)      | Add `color text NOT NULL DEFAULT 'orange'`, validated in the app against a fixed palette key (see 4.1). Rename the UI label of `notes` to "Description" (column unchanged). Add index `(creator_user_id, name)`.                                                    | Group identity for chips and badges.                                          |
| `loan_group_loans` (changed) | Add `added_by_user_id text FK→user ON DELETE set null` and `source text NOT NULL DEFAULT 'manual'` ('manual' \| 'rule').                                                                                                                                            | Explains _why_ a loan is in a group; rule-added loans are labelled in the UI. |
| `loan_group_rules`           | `id serial`; `group_id FK cascade`; `party_type` enum ('investor','borrower'); `contact_id int` (investor or borrower row id, checked in the app); `created_by_user_id`; `created_at`; `unique(group_id, party_type, contact_id)`; index `(party_type, contact_id)` | Smart groups: automatically add future loans for a contact.                   |

Add Drizzle table definitions and relations in `src/lib/server/db/schema.ts`: `loanGroups` gains `calendar` (one), `telegram` (one) and `rules` (many); `loans` gains `groupLoans` (many), so list queries can include group ids.

### 1.2 Data backfill inside the migration

- Delete `loan_group_loans` rows where the loan's `user_id` is not the group's `creator_user_id`, unless the creator is the workspace owner. This stops access widening, based on the audit in 0.4.
- Delete member rows with status other than `active` before dropping the column. Membership is re-derived by the recompute backfill in 2.3.
- Add a new `scripts/db/backfill-group-members.ts` (plus a package script `db:backfill:group-members`). It calls `recomputeGroupMembers` for every group.

---

## Phase 2: Derived membership and group access

### 2.1 Membership engine (`src/lib/server/group-access.ts`, rewritten)

- [ ] `resolvePartyUsersForLoans(loanIds)`: **one batched query** returning `Map<userId, Set<role>>`. It replaces the current per-loan loop in `resolveLoanPartyUserIds`, which queries once per loan. Sources:
  - `loans.userId` → owner
  - `investors.investorUserId` via `loan_investors`
  - `borrowers.borrowerUserId`
  - `witnesses.witnessUserId` via `loan_witnesses` and `loan_signing_invitations.witnessId`

  Email-only invitations without a user row are skipped; the same rule as today.

- [ ] `recomputeGroupMembers(groupId)`, in one transaction (neon-serverless `Pool` supports transactions):
  1. Compute the desired member set.
  2. Upsert rows with `party_roles` and `synced_at`.
  3. Delete rows that are no longer in the set.
  4. If anything changed, enqueue `group.calendar.acl` and call `invalidateGroupData()`.
- [ ] `recomputeGroupsForLoans(loanIds)`: find group IDs from `loan_group_loans` and recompute each group.
- [ ] `hasGroupViewAccess(groupId, userId)`: true for the creator, an existing member, or the workspace owner (`isWorkspaceAdmin`).
- [ ] `hasGroupManageAccess(groupId, userId)`: the creator or the workspace owner. This replaces `hasGroupEditAccess`.
- [ ] Delete `canLeaveGroup`, `syncGroupMembersForLoan`, `syncGroupMembers`, and the GET-time sync in `groups/[id]/+page.server.ts`.

### 2.2 Authorization changes

- [ ] `POST /api/groups`: require `isWorkspaceAdmin`. The creator's own membership now comes from recompute, not a manual insert.
- [ ] `POST /api/groups/[id]/loans`: require `hasLoanAdminAccess(loanId)` (the loan owner) instead of `hasLoanViewAccess`. This stops an investor from grouping someone else's loans and exposing them to other parties. Accept `loanIds[]` for bulk add. After the insert:
  - recompute members
  - enqueue `group.calendar.syncLoan` for each loan
  - enqueue a Telegram activity event (`loan_added`)
- [ ] `DELETE /api/groups/[id]/loans/[loanId]`:
  - recompute members, which revokes parties who were only on that loan
  - enqueue `group.calendar.removeLoan` (with `calendarId` in the payload)
- [ ] `DELETE /api/groups/[id]`: before the delete, read the calendar ID, then enqueue `group.calendar.delete` with that ID in the payload.
- [ ] **Remove** `src/routes/api/groups/[id]/leave/+server.ts` and `src/routes/api/groups/[id]/members/[userId]/+server.ts`, plus their UI.

**New endpoints for the UX flows** (all owner-only except the GETs, which follow `hasGroupViewAccess`; bodies validated in a shared `src/lib/group-validation.ts`):

- [ ] `POST /api/groups` accepts `{name, color, description?, loanIds?: number[], rules?: {partyType, contactId}[]}`, so the wizard creates everything in **one request and one transaction**. Loan ids go through the same owner check. It returns the group plus the access summary.
- [ ] `PUT /api/groups/[id]` accepts `color` as well as name and description.
- [ ] `POST /api/groups/[id]/access-preview` with body `{addLoanIds?, removeLoanIds?, rules?}`. It is a dry run using `resolvePartyUsersForLoans` and a pure `diffGroupMembers`, and returns `{gained: Person[], lost: Person[], unchanged: number}` where `Person = {name, roles, hasEmail}`. For a group that doesn't exist yet (the wizard), use `POST /api/groups/access-preview` with the same body minus removals. Nothing is written.
- [ ] `PUT /api/loans/[id]/groups` with body `{groupIds: number[]}` sets the loan's groups from the loan form or detail page. It diffs the groups, then recomputes and enqueues jobs for each group it touched.
- [ ] `POST /api/groups/[id]/loans` with body `{loanIds}` for bulk add, and `DELETE /api/groups/[id]/loans` with body `{loanIds}` for bulk remove (used by multi-select on the hub).
- [ ] `GET|POST /api/groups/[id]/rules` and `DELETE /api/groups/[id]/rules/[ruleId]`. A POST also back-fills matching existing loans when `applyToExisting: true`.
- [x] ~~`GET /api/groups/suggestions`~~ removed (owner suggestion strip was confusing; create via New group / contact deep links only)

### 2.3 Recompute triggers (event-driven; replaces the recompute on page load)

Call `recomputeGroupsForLoans(affectedLoanIds)` after a successful write in:

- `src/routes/api/loans/+server.ts` (POST: rules apply on create; groups picked in the form are saved right after, see 4.6) and `src/routes/api/loans/[id]/+server.ts`:
  - PUT: borrower or investor allocations changed. Also enqueue `syncLoan` for each group, because dates and amounts may have changed.
  - DELETE: read the group IDs **before** the delete; the cascade removes the links.
- `src/routes/api/loans/[id]/witnesses/**`
- Contact-link changes that flip `*UserId`:
  - `api/investors/[id]`, `api/borrowers/[id]`, `api/witnesses/[id]` (PUT)
  - `party-investor-links.ts`
  - `party-user.ts` linking

  For these, look up the contact's loans, then recompute.

- Payment, interest-period and status routes (`api/loans/[id]/payments`, `received-payments`, `interest-periods/[id]`, `loans/[id]/status`, `extend-interest`) do not change membership. They only enqueue `syncLoan` and Telegram activity events. See Phase 3 for the single helper that does this.
- **Smart group rules:** after a loan create or update, `applyGroupRulesForLoan(loanId)` matches `loan_group_rules` by the loan's `borrowerId` and its `loan_investors.investorId` values. It inserts `loan_group_loans` rows with `source='rule'` using `ON CONFLICT DO NOTHING`, then recomputes. Rules only **add** loans; a loan is never removed automatically when its investor changes. The owner removes it by hand, and the UI shows a "Added by rule" label to explain why it's there.
- Safety net: the daily cron (Phase 3) runs a full reconcile of every group.

### 2.4 Read-only loan access for group members

- [ ] `src/lib/loan-access.ts`: add `viaGroupIds: number[]` and `isGroupViewer: boolean` to `LoanAccessContext`. `isGroupViewer` means "group access but no party membership". Do **not** add a new `LoanMembership` value, so no borrower or witness abilities leak through.
- [ ] `access-control.ts`: add `hasLoanGroupViewAccess(loanId, userId)`, a single join of `loan_group_loans` and `loan_group_members`. Leave `hasLoanViewAccess` unchanged.
- [ ] `src/lib/server/loan-detail.ts` (`loadLoanDetail`): if `computeLoanAccessContext` returns `!canView`, check group access. If allowed, return `projectLoanForGroupViewer(entity)` with `canView: true`, `canAdminEdit: false` and `isGroupViewer: true`.
- [ ] New pure module `src/lib/loan-group-viewer-projection.ts`:
  - **Removes:** party `email`, `contactNumber`, `address`, `validIdUrl` and `eSignatureUrl`; borrower `notes`; `receiptImageUrl`, `receipts` and `receiptExtractedData` on allocations and payments; `signingInvitations`; `loanContract`; `paymentMethods`; `googleCalendarEventIds`.
  - **Keeps:** names, loan type and status, dates, principal, rates, interest periods, received amounts and dates, totals.
- [ ] `loans/[id]/+page.server.ts`: skip `resolveCanSignContract` for group viewers. In `LoanDetailContent.svelte` and related components, hide edit, sign, payment, receipt and contract actions when `access.isGroupViewer`, and show a "Viewing via group: <name>" badge.
- [ ] Storage (`src/lib/server/storage/access.ts`): no change. It keeps using `hasLoanViewAccess`, which stays party-only, so group viewers cannot fetch receipts or identity documents.
- [ ] Role pages (`/investments`, `/borrowed`, `/witnessed`) and the dashboard stay **role-scoped**: a loan a user can see only through a group never appears there. Group-only loans live in the group hub (`/groups/[id]`). The group bar on role pages (4.3) filters the user's own role loans and links to the hub for the rest. That keeps "my money" numbers accurate and the hub as the one place for shared visibility.

### 2.5 Navigation and layout data

- [ ] `getNavCapabilities` (`access-control.ts`): add `hasGroups`, true when the user has a membership row or is the workspace owner.
- [ ] `src/lib/nav/app-nav.ts`:
  - Add `hasGroups` to `NavCapabilities` and `DEFAULT_NAV_CAPABILITIES`.
  - Admin: Overview = Dashboard, Groups (always, so they can create the first one).
  - Party users: Dashboard, Groups (only when `hasGroups`), then their role pages. Groups lands in the phone dock (`MOBILE_DOCK_MAX_PRIMARY_TABS = 4`).
  - Remove the `SHOW_GROUPS_UI` checks from nav building; the flag moves to a single gate in `+layout.server.ts` until rollout.
  - Update `app-nav.test.ts`.
- [ ] `src/routes/+layout.server.ts`: also return `groupsIndex`, a small list for the viewer (`{id, name, color, loanCount}`), cached as `groups:index:<userId>` and invalidated by `invalidateGroupData`. Chips, badges and pickers read it from `page.data`, so no page fetches group names separately.

---

## Phase 3: Background job runner (outbox)

- [ ] `src/lib/server/jobs/queue.ts`:
  - `enqueueJob({kind, groupId, payload, dedupeKey, runAfter?})` uses `INSERT … ON CONFLICT DO NOTHING` on the pending dedupe index, which merges repeated saves into one job.
  - `enqueueGroupLoanChanged(loanId, {calendar: boolean, activity?: ActivityEvent})` is the single helper that mutation routes call.
- [ ] `src/lib/server/jobs/runner.ts`:
  - `drainJobs({maxJobs, deadlineMs})` claims jobs atomically with `UPDATE integration_jobs SET status='running', locked_at=now(), attempts=attempts+1 WHERE id IN (SELECT id … WHERE status='pending' AND run_after<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT n) RETURNING *`.
  - It dispatches through a typed handler registry.
  - On error it retries with exponential backoff (`run_after`) up to 6 attempts, then marks the job `failed` and writes `last_error` to `group_calendars` or `group_telegram_settings`.
  - Jobs stuck in `running` with `locked_at` older than 10 minutes go back to pending.
- [ ] `src/lib/server/jobs/after-response.ts`: `scheduleDrain(event)` calls `waitUntil(drainJobs({deadlineMs: 50_000}))` from `@vercel/functions`. Locally (no Vercel context) it runs without awaiting.
- [ ] Job kinds:

  | Kind                        | Payload                |
  | --------------------------- | ---------------------- |
  | `group.members.recompute`   | —                      |
  | `group.calendar.provision`  | —                      |
  | `group.calendar.acl`        | —                      |
  | `group.calendar.syncLoan`   | `{loanId}`             |
  | `group.calendar.removeLoan` | `{loanId, calendarId}` |
  | `group.calendar.summaries`  | `{dateKeys}`           |
  | `group.calendar.delete`     | `{calendarId}`         |
  | `group.telegram.activity`   | `{event}`              |

- [ ] Cron `GET /api/cron/groups` (new `src/routes/api/cron/groups/+server.ts`, daily `0 0 * * *` UTC = 08:00 Manila, added to `vercel.json`):
  - **Requires** `Authorization: Bearer CRON_SECRET` and rejects when it is missing. Unlike the backup cron, it fails closed.
  - Order: (1) reconcile members for all groups, (2) ACL reconcile, (3) Telegram reminders and digest (Phase 6), (4) drain jobs until the time budget runs out.
  - Set `export const config = { maxDuration: 60 }`.
- [ ] Owner-only `POST /api/groups/[id]/sync` ("Sync now" button): enqueues recompute, ACL and a full calendar sync, then drains.
- [ ] Prune done jobs older than 14 days and notification logs older than 180 days in the daily cron.

---

## Phase 4: Groups UX

### 4.0 Principles

- **Groups follow the loans.** Wherever a user sees loans, they can narrow to a group and see which groups a loan belongs to. The hub is where everything about one group comes together.
- **Show access before it changes.** Every action that adds or removes people (create, add or remove loans, rules) first shows who gains or loses access. Warn clearly when a group mixes different borrowers.
- **Few steps for the owner.** Create with loans in one flow, file loans from where you already are (loan list selection, loan detail, contact page), and let rules pick up future loans.
- **Nothing to manage for members.** Members see their groups, the loans, the people, and how to get notified. They see no settings.
- **Reuse the shell.** Follow the locked decisions in `docs/workflow/planned/mobile-native-redesign.md`:
  - `ResponsiveModal` (bottom sheet under `lg`)
  - detail pages on phone
  - 44px touch targets
  - `PageHeader` / `DetailHeader` / `MobileHeroActions`
  - amounts through the price-visibility formatters

### 4.1 Shared group primitives (`src/lib/components/groups/`, `src/lib/groups/`)

- [ ] `src/lib/groups/group-colors.ts`: a fixed palette of 8 keys (orange, amber, emerald, teal, sky, indigo, violet, rose) mapped to dot, background-tint, text and ring classes for light and dark themes. `nextGroupColor(usedKeys)` suggests an unused color. Unit test: every key resolves, and unknown keys fall back to orange.
- [ ] `GroupBadge.svelte`: color dot + name (truncated), sizes `sm`/`md`, and optional `href` to the hub. The name is always visible, so color is never the only signal.
- [ ] `GroupBadgeList.svelte`: up to 2 badges, then "+N". Tapping it opens a popover, or a sheet on phone, listing all of them.
- [ ] `GroupChipBar.svelte`: a horizontal, snap-scrolling chip row.
  - Chips: **All** · each group (dot, name, loan count _within the current page's loans_) · **Ungrouped** (owner, `/loans` only) · a trailing "Manage groups" link.
  - Uses `role="radiogroup"` with arrow-key navigation and a visible focus ring. 44px tall on phone. Sticky under the page header on phone.
  - Hidden when no group matches any loan on the page.
  - Bound to the `?group=<id>|ungrouped` URL parameter through `replaceState`, like the existing `status` and `view` params.
- [ ] `AccessPreview.svelte`: renders the access-preview response.
  - A "Will get access" list and a "Will lose access" list, grouped by role with role badges.
  - A count line such as "11 people will see all 8 loans".
  - **Mixed-borrower warning** when the resulting group has 2 or more distinct borrowers: "This group has 3 borrowers. Each borrower will see the other borrowers' loans."
  - A note for parties without an email: "No email — won't get the Google Calendar."
- [ ] `GroupPickerSheet.svelte` (`ResponsiveModal`):
  - a searchable checklist of the owner's groups (dot, name, loan count)
  - a "+ New group" row that expands an inline name + color form
  - on save, runs access preview, then applies

  Used by bulk actions, loan detail and the loan form.

- [ ] `GroupAvatarStack.svelte`: initials avatars (max 4, then +N) for people on cards and headers.

### 4.2 Prerequisite: one shared loan list page (refactor first, as its own PR)

`/loans`, `/investments`, `/borrowed` and `/witnessed` are four near-identical ~600-line pages with the same toolbar, filters, summary cards, table/cards/calendar views and row actions. Adding the group bar four times, plus a fifth copy for the hub, would be wasteful and drift over time.

- [ ] Extract `src/lib/components/loans/LoanListPage.svelte` and `src/lib/composables/use-loan-list-filters.svelte.ts` (search, status, type, amounts, due date, participants, URL sync, clear). Props:
  - `scope` (`owned` | `investments` | `borrowed` | `witnessed` | `group`)
  - `pageTitle`, `description`, `emptyMessage`, `emptyIcon`
  - `canCreate`, `canManage`
  - `loans` (promise)
  - optional snippets `headerActions`, `summary` (e.g. the borrowed-profit stats) and `bulkActions`
  - optional `groupContext` (`{groupId, canManage}`) for the hub
- [ ] Rewrite the four route `+page.svelte` files as thin wrappers.
- [ ] **Parity guard:** before the refactor, capture Playwright screenshots of all four routes at 390px and 1440px in table, cards and calendar views. Match them after. Existing unit tests must stay green.

### 4.3 Groups inside every loan module

- [ ] **Loan payload:** add `groupLoans: { columns: { groupId: true, source: true } }` to `listRelations` and `fullRelations` in `cached-data.ts` and expose `groupIds` on `LoanWithInvestors` (`src/lib/types.ts`). Names and colors come from `page.data.groupsIndex` (2.5), so the loan payload stays small.
- [ ] **Group bar** (`GroupChipBar`) in `LoanListPage`, between the summary cards and the toolbar. Selecting a group narrows the summary cards, table, cards and **calendar** together. The calendar view becomes a per-group in-app calendar for free.
  - **`/loans` (owner):** All · groups · **Ungrouped**, which makes it easy to find loans that still need filing.
  - **`/investments`, `/borrowed`, `/witnessed`:** only groups that contain at least one of the user's loans on that page. When a group is selected, a slim info row reads "Showing your 3 investments in _Santos family_" with a link "See all 8 loans in this group →" to `/groups/[id]?tab=loans`.
  - The group is a scope, not a filter. "Clear filters" keeps it, and the result line reads "Showing 4 of 12 loans in _Group_".
- [ ] **Badges:** `GroupBadgeList` on `LoanCard.svelte`, and a "Groups" column in `LoansTable.svelte` that is hidden when the viewer has no groups and toggles like other columns. Clicking a badge filters the current page to that group (it doesn't navigate). On the hub the column is hidden.
- [ ] **Bulk actions on `/loans` (owner)** with a new `LoanBulkActionBar.svelte`, built on the row selection `LoansTable` already has (`enableRowSelection`, `selectedRowIds`):
  - A sticky bar appears when rows are selected: "8 selected · **Add to group** · **New group from selection** · Remove from _current group_ (only when a group is selected) · Export · Clear".
  - **Add to group** → `GroupPickerSheet` → access preview → bulk `POST`.
  - **New group from selection** → wizard at step 1 with the loans preselected.
  - **Phone:** cards have no checkboxes today, so add a "Select" toggle to the `ListPageToolbar` on phone that shows checkboxes on `LoanCard`. The bar docks above the tab bar, respecting safe areas.
- [ ] Add, remove and move actions update the UI immediately and roll back on error. Remove toasts include **Undo** (re-adds the loans).

### 4.4 Groups menu and `/groups` list

- [ ] Nav per 2.5. `resolveMobilePageTitle` already covers `/groups`; remove the `/groups/new` route (the wizard replaces it), with a redirect to `/groups?create=1`.
- [ ] `getCachedGroupsForUser` (`cached-data.ts`) becomes **one aggregated query** per viewer returning, for each group:
  - `id`, `name`, `color`, `description`
  - `loanCount`, `openLoanCount`, `outstandingPrincipal`
  - `nextDueDate`, `overdueCount`
  - `peopleCount`, the first 4 people's initials
  - `calendarStatus`, `telegramStatus`
  - `viewerRoles` (from `party_roles`)
- [ ] `GroupCard.svelte` redesign:
  - left color edge; name and one-line description
  - stat row: "8 loans · ₱1.2M outstanding · Next due Sep 20"
  - a red "2 overdue" badge when relevant
  - avatar stack; calendar and Telegram status icons (tooltip text, not just color)
  - for members, a chip such as "You: Investor"
- [ ] Page layout:
  - `PageHeader` "Groups" with a description.
  - The owner gets a primary **New group** button (`MobileHeroActions` on phone).
  - Search appears once there are more than 6 groups. Sort: "Needs attention" (overdue first, then soonest due; default) · Name · Recently updated.
  - Grid: 1 column on phone, 2 at `sm`, 3 at `2xl`, with the list skeleton (`ListPageSkeleton` variant `groups`).
- [x] ~~**Suggestions strip (owner)**~~ removed from `/groups` (use New group or contact “Group these loans” instead)
- [ ] **Empty states:**
  - Owner with no groups: empty state with **New group**
  - Member (direct URL, nav hidden): "You're not in any groups yet."

### 4.5 Group hub `/groups/[id]`

- [ ] **Header** (`GroupHubHeader.svelte` on `DetailHeader`):
  - back to Groups; color block + name; description
  - meta line "8 loans · 11 people · Next due Sep 20"
  - viewer chip ("Owner" / "You're an investor here")
  - clickable status pills: 📅 Calendar (members: subscribe; owner: settings) · ✈️ Telegram
  - **Owner actions:** primary **Add loans**, plus an overflow menu with Edit, Settings, Delete
  - **Member action:** primary **Add to Google Calendar**
- [ ] **Tabs** via `?tab=` (a sticky, scrollable segmented control on phone): **Overview · Loans · People · Settings** (Settings is owner-only, so members see 3 tabs). The calendar is the Loans tab's calendar view, and the Overview links to it (`?tab=loans&view=calendar`), which keeps the tab count phone-friendly.
- [ ] **Overview:**
  - `LoanListSummaryCards` over the group's loans.
  - A **Needs attention** section reusing `PastDueLoansCard` and `MaturingLoansCard` with the group's loans (overdue, due within 7 days).
  - A **Next 30 days** timeline reusing `LoanDueEventCard`, `LoanInterestDueEventCard` and `LoanSentEventCard`.
  - A **Stay updated** card: calendar subscribe button and status; Telegram "Connected to _Santos Loans_ chat — ask the owner to add you" or "Not connected".
  - **Owner setup checklist** (dismissible for each group; hidden once done): ✓ Loans added · ✓ Calendar shared with N people · ○ Connect Telegram · ○ Add a rule for future loans.
- [ ] **Loans:**
  - `LoanListPage` with `scope="group"` and `groupContext`: same search, filters, summary and table/cards/calendar as everywhere else.
  - **Owner:** "Add loans" (a loan picker sheet: searchable checklist of _owned_ loans not in the group, filterable by open/completed, borrower and investor, with a "Select all visible" option and each row's current group badges, then the access preview), row action "Remove from group", bulk remove, and an "Added by rule" label for `source='rule'`.
  - **Members:** view-only row actions; quick view opens the read-only `LoanDetailModal` (phone navigates to `/loans/[id]`).
- [ ] **People** (`GroupPeopleTab.svelte`, replacing `GroupMembersList`):
  - Info banner: "People are added and removed automatically from the loans in this group."
  - Sections: Owner · Investors · Borrowers · Witnesses (a person appears once, with all role badges).
  - Each row: initials avatar, name, roles, and "on 3 loans", which expands to the loan names linking to the loans.
  - Owner-only columns: email and calendar access (Shared · Invite pending · No email).
  - No remove buttons.
- [ ] **Settings** (owner, `GroupSettingsTab.svelte`):
  - **General:** name, color swatches, description, saved inline.
  - **Automatic loans (rules):** list of rules ("All loans for investor _Maria Santos_"), add with a contact picker plus an "Also add their existing loans" checkbox and access preview, and remove.
  - **Google Calendar** card (5.x).
  - **Telegram** card (6.4).
  - **Danger zone:** "Delete group". The confirmation spells out the effects: "11 people lose access · the shared Google Calendar is deleted · the Telegram chat stops getting updates. Loans are not deleted."
- [ ] **Data:** the hub `+page.server.ts` streams `group`, `loans` (projected for non-owners, cache key `groups:loans:<groupId>`), `people` and `integrations`, so the header paints first. `cache-invalidation.ts`: `invalidateLoanData`, `invalidateBorrowerData` and `invalidateInvestorData` also drop `groups:`.

### 4.6 Create and manage flows

- [ ] **Create group wizard** (`CreateGroupWizard.svelte` in `ResponsiveModal`; 3 steps; steps 2–3 skippable; state kept if the sheet is closed by accident until the page reloads):
  1. **Basics:**
     - Name (required; soft warning when the owner already has a group with that name).
     - Color swatches, preselected with `nextGroupColor`.
     - Description (optional).
     - **Add loans from:** None, plus Investor and/or Borrower (both can be on). Each type is a multi-select of contacts on loans you own. Picking people unions their loans on step 2 (All loans shows the rest), suggests "<Contact> loans" when exactly one person is selected, and ☑ "Also add their future loans" creates a rule per selected contact. None starts with no loans selected. Step 2 has one search (loan name or borrower), a selected count above the list, Select all, and Unselect all.
  2. **Loans:**
     - A searchable checklist of owned loans. Defaults to open loans; a "Show completed" toggle; borrower and investor filters; "Select all visible".
     - Each row shows borrower, due date, amount (price-visibility aware) and its existing group badges.
     - A sticky footer shows "8 selected".
  3. **Review access:**
     - `AccessPreview` for the selection, including the mixed-borrower warning.
     - ☑ "Create a shared Google Calendar" (on by default; hidden if service-account env is missing).
     - A hint that Telegram can be connected after creating.
     - **Create group** submits one `POST /api/groups` request.

  On success: toast, then navigate to `/groups/[id]?tab=overview`, where the setup checklist shows.

- [ ] **Entry points into the wizard:**
  - `/groups` New group button
  - bulk "New group from selection" on `/loans`
  - "Group these loans" on the investor and borrower detail pages
  - "+ New group" inside `GroupPickerSheet`, which uses the short inline form, not the full wizard
- [ ] **Loan detail** (`LoanSummarySection.svelte` / `LoanDetailContent.svelte`):
  - A "Groups" row with `GroupBadgeList` linking to hubs.
  - **Owner:** "Manage" opens `GroupPickerSheet`, then access preview, then `PUT /api/loans/[id]/groups`.
  - **Group viewer:** a top banner "Shared with you through _Santos family_ · Read-only" linking to the hub (together with 2.4).
- [ ] **Loan create form** (`LoanForm.svelte` / `LoanCreateModal.svelte`, owner): an optional "Groups" multi-select in the last section.
  - When the chosen borrower or investors match a rule, show "Will also be added to _Santos family_ (rule)" live, computed client-side from `groupsIndex` plus a small rules summary included in `loanFormOptions`.
  - Saved through `PUT /api/loans/[id]/groups` right after create, so the loan create API contract stays the same.
- [ ] **Contact detail pages** (`investors/[id]`, `borrowers/[id]`; owner):
  - A "Groups" card listing groups that contain this contact's loans, with loan counts.
  - A **Group all N loans** button that opens the wizard prefilled.
  - A "Rule active" label when a rule targets the contact.
- [ ] **Edit** uses `GroupFormModal` (name, color, description), reused in Settings → General.
- [ ] **Remove a loan** (row action or bulk): the confirm dialog embeds `AccessPreview` in removal mode ("Juan Dela Cruz (borrower) will lose access"). If a rule would re-add the loan, say so and offer "Remove rule too".

### 4.7 Dashboard

- [ ] **Groups card** on `/dashboard` for owners and members when `hasGroups`:
  - Up to 3 groups sorted by attention (overdue count, then next due).
  - Each shows color dot, name, "2 overdue" or "Next due Sep 20", and links to the hub.
  - Footer link "All groups".
  - Reuses the `ActivityPanelCard` styling from `DashboardActivityCards`.
- [ ] A dashboard-wide group filter is **out of scope for v1**, because dashboard stats are computed per user on the server. It is listed as a follow-up.

### 4.8 States, accessibility, copy

- [ ] **Skeletons:** `ListPageSkeleton` variant `groups`, a `DetailPageSkeleton` variant for the hub, and a skeleton for access-preview loading (a spinner inline in the dialog).
- [ ] **Errors:** access preview or save failures keep the dialog open with an inline message. Integration errors show on the hub status pills (owner) as "Calendar needs attention".
- [ ] **Accessibility:**
  - Chip bar radiogroup semantics; tabs through `bits-ui` or the shadcn tabs primitive (keyboard support).
  - Badges include the text name; AA contrast for palette tints in both themes (checked in the palette test using the token values).
  - The dialog and sheet focus trap is inherited from `ResponsiveModal`.
- [ ] **Copy / vocabulary:**
  - "Group", "Loans", "People", "Shared with you".
  - Avoid "members" in the UI.
  - Role names match the existing Admin/Investor/Borrower/Witness labels from `src/lib/account-roles.ts`.
- [ ] **Performance:**
  - Chips count client-side from already loaded loans (no extra request).
  - `groupsIndex` comes from the layout (cached).
  - Hub streams its data; the access preview is debounced 300ms in the wizard.

### 4.9 Rollout gate

- [ ] Keep `SHOW_GROUPS_UI` in `src/lib/feature-flags.ts` as a single gate:
  - layout `groupsIndex` is empty
  - nav item hidden
  - chip bar and badges hidden
  - loan detail "Groups" row hidden

  Flip it only in the Phase 7 rollout. The 4.2 refactor ships separately, before the flag.

---

## Phase 5: Google Calendar per group

### 5.1 Refactor the calendar core so it can target any calendar

- [ ] `google-calendar-config.ts`:
  - Split credentials from the calendar ID: `readGoogleServiceAccountCredentials(source)` requires only the service-account email and key; `GOOGLE_CALENDAR_ID` becomes optional, used only by the legacy workspace-wide calendar.
  - Add ACL and calendar-not-found error formatting.
  - Update `google-calendar-config.test.ts`.
- [ ] `google-calendar.ts`:
  - Memoize one `GoogleAuth` and `calendar` client per process (today a new one is built on every call).
  - Every exported function takes `target: { calendarId }` (for example `createCalendarEvent(target, data)`, `upsertCalendarEvent(target, data)`, `deleteCalendarEventBatch(target, n)`).
  - The existing workspace sync (`api/loans/sync-calendar`, `cleanup-calendar`) passes `{ calendarId: env GOOGLE_CALENDAR_ID }`, so its behavior is unchanged.
  - Keep the throttling and `withGoogleCalendarRetry`.
- [ ] Add a private extended property `kameLoanId` to every loan event (in `googleEventRequestBody`) and a `findEventsByLoanId(target, loanId)` helper for removals.
- [ ] Add the group name and member-safe links to event descriptions. Links go to `/loans/[id]`, which now opens read-only for group viewers.

### 5.2 Provisioning and sharing (`src/lib/server/group-calendar.ts`, new)

- [ ] `provisionGroupCalendar(groupId)`:
  1. Upsert `group_calendars` with status provisioning.
  2. `calendars.insert({summary: "Kame Lends · <group name>", description, timeZone: "Asia/Manila"})`.
  3. Store the ID and set status active.
  4. Enqueue ACL sync and a full event sync.

  It runs automatically when a group is created (enqueued from `POST /api/groups`). If the stored calendar returns 404, clear the row and provision again. On group rename, `calendars.patch` the summary.

- [ ] `reconcileGroupCalendarAcl(groupId)`:
  - Desired set: member `users.email` values, normalized with `normalizeEmail`.
  - Actual set: `acl.list`, skipping the service account's own `owner` rule.
  - Insert missing `reader` rules (`sendNotifications: true` on first share); delete rules that are no longer members.
  - Set `last_acl_sync_at`. Throttle through the existing mutation spacing.
- [ ] `syncGroupLoanEvents(groupId, loanId)`: load the loan with the `loanRelations` shape from `sync-calendar`, then reuse `generateLoanCalendarEvents(loan, {scope: "all"}, target)`. It upserts by `kameKey`, so it can safely repeat. Then enqueue `group.calendar.summaries` for affected dates (`getAffectedDatesFromLoan`).
- [ ] `removeGroupLoanEvents(calendarId, loanId)`: `findEventsByLoanId`, delete each event, then recompute summaries for the affected dates.
- [ ] `syncGroupSummaries(groupId, dateKeys)`: `generateDailySummaryEvents(groupLoans, dates, target)`. Totals count **only this group's loans**.
- [ ] `deleteGroupCalendar(calendarId)`: `calendars.delete`; a 404 counts as success.

### 5.3 Full resync API (reuses the batched pattern)

- [ ] `POST /api/groups/[id]/calendar/sync` (owner only) mirrors the actions in `api/loans/sync-calendar/+server.ts` (`prepare` / `wipe` / `loans` / `summaries`, scope `all|open|upcoming`). It reuses `planLoansForSync`, `planDailySummaryDateKeys` and `loansForCalendarSync` from `src/lib/calendar-sync-plan.ts`, with the loan set = group loans and target = the group calendar.
- [ ] Extract the client-side batching loop and progress dialog from `SyncCalendarButton.svelte` into a component that takes the endpoint as a prop, so settings and group pages share it.

### 5.4 Docs

- [ ] Update `.agent/skills/google-calendar-integration/SKILL.md`: per-group calendars, the target parameter, ACL reconcile, the jobs outbox, automatic incremental sync for groups (the workspace calendar stays manual). Also update `docs/PROJECT.md` (env: `GOOGLE_CALENDAR_ID` now optional) and `.env.example`.

---

## Phase 6: Telegram per group

Patterns carried over from KameHomes (`kame-homes/supabase/functions/_shared/propertyTelegramCredentials.ts`, `telegramDiscoverChats.ts`, `telegramFinance.ts`):

- chat ID normalization
- getMe / getChat verification
- a send log that prevents duplicates
- enabled and notification toggles
- a test message

Patterns from KameOps (`kame-ops/apps/web/src/app/api/webhooks/telegram/route.ts`): the webhook secret header check and message sending. **Not carried over:** a bot token per group, and pasting chat IDs by hand. The link flow replaces both.

### 6.1 Telegram client (`src/lib/server/telegram/`)

- [ ] `config.ts`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, read at runtime through `$env/dynamic/private`. When they are missing, the feature shows "not configured" instead of throwing.
- [ ] `api.ts`: `sendMessage(chatId, html)` with `parse_mode: "HTML"`, `disable_web_page_preview`, and 4096-character chunking; also `getChat` and `getMe`. Typed errors:
  - **429:** wait `retry_after`, then retry.
  - **400 with `migrate_to_chat_id`:** update `group_telegram_settings.chat_id`, then retry once.
  - **403 "bot was kicked / not a member":** set status to `bot_removed` and store the error.
  - Network errors: formatted like KameHomes `formatTelegramNetworkError`.
- [ ] `format.ts`: `escapeHtml`, and money/date formatting through `formatCalendarCurrency` / `formatCurrency` and Manila date keys. It respects `include_amounts`. Unit tests included.
- [ ] `normalizeTelegramChatId`, copied from KameHomes. It handles the U+2212 minus sign.

### 6.2 Linking flow

- [ ] `POST /api/groups/[id]/telegram/link` (owner only):
  1. Create 32 random bytes as a base64url token; store the sha256 hash, expiring in 30 minutes.
  2. Return `https://t.me/<bot>?startgroup=<token>`.
  3. The UI opens the link and polls `GET …/telegram` every 3 seconds, up to 2 minutes.
- [ ] Webhook `POST /api/webhooks/telegram` (new `src/routes/api/webhooks/telegram/+server.ts`; `/api` is already outside `protectRoutes` in `hooks.server.ts`):
  - Verify `x-telegram-bot-api-secret-token` with a constant-time compare. Missing or wrong → 401.
  - `message` with text `/start[@bot] <token>` in a `group` or `supergroup`:
    1. Look up the hashed token; it must be unused and unexpired.
    2. Upsert settings (`chat_id`, `chat_title`, `chat_type`, `status = connected`, `linked_by`, `linked_at`) and mark the token used.
    3. If the chat is already linked to another group, refuse and reply with an explanation.
    4. Otherwise reply "✅ Connected to <group>".
  - `/start` in a private chat → reply with instructions.
  - `my_chat_member`, when the bot is removed or kicked → status `bot_removed`.
  - `message.migrate_to_chat_id` → update `chat_id`.
  - Optional commands: `/upcoming` (next 7 days for the linked group) and `/help`.
  - Always return 200 quickly so Telegram does not retry. Unknown updates are ignored.
- [ ] `scripts/telegram/set-webhook.ts` (+ package script `telegram:set-webhook`): calls `setWebhook` with `url=${PUBLIC_APP_URL}/api/webhooks/telegram`, `secret_token`, `allowed_updates: ["message","my_chat_member"]`, `drop_pending_updates`. Document it in `docs/architecture/deployment.md`.
- [ ] `DELETE /api/groups/[id]/telegram`: disconnect (clear the chat, status `disconnected`) and optionally call `leaveChat`.
- [ ] `PUT /api/groups/[id]/telegram`: update toggles, `reminder_days` (validated, 0–30, at most 5 values) and `include_amounts`.
- [ ] `POST /api/groups/[id]/telegram/test`: send a test message and return the result.

### 6.3 Notification content (`src/lib/server/telegram/group-notifications.ts` + pure `src/lib/group-notification-plan.ts`)

- [ ] **Where due items come from:** reuse `draftLoanGoogleEvents` (`src/lib/calendar-events.ts`) over the group's loans with scope `open`. Telegram reminders and calendar events then always agree (disbursement, due, interest due, amounts, investor lines). Overdue status comes from the logic in `api/loans/check-overdue/+server.ts`; move the shared pieces into `src/lib/calculations` if needed.
- [ ] `planGroupNotifications(loans, settings, todayKey)` is pure and unit-tested. It returns a list of `{fingerprint, kind, html}`:

  | Kind         | When                                                                   | Fingerprint                                |
  | ------------ | ---------------------------------------------------------------------- | ------------------------------------------ |
  | Upcoming     | D-N for N in `reminder_days`                                           | `upcoming:<kind>:<loanId>:<dateKey>:D-<n>` |
  | Due today    | D-0                                                                    | `due_today:<kind>:<loanId>:<dateKey>`      |
  | Overdue      | Past due and not completed, repeated every `overdue_repeat_every_days` | `overdue:<loanId or periodId>:<todayKey>`  |
  | Daily digest | One message: due today, overdue, next 7 days, net cash in/out          | `digest:<todayKey>`                        |

- [ ] **Activity events** (real time, via `group.telegram.activity` jobs), fingerprint `activity:<event>:<entityId>:<updatedAt>`:
  - loan added to group
  - loan created / updated (due date or amount changed)
  - disbursement recorded
  - payment received (`api/loans/[id]/received-payments`, `received-payments/[id]`)
  - interest period paid or extended (`interest-periods/[id]`, `extend-interest`)
  - loan completed (`loan-detail.ts` auto-complete and `loans/[id]/status`)
- [ ] **Sending guarantee** (`sendGroupNotification`):
  1. `INSERT group_notification_log (claimed) ON CONFLICT (group_id, fingerprint) DO NOTHING RETURNING id`. If no row comes back, skip; this prevents duplicates across concurrent cron runs or repeated jobs.
  2. Send the message.
  3. On success, set `sent` with the message ID; on failure, set `failed` with attempts. The next cron run retries `failed` rows under 3 attempts.
  4. Update `last_sent_at` and `last_error`.
- [ ] Every message ends with a deep link to `/groups/[id]` or `/loans/[id]`. The copy is in English and short, with emoji markers matching the calendar colors (🔴 disbursement, 🟢 due, 🔵 interest).

### 6.4 Settings UI (hub Settings tab → Telegram card)

- [ ] **Not configured** (no bot env vars) → owner-only hint.
- [ ] **Disconnected** → a "Connect Telegram group" button with 3 steps: open link → pick chat → wait for confirmation.
- [ ] **Connected** shows:
  - chat title and type, and when it was linked
  - Enabled switch
  - toggles for each notification type
  - reminder-day chips (e.g. 7 / 3 / 1)
  - include-amounts switch
  - "Send test", "Disconnect"
  - last sent and last error
  - a warning: "Anyone in this Telegram chat sees these messages. Keep the chat limited to group members."
- [ ] **Bot removed** → a reconnect call to action.
- [ ] Members see only: "Telegram: connected to <chat title>". No settings.

---

## Phase 7: Hardening, tests, rollout

- [ ] **Unit tests (Vitest; match existing `*.test.ts` next to sources):**
  - `loan-group-viewer-projection.test.ts` (no PII fields leak)
  - `group-notification-plan.test.ts` (D-N, due today, overdue repeat, digest, Manila day boundaries, fingerprints stay the same across runs)
  - membership diff logic (extract a pure `diffGroupMembers`)
  - ACL diff (`diffCalendarAcl`)
  - Telegram `format`, `normalizeTelegramChatId`, webhook update parsing
  - job backoff math
  - `google-calendar-config` split
  - `app-nav` `hasGroups` (admin always sees Groups; party user only with groups; dock order)
  - `group-colors` (palette resolution, `nextGroupColor`)
  - rule matching (`matchGroupRulesForLoan`, pure) and the access-preview diff, including the mixed-borrower flag
  - `use-loan-list-filters` group scope (group, ungrouped, clear-filters keeps the group)
- [ ] **Access tests:**
  - Borrower A in group G can open loan B (read-only, redacted).
  - The same borrower gets 403/404 from `/api/loans/B/payments`, `/api/loans/B/contract`, and receipt storage refs.
  - After loan A is removed from G, access is revoked.
- [ ] **E2E (Playwright, `e2e/`, using the `api/e2e/session` helper):**
  1. The owner creates a group and adds 2 loans.
  2. A party user sees the group and both loans, read-only.
  3. The owner removes a loan and the party loses access.
  4. The hub Settings tab renders the calendar and Telegram states (mock Google and Telegram at the module boundary).
  5. **Wizard:** start from an investor, the loans are preselected, the rule is checked, the access preview shows people, create lands on the hub with the checklist. A new loan for that investor then appears in the group.
  6. **Bulk:** select 3 rows on `/loans`, Add to group, the badges appear, and the Ungrouped chip count drops.
  7. **Role page lens:** on `/investments`, pick a group; only the user's investments show, and "See all N loans" opens the hub Loans tab.
  8. **Phone (390px):** chip bar scrolls, Select mode, bulk bar above the dock, wizard as a bottom sheet, hub tabs.
- [ ] **Refactor parity (4.2):** screenshot comparison for `/loans`, `/investments`, `/borrowed`, `/witnessed` (table, cards and calendar at 390px and 1440px) before and after the `LoanListPage` extraction.
- [ ] **UX review:** run the `impeccable` skill (audit and critique) on `/groups`, the hub, the wizard and the chip bar in light and dark themes before flipping the flag.
- [ ] **Observability:** log every job with prefixes `[jobs]`, `[group-calendar]`, `[telegram]`. Show the job backlog and failed count on the owner hub Settings tab.
- [ ] **Security review:** run the `/security-review` skill over the webhook, link tokens, the redaction projection and the cron auth.
- [ ] **Rollout order:**
  1. Migrate the QA Neon branch, then `bun run db:backfill:group-members`.
  2. Test the calendar and Telegram against a test calendar and a test bot.
  3. Set Vercel env: `TELEGRAM_*`, confirm the service-account vars and `CRON_SECRET`.
  4. Merge to `main` (CD runs migrate, then deploy).
  5. Run `telegram:set-webhook` against prod.
  6. Run the backfill on prod.
  7. Flip `SHOW_GROUPS_UI = true`.
  8. Create the first real group and verify the calendar share email and the Telegram link.
- [ ] **Docs:**
  - `docs/PROJECT.md` (auth and roles section on groups: new rules, env, crons, webhook)
  - `docs/guides/routes/groups.md` and `groups-detail.md` (rewrite)
  - `loans-detail.md` (group viewer mode and Groups row)
  - `loans.md`, `investments.md`, `borrowed.md`, `witnessed.md` (group bar, badges, bulk actions, shared `LoanListPage`)
  - `dashboard.md` (Groups card), `investors-detail.md` and `borrowers-detail.md` (Groups card, Group these loans)
  - `settings.md` (calendar button extraction)
  - the `google-calendar-integration` skill
  - `docs/workflow/qa/loan-groups-v2.md` (manual QA checklist)
  - move the workflow doc planned → in-progress → done

## Critical files

- **Changed:**
  - `src/lib/server/db/schema.ts`, `src/lib/server/group-access.ts`, `src/lib/server/access-control.ts`
  - `src/lib/loan-access.ts`, `src/lib/server/loan-detail.ts`, `src/lib/server/cached-data.ts`, `src/lib/server/cache-invalidation.ts`
  - `src/lib/server/google-calendar.ts`, `google-calendar-config.ts`
  - `src/routes/api/groups/**`, `src/routes/groups/**`
  - loan mutation routes under `src/routes/api/loans/**`, `api/investors|borrowers|witnesses/[id]`
  - `src/lib/nav/app-nav.ts`, `src/lib/feature-flags.ts`, `vercel.json`, `.env.example`
  - `src/routes/+layout.server.ts` (`groupsIndex`), `src/lib/types.ts` (`groupIds`)
  - `src/routes/{loans,investments,borrowed,witnessed}/+page.svelte` (become thin `LoanListPage` wrappers)
  - `LoanCard.svelte`, `LoansTable.svelte`, `LoanSummarySection.svelte` / `LoanDetailContent.svelte`, `LoanForm.svelte`, `ListPageToolbar.svelte` (phone Select mode)
  - `src/routes/investors/[id]/+page.svelte`, `src/routes/borrowers/[id]/+page.svelte` (Groups card)
  - `src/routes/dashboard/+page.svelte` (Groups card)
  - `src/lib/components/groups/GroupCard.svelte`, `GroupFormModal.svelte`
- **New:**
  - `db/migrations/0020_loan_groups_v2.sql`
  - `src/lib/server/jobs/{queue,runner,after-response}.ts`
  - `src/lib/server/group-calendar.ts`
  - `src/lib/server/telegram/{config,api,format,group-notifications}.ts`
  - `src/lib/loan-group-viewer-projection.ts`, `src/lib/group-notification-plan.ts`
  - `src/routes/api/cron/groups/+server.ts`, `src/routes/api/webhooks/telegram/+server.ts`
  - `src/routes/api/groups/[id]/{sync,calendar/sync,telegram,telegram/link,telegram/test}/+server.ts`
  - `scripts/db/backfill-group-members.ts`, `scripts/telegram/set-webhook.ts`
  - `src/routes/api/groups/access-preview/+server.ts`, `src/routes/api/groups/[id]/{access-preview,rules,rules/[ruleId]}/+server.ts`, `src/routes/api/loans/[id]/groups/+server.ts`
  - `src/lib/groups/group-colors.ts`, `src/lib/group-validation.ts`, `src/lib/group-rules.ts` (pure matcher)
  - `src/lib/components/loans/LoanListPage.svelte`, `LoanBulkActionBar.svelte`, `src/lib/composables/use-loan-list-filters.svelte.ts`
  - `src/lib/components/groups/{GroupBadge,GroupBadgeList,GroupChipBar,AccessPreview,GroupPickerSheet,GroupAvatarStack,CreateGroupWizard,GroupHubHeader,GroupPeopleTab,GroupSettingsTab}.svelte`
- **Removed:** `api/groups/[id]/leave`, `api/groups/[id]/members/[userId]`, `src/routes/groups/new/**` (redirects to `/groups?create=1`), `GroupMembersList.svelte` (replaced by `GroupPeopleTab`), the single-select `GroupLoanPicker.svelte` (replaced by the multi-select loan picker sheet).

## Reused (don't rebuild)

- `generateLoanCalendarEvents`, `generateDailySummaryEvents`, `getAffectedDatesFromLoan`, `withGoogleCalendarRetry` and mutation spacing (`google-calendar.ts` / `google-calendar-config.ts`)
- `draftLoanGoogleEvents`, `calendarEventKey`, `googleAllDayRange`, `formatCalendarCurrency` (`calendar-events.ts`)
- `planLoansForSync`, `planDailySummaryDateKeys`, `loansForCalendarSync`, `manilaTodayKey` (`calendar-sync-plan.ts`)
- `computeLoanAccessContext` (`loan-access-compute.ts`), `hasLoanAdminAccess`, `isWorkspaceAdmin`, `normalizeEmail`, `stripDataImageUrls`, `remember` / memory-cache invalidation
- `LoanCalendarView.svelte`, the `SyncCalendarButton.svelte` progress loop
- `LoansTable` row selection, `ListPageToolbar`, `MultiSelectFilter`, `LoanListSummaryCards`, `ResponsiveModal`, `ConfirmDeleteDialog`
- Dashboard pieces for the hub Overview: `PastDueLoansCard`, `MaturingLoansCard`, `LoanDueEventCard` / `LoanInterestDueEventCard` / `LoanSentEventCard`, `ActivityPanelCard`
- Existing URL-param filter pattern (`status`, `type`, `view` via `replaceState`) for `?group=` and `?tab=`
- `GroupFormModal` (edit form)
- The KameHomes Telegram helpers listed in Phase 6, adapted to TypeScript and Node

## Verification

1. `bun run check && bun run test && bun run lint && bun run build` (or `bun run ci:quality`) passes after each phase.
2. Migration: `bun run db:migrate:pending` on a local DB copied from prod (`db:local:sync-prod`), then `db:backfill:group-members`. Check with SQL that members equal the union of parties and that no group loans are owned by someone other than the creator.
3. Access, in the browser with two accounts (owner and a party user; E2E session helper locally):
   - The party sees `/groups/[id]` and a sibling loan read-only, with no contact, ID or receipt data.
   - Direct calls to the payment, contract and storage endpoints for that loan are denied.
   - After the loan is removed from the group, access is gone.
4. Calendar, against a test service account and QA branch:
   - Creating a group creates a calendar.
   - The party's Gmail receives a share invite, and the subscribe link adds the calendar.
   - Editing a loan's due date updates the event within one request cycle (`waitUntil`).
   - Removing a loan deletes its events and fixes the summaries.
   - Removing a party deletes their ACL rule.
   - Deleting the group deletes the calendar.
5. Telegram, with a test bot and test group:
   - The Connect link binds the chat and the bot replies.
   - "Send test" works.
   - Calling `/api/cron/groups` with the bearer secret sends the D-N, due-today, overdue and digest messages once. A second call sends nothing new (dedupe log).
   - Recording a payment sends an activity message.
   - Upgrading the group to a supergroup still works (chat ID migrated).
   - Kicking the bot shows "Bot removed" in the UI.
6. Cron auth: requests without `CRON_SECRET` get 401 in every environment.
7. UX walkthrough with `bun run dev`, as owner and as a party user, at 390px and 1440px:
   - Owner creates a group three ways: wizard, bulk selection, investor page.
   - Access preview matches the people list afterwards, and the mixed-borrower warning appears when expected.
   - Group chips narrow the summary, table, cards and calendar on all four loan pages.
   - Badges link correctly; the Ungrouped chip lists unfiled loans.
   - A party user sees Groups in the nav and dock only after joining a group.
   - The hub Overview shows needs-attention and next-30-days items that match the loan data.
   - Delete confirmation lists the real effects.
