---
title: "Email notifications for important actions"
status: done
tags: [email, notifications, cron, settings, loans, groups]
updated: 2026-11-21
stage: done
kind: plan
---

# Goal

Turn transactional email into a complete notification channel for Kame Lends. Today the app only emails signing parties when a loan is created, plus owner-only ops crons. This plan adds:

- Immediate emails for important loan, payment, group, and signing events, sent only to the people who should see them.
- A daily reminder email that combines unsigned contracts, upcoming due dates, due-today items, and overdue items. One digest per person, sent only when the reminder set changes.
- Per-user email preferences in Settings: master switch, category switches, reminder lead days, repeat cadence, and amount visibility.
- Dedupe, retry, and audit logging so repeated cron runs, job retries, or double-submits cannot spam users.
- Unit, integration, and E2E coverage, plus documentation.

# Scope

## In

- Loan lifecycle: created, updated, deleted, completed, status changed, interest period extended.
- Money actions: disbursement recorded, received payment recorded, interest payment recorded, payment edited, payment deleted.
- Group actions: loan added to group, loan removed from group.
- Contract actions: contract ready to sign, contract signed.
- Daily reminder digest: unsigned contracts (after a configurable delay), upcoming due dates at configurable lead days, due today, overdue at a configurable repeat interval.
- Per-user email preferences, email delivery log, test email endpoint, dry-run cron mode.
- Email content for every event, using the existing branded shell.

## Out

- In-app notification center or read/unread state (email only in this plan).
- Bank loan (debt) emails. Debts are personal to the owner, so an email would go back to the person who just acted. Revisit if debt parties are added.
- Transaction ledger emails (feature is hidden by `SHOW_TRANSACTIONS_UI`).
- CRM contact edits (admin data entry, not a party action).
- Marketing, digests of completed history, unsubscribe links, or a full ESP preference center.
- Per-group email settings. Email preferences are per person. Group Telegram settings stay unchanged.

# Decisions

| Decision                 | Choice                                                                                       | Why                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Preference location      | New `user_email_preferences` table                                                           | Email and push are independent channels. Reusing `user_push_preferences` would force one cadence on both.                            |
| Delivery log             | New `email_notification_log` table keyed by `(recipient_email, fingerprint)`                 | Works for registered users and party emails that do not have an account yet. Prevents duplicate sends on retries and repeated crons. |
| Immediate fanout         | Reuse `integration_jobs` with new `email.loan.activity` and `email.group.loanActivity` kinds | Already retried, already drained after responses, already used by push and Telegram.                                                 |
| Reminder cron            | Extend `GET /api/cron/reminders`                                                             | It already runs daily at 01:00 UTC (09:00 Manila). Vercel Hobby cannot run more than once a day. No new cron slot needed.            |
| Reminder shape           | One combined digest per person                                                               | Avoids five separate emails on a busy day. Still supports the user's D-3 / D-1 ask.                                                  |
| Reminder cadence         | Send only when a reminder fingerprint changes                                                | A D-3 item sends once. An overdue item repeats every N days, not every day unless configured to 1.                                   |
| Signing reminder default | First after 3 days, repeat every 3 days                                                      | "After a few days" without daily spam. Configurable.                                                                                 |
| Due reminder default     | 3 days and 1 day before, due today, overdue every 3 days                                     | Matches the existing push defaults and the user's ask.                                                                               |
| Actor exclusion          | Never email the person who performed the action                                              | A loan owner who edits a loan should not receive their own activity email.                                                           |
| Non-registered parties   | Receive activity, signing, and due emails from their party email                             | They are real parties even before they sign in. Defaults apply because they have no preference row.                                  |
| Witness scope            | Activity and signing emails only                                                             | Witnesses are not financially involved; exclude them from due and overdue digests.                                                   |
| Kill switch              | `EMAIL_NOTIFICATIONS_DISABLED=true`                                                          | Ops can stop notification email without disabling backup and health crons.                                                           |
| Missing Resend config    | No-op, never an error                                                                        | Local dev and preview builds must keep working without secrets.                                                                      |

# Event catalog

| Event type          | Trigger                                                       | Recipients                                                             | Preference flag          | Email subject                                            |
| ------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| `loan_created`      | `POST /api/loans`, or a new or reset unsigned party on update | Each unsigned party                                                    | `notifySigningRequests`  | `Kame Lends: Contract ready to sign for {loan}`          |
| `loan_updated`      | `PUT /api/loans/[id]`                                         | Loan parties except actor                                              | `notifyActivity`         | `Kame Lends: Loan updated - {loan}`                      |
| `loan_deleted`      | `DELETE /api/loans/[id]`                                      | Loan parties except actor                                              | `notifyActivity`         | `Kame Lends: Loan deleted - {loan}`                      |
| `loan_completed`    | Status change to Completed                                    | Loan parties except actor                                              | `notifyActivity`         | `Kame Lends: Loan completed - {loan}`                    |
| `loan_added`        | Loan added to a group                                         | Group members, group creator, loan parties except actor                | `notifyActivity`         | `Kame Lends: {loan} added to {group}`                    |
| `loan_removed`      | Loan removed from a group                                     | Group members before removal, group creator, loan parties except actor | `notifyActivity`         | `Kame Lends: {loan} removed from {group}`                |
| `disbursement`      | Principal payment recorded                                    | Loan parties except actor                                              | `notifyActivity`         | `Kame Lends: Disbursement recorded for {loan}`           |
| `payment_received`  | Received payment recorded or edited                           | Loan parties except actor                                              | `notifyActivity`         | `Kame Lends: Payment received for {loan}`                |
| `payment_removed`   | Received payment deleted                                      | Loan parties except actor                                              | `notifyActivity`         | `Kame Lends: Payment removed for {loan}`                 |
| `interest_paid`     | Interest period payment recorded or consolidated              | Loan parties except actor                                              | `notifyActivity`         | `Kame Lends: Interest payment recorded for {loan}`       |
| `interest_extended` | A period due date moves later on loan save                    | Loan parties except actor                                              | `notifyActivity`         | `Kame Lends: Interest due date extended for {loan}`      |
| `contract_signed`   | Authenticated or token signing completes                      | Loan parties except signer                                             | `notifyActivity`         | `Kame Lends: {party} signed {loan}`                      |
| `signing_reminder`  | Daily cron, unsigned contract older than first delay          | Unsigned party only                                                    | `notifySigningReminders` | `Kame Lends: {n} contract(s) waiting for your signature` |
| `due_reminder`      | Daily cron, D-3 / D-1 etc.                                    | Owner, borrower, investors                                             | `notifyDueReminders`     | `Kame Lends: {n} loan reminder(s)`                       |
| `due_today`         | Daily cron, due date is today                                 | Owner, borrower, investors                                             | `notifyDueToday`         | `Kame Lends: {n} loan reminder(s)`                       |
| `overdue`           | Daily cron, repeat every N days                               | Owner, borrower, investors                                             | `notifyOverdue`          | `Kame Lends: {n} loan reminder(s)`                       |

Subject text is finalized in the template module. No em dashes. Keep labels short.

# Reminder digest

`runEmailReminderDigests` runs daily and builds one digest per person:

1. Load all open, non-deleted loans with borrower, allocations, periods, and witnesses.
2. Plan due and overdue items with the shared schedule (`draftLoanGoogleEvents` / `buildLoanPaymentSchedule`), using Asia/Manila date keys.
3. Load unsigned, non-expired signing invitations for open loans.
4. Resolve recipients per item. Exclude witnesses from due/overdue. Keep witnesses for signing.
5. Group items by recipient email.
6. Compute a stable digest fingerprint from sorted item fingerprints.
7. Claim `(recipient_email, digest fingerprint)`. Skip if already sent.
8. Render one branded email and send.
9. Record sent or failed in `email_notification_log`.

Item fingerprints:

- Upcoming: `due:upcoming:{loanId}:{dateKey}:d{n}`
- Due today: `due:today:{loanId}:{dateKey}`
- Overdue: `due:overdue:{loanId}:{dateKey}:g{generation}`
- Signing: `signing:{invitationId}:g{generation}`

Generations:

- Signing: `1 + floor((daysSinceCreated - firstAfterDays) / repeatEveryDays)`, only when `daysSinceCreated >= firstAfterDays`.
- Overdue: `1 + floor((daysPastDue - 1) / repeatEveryDays)`.
- Due and due-today items use one constant fingerprint.

Example: a user with one D-3 loan gets one email on day -3. The next day the fingerprint is unchanged, so no email. On day 0 the due-today fingerprint appears and one email is sent. An overdue loan repeats every 3 days by default.

# Preferences

`user_email_preferences`:

| Column                               | Type        | Default | UI                          |
| ------------------------------------ | ----------- | ------- | --------------------------- |
| `user_id`                            | text PK     |         |                             |
| `email_enabled`                      | boolean     | true    | Master switch               |
| `notify_activity`                    | boolean     | true    | Loan and payment activity   |
| `notify_signing_requests`            | boolean     | true    | Contract ready emails       |
| `notify_signing_reminders`           | boolean     | true    | Unsigned contract reminders |
| `signing_reminder_first_after_days`  | integer     | 3       | First reminder after N days |
| `signing_reminder_repeat_every_days` | integer     | 3       | Repeat every N days         |
| `notify_due_reminders`               | boolean     | true    | Upcoming due dates          |
| `reminder_days`                      | integer[]   | `{3,1}` | Checkboxes 1, 3, 5, 7, 14   |
| `notify_due_today`                   | boolean     | true    | Due today                   |
| `notify_overdue`                     | boolean     | true    | Overdue                     |
| `overdue_repeat_every_days`          | integer     | 3       | Repeat every N days         |
| `include_amounts`                    | boolean     | true    | Show amounts                |
| `created_at` / `updated_at`          | timestamptz | now()   |                             |

Bounds enforced in Zod and DB checks: reminder days 0-30, repeat 1-30, at most 5 lead days, no duplicates. Empty lead-day list normalizes to `{3,1}`.

# Architecture

```
mutation route
  -> enqueueGroupLoanChanged / direct group job
      -> integration_jobs (email.loan.activity | email.group.loanActivity)
          -> job handler
              -> load loan / group / recipients
              -> resolve email preferences
              -> claim email_notification_log
              -> render branded email
              -> Resend

cron /api/cron/reminders
  -> push reminders (existing)
  -> runEmailReminderDigests
      -> plan due/overdue/signing items
      -> group by recipient
      -> claim digest fingerprint
      -> render + send + log
```

New modules:

| Module                                  | Responsibility                                                          |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `src/lib/server/email/preferences.ts`   | Read, batch read, update, and default email preferences.                |
| `src/lib/server/email/log.ts`           | Claim, mark sent, mark failed, prune email log rows.                    |
| `src/lib/server/email/recipients.ts`    | Loan and group recipient loading, role labels, dedupe, actor exclusion. |
| `src/lib/server/email/notifications.ts` | Event payload types, subject/body builders, template registry.          |
| `src/lib/server/email/activity.ts`      | Immediate event fanout for loans and groups.                            |
| `src/lib/server/email/reminders.ts`     | Daily digest planner and sender.                                        |
| `src/lib/server/email/index.ts`         | Public server entry point, kill switch, config checks.                  |
| `src/lib/schemas/email-preferences.ts`  | Shared Zod schema for the settings API.                                 |
| `src/lib/email/reminder-plan.ts`        | Pure reminder planning and fingerprint functions.                       |

# Implementation tasks

## P1 - Data model and preferences

- [x] `db/migrations/0045_email_notifications.sql`
  - Create `user_email_preferences` with defaults, PK, and bounds checks.
  - Create `email_notification_log` with FK to `user`, unique `(recipient_email, fingerprint)`, status enum reuse, and `(status, created_at)` index.
  - Create an index on `email_notification_log(recipient_email)` for digest lookups.
- [x] `src/lib/server/db/schema.ts`
  - Add `userEmailPreferences` and `emailNotificationLog` tables.
- [x] `src/lib/schemas/email-preferences.ts`
  - Zod patch schema and normalization helpers.
- [x] `src/lib/server/email/preferences.ts`
  - `getUserEmailPreferences`, `getEmailPreferencesByUserIds`, `updateUserEmailPreferences`, `resolveEmailPreferences`.
  - Lazy insert on read, like push preferences.
- [x] `src/lib/server/email/log.ts`
  - `claimEmailDelivery`, `markEmailSent`, `markEmailFailed`, `pruneEmailLog`.
  - Stale `claimed` rows older than 10 minutes are reclaimable.
  - Failed rows are retryable.
- [x] `src/routes/api/email/preferences/+server.ts`
  - `GET` and `PUT` for the signed-in user.
- [x] `src/routes/api/email/status/+server.ts`
  - `{ configured, disabled }`, no secrets.
- [x] `src/routes/api/email/test/+server.ts`
  - Send one test email to the signed-in user. 503 when Resend is missing.
- [x] `src/lib/server/rate-limit.ts`
  - Add `/api/email/test` to `HIGH_COST_PREFIXES`.

## P2 - Email core and templates

- [x] `src/lib/server/email/index.ts`
  - `isEmailNotificationsEnabled()`: Resend present and `EMAIL_NOTIFICATIONS_DISABLED` is not true.
- [x] `src/lib/server/email/notifications.ts`
  - Event payload types for every event in the catalog.
  - Shared meta-table, greeting, and CTA helpers.
  - Subject and body builders for each event.
  - `renderEventEmail(event, recipient)`.
  - `renderReminderDigest(recipient, sections)`.
  - Amounts hidden when `includeAmounts` is false.
  - All user text escaped.
  - Business date formatting uses Asia/Manila keys and UTC formatting, never server local time.
- [x] Refactor `src/lib/server/email/loan-created-email.ts`
  - Keep push fanout.
  - Respect `notifySigningRequests` and `emailEnabled`.
  - Claim `email_notification_log` per recipient and invitation set.
  - Preserve grouped roles for one recipient.
- [x] Extend `src/lib/server/email/email.test.ts` and add `notifications.test.ts`.
  - Subject/body for every event.
  - Escaping, amount hiding, role labels, CTA URLs, empty values.

## P3 - Immediate event fanout

- [x] `src/lib/server/email/recipients.ts`
  - `loadLoanEmailRecipients(loanId, roles)` with linked user email fallback to party email.
  - `loadGroupEmailRecipients(groupId)` including creator and `loan_group_members`.
  - `mergeEmailRecipients`, `excludeActor`, `recipientHasPreference`.
  - Role filters: activity all roles, due owner/borrower/investor only.
- [x] `src/lib/server/email/activity.ts`
  - `sendLoanActivityEmails({ loanId, event, actorUserId })`.
  - `sendGroupActivityEmails({ groupId, loanId, event, actorUserId })`.
  - Never throw when Resend is missing. Throw on delivery failures so the job retries.
- [x] `src/lib/server/jobs/queue.ts`
  - Add `actorUserId` to `ActivityEvent`.
  - Always enqueue `email.loan.activity` when an activity event is present, even when the loan has no groups.
  - Add `email.group.loanActivity` helper for group membership changes.
- [x] `src/lib/server/jobs/handlers.ts`
  - Register `email.loan.activity` and `email.group.loanActivity`.
- [x] Mutation routes
  - `POST /api/loans`: pass `actorUserId` to `enqueueGroupLoanChanged`.
  - `PUT /api/loans/[id]`: pass `actorUserId`; detect interest date extensions and enqueue `interest_extended`.
  - `DELETE /api/loans/[id]`: enqueue `loan_deleted` before the soft delete.
  - `PATCH /api/loans/[id]/status`: pass `actorUserId`.
  - `POST /api/loans/[id]/payments`: pass `actorUserId`.
  - `POST /api/loans/[id]/received-payments`: pass `actorUserId`.
  - `PATCH` / `DELETE /api/received-payments/[id]`: enqueue `payment_received` / `payment_removed`.
  - `PATCH /api/interest-periods/[id]`: enqueue `interest_paid` when a payment row is written.
  - `POST /api/interest-periods/[id]/consolidate-payment`: enqueue `interest_paid`.
  - `PUT /api/loans/[id]/groups`: enqueue `loan_added` / `loan_removed` per changed group.
  - `POST` / `DELETE /api/groups/[id]/loans`: enqueue group activity for each loan.
  - `POST /api/loans/[id]/sign` and `POST /api/sign/[token]`: pass the signer's user id (or invitation email) as the actor.
- [x] `src/lib/server/telegram/enqueue-contract-signed.ts`
  - Accept and forward `actorUserId` and `actorEmail`.

## P4 - Reminder digests

- [x] `src/lib/email/reminder-plan.ts`
  - Pure planning functions for upcoming, due today, overdue, and signing reminders.
  - Fingerprint and generation helpers.
  - Category switches and amount visibility.
- [x] `src/lib/server/email/reminders.ts`
  - Load open loans in bulk, not per user.
  - Load unsigned invitations with loan context.
  - Resolve recipients, group by email, skip disabled categories.
  - One digest per recipient per changed fingerprint.
  - `dryRun` returns planned counts and no writes.
  - Structured logs with counts, not bodies.
- [x] `src/routes/api/cron/reminders/+server.ts`
  - Keep push run.
  - Run email digests after push, isolated in its own try/catch.
  - Accept `?dryRun=1` and `?today=YYYY-MM-DD`.
  - Prune old email logs (180 days).
- [x] `vercel.json`
  - No schedule change needed. Confirm `0 1 * * *` remains.

## P5 - Settings UI

- [x] `src/lib/components/settings/EmailNotificationsCard.svelte`
  - Master switch.
  - Activity, signing request, signing reminder, due reminder, due today, overdue toggles.
  - First reminder after days and repeat every days.
  - Lead-day checkboxes (1, 3, 5, 7, 14).
  - Overdue repeat days.
  - Include amounts.
  - Save and Send test.
  - Read-only notice when Resend is not configured.
- [x] `src/routes/settings/+page.server.ts`
  - Load `emailPreferences` and `emailConfigured`.
- [x] `src/routes/settings/+page.svelte`
  - Render the card beside or after the push card.
- [x] `src/lib/server/email/preferences.ts` and API return the full object after save.

## P6 - Tests

- [x] Unit: `src/lib/server/email/notifications.test.ts`
  - Every subject and body, HTML escaping, amount hiding, role labels, missing optional fields.
- [x] Unit: `src/lib/server/email/reminder-plan.test.ts`
  - D-3 and D-1, due today, overdue repeat cadence, no duplicate fingerprint, signing delay and repeat generations, disabled categories, witness exclusion.
- [x] Unit: `src/lib/email/recipient-merge.test.ts`
  - Merge and dedupe, linked-user email fallback, actor exclusion by id and email, role filters.
- [x] Unit: `src/lib/schemas/email-preferences.test.ts`
  - Bounds, dedupe, sorting, empty lead days normalize.
- [x] Unit: `src/lib/loans/interest-extensions.test.ts`
  - Detects a later period date and ignores earlier dates, new periods, and removals.
- [x] Integration: `src/lib/server/email/email-log.integration.test.ts`
  - Claim twice, reclaim failed, stale claim recovery, prune.
- [x] Integration: `src/lib/server/email/preferences.integration.test.ts`
  - Default row creation, update, batch resolution.
- [x] Integration: `src/lib/server/email/reminders.integration.test.ts`
  - Dry-run plans due and signing reminders against local Postgres.
- [x] Update `src/lib/server/email/loan-created-email.push.test.ts`
  - New preference and log behavior.
- [x] E2E: extend `e2e/advanced-controls.spec.ts` or `e2e/authenticated-routes.spec.ts`
  - Settings email card renders, toggles persist through `PUT /api/email/preferences`, test button reports missing config gracefully.
- [x] Run `bun run check`, `bun run test`, `bun run test:integration` when local Postgres is available, `bun run format:check`, `bun run lint:js`, `bun run build`.

## P7 - Docs and release

- [x] `docs/architecture/email-notifications.md`
  - Event catalog, preferences, reminder math, dedupe, retry, kill switch, env vars, cron, failure behavior.
- [x] `docs/PROJECT.md`
  - Expand the transactional email section.
  - Document new API routes, tables, cron behavior, and env vars.
- [x] `docs/guides/routes/settings.md`
  - Email notifications card behavior.
- [x] `.env.example`
  - `EMAIL_NOTIFICATIONS_DISABLED` and updated Resend comments.
- [x] `docs/workflow/intake/_to-plan.md` and `docs/workflow/planned/README.md`
  - Keep the workflow index in sync.
- [x] Move the plan to `docs/workflow/in-progress/` when implementation starts.

# Content and design pass (2026-11-21)

- Installed the `humanizer` skill at `.agent/skills/humanizer` and linked it for Cursor and Claude Code.
- Reviewed every subject line, heading, intro, note, label, and button against the `humanizer` skill. Removed passive phrasing, repeated facts, and filler.
- Rebuilt the body layout around a Kame Homes-style summary card, a tinted three-row detail table, one primary button, and one outlined secondary button where it helps.
- Added inline **Sign** and **View** links to every reminder item, plus a **Today** summary card.
- Trimmed detail tables so they do not repeat the summary card (for example, payment emails show amount and date in the summary, and only loan and borrower in the table).
- Reviewed rendered screenshots for signing request, payment received, contract signed, loan updated, and reminder digest at 760 px width.
- Kept the branded shell, logo, accent bar, and legal footer unchanged.

# Verification (2026-11-21)

| Check                                                                              | Result                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `bun run check`                                                                    | 0 errors, 101 pre-existing warnings                       |
| `bun run test`                                                                     | 127 files, 692 passed, 4 skipped                          |
| `bun run test:integration` (local Postgres on 5434)                                | 10 files, 80 passed                                       |
| `bun run build`                                                                    | Passed, PDF font copy and health migration copy succeeded |
| `bun run format:check`                                                             | Passed                                                    |
| `bun run lint:js`                                                                  | 0 errors, warnings only                                   |
| `bun run check:ai-gateway`                                                         | OK                                                        |
| `bun run check:ai-tooling-sync`                                                    | OK                                                        |
| `bun run check:workflow-scratchpads`                                               | OK                                                        |
| Targeted E2E `advanced-controls -g "settings email notification preferences save"` | Passed                                                    |
| Migration `0045_email_notifications.sql` applied to local test Postgres            | Passed                                                    |

Live inbox delivery needs `RESEND_API_KEY` plus `RESEND_FROM_EMAIL`. `POST /api/email/test` sends one message to the signed-in user when those are set. The no-key path is covered by unit and integration tests.

# Edge cases and safeguards

| Case                                         | Behavior                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Resend not configured                        | Every notification path returns skipped. No log rows. No mutation failure.                                                |
| Kill switch on                               | Notification emails skip. Backup and health crons still work.                                                             |
| Party has no email                           | Skipped. No error.                                                                                                        |
| Same person has multiple roles               | One email with combined role labels.                                                                                      |
| Actor is also listed under a party email     | Excluded by user id and by normalized email.                                                                              |
| Duplicate job or retry                       | `email_notification_log` claim prevents a second send. Failed rows can retry.                                             |
| Two cron runs in one day                     | Digest fingerprint is unchanged, so the second run skips.                                                                 |
| Loan deleted after a reminder is planned     | Reminder loader reads live rows and skips deleted or completed loans.                                                     |
| Contract signed between planning and sending | Signing invitation is reloaded before send; signed slots are skipped.                                                     |
| Amount privacy                               | `includeAmounts = false` hides all peso amounts and rates. Dates, names, and counts remain.                               |
| Server timezone                              | All business dates use `Asia/Manila` date keys and UTC formatting.                                                        |
| Large account                                | Bulk loan load and sequential sends with a small concurrency cap. Cron returns counts and stays under 60s.                |
| Broken email address                         | Send failure is logged with status `failed`. Job retries with backoff, then stops. Other recipients still receive theirs. |
| Unsubscribe                                  | Registered users can turn categories off in Settings. Party-only emails are transactional and tied to a loan they are on. |
| PII in logs                                  | Logs contain ids, counts, and email addresses, never full bodies or attachment contents.                                  |

# Docs to update

- `docs/architecture/email-notifications.md` (new)
- `docs/PROJECT.md`
- `docs/guides/routes/settings.md`
- `.env.example`
- `docs/workflow/intake/_to-plan.md`
- `docs/workflow/planned/README.md`
- `docs/architecture/pwa.md` only if push fanout text becomes inaccurate

# Open questions

None. Decisions above are final for this pass.
