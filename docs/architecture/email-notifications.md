---
title: Email notifications
status: active
tags: [architecture, email, notifications, cron, settings]
updated: 2026-11-21
---

# Email notifications

Part of [`docs/PROJECT.md`](../PROJECT.md). Workflow: [`docs/workflow/done/email-notifications.md`](../workflow/done/email-notifications.md).

## What ships

| Capability            | Behavior                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity email        | Loan created, updated, deleted, completed, added to or removed from a group, disbursement, payment received, payment removed, interest paid, interest extended, contract signed. |
| Signing request email | Every unsigned party with an email gets a contract-ready message on loan create.                                                                                                 |
| Daily reminder digest | One email per person per changed reminder. Combines unsigned contracts, upcoming due dates, due today, and overdue.                                                              |
| Preferences           | Settings card for master switch, categories, signing reminder delay and repeat, lead days, overdue repeat, and amount visibility.                                                |
| Delivery log          | `email_notification_log` claims every recipient and fingerprint before sending.                                                                                                  |
| Ops controls          | `EMAIL_NOTIFICATIONS_DISABLED` kill switch, `GET /api/email/status`, `POST /api/email/test`, cron dry run.                                                                       |

## Channels

Email is one of four notification channels:

| Channel         | Trigger                       | Recipient scope                              | Config                    |
| --------------- | ----------------------------- | -------------------------------------------- | ------------------------- |
| Email activity  | Loan and payment mutations    | Loan parties, group members for group events | `user_email_preferences`  |
| Email reminders | Daily cron                    | Parties per category                         | `user_email_preferences`  |
| Web Push        | Activity job and daily cron   | Users with subscriptions                     | `user_push_preferences`   |
| Telegram        | Group activity and daily cron | Group chat                                   | `group_telegram_settings` |

Email and push are independent. Turning off push does not turn off email and the reverse.

## Event catalog

| Event               | Trigger                                                                      | Recipients                                              | Preference                                              |
| ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| `loan_created`      | `POST /api/loans`, or a new or reset unsigned party by `PUT /api/loans/[id]` | Each unsigned party with an email                       | `notifySigningRequests`                                 |
| `loan_updated`      | `PUT /api/loans/[id]`                                                        | Loan parties except actor                               | `notifyActivity`                                        |
| `loan_deleted`      | `DELETE /api/loans/[id]`                                                     | Loan parties except actor                               | `notifyActivity`                                        |
| `loan_completed`    | Status changes to Completed                                                  | Loan parties except actor                               | `notifyActivity`                                        |
| `loan_added`        | Loan added to a group                                                        | Group creator, group members, loan parties except actor | `notifyActivity`                                        |
| `loan_removed`      | Loan removed from a group                                                    | Group creator, group members, loan parties except actor | `notifyActivity`                                        |
| `disbursement`      | Principal payment added                                                      | Loan parties except actor                               | `notifyActivity`                                        |
| `payment_received`  | Received payment added or edited                                             | Loan parties except actor                               | `notifyActivity`                                        |
| `payment_removed`   | Received payment deleted                                                     | Loan parties except actor                               | `notifyActivity`                                        |
| `interest_paid`     | Interest period payment or consolidation                                     | Loan parties except actor                               | `notifyActivity`                                        |
| `interest_extended` | Existing period due date moves later on loan save                            | Loan parties except actor                               | `notifyActivity`                                        |
| `contract_signed`   | Authenticated or token signature                                             | Loan parties except signer                              | `notifyActivity`                                        |
| Signing reminder    | Daily cron                                                                   | Unsigned party only                                     | `notifySigningReminders`                                |
| Due reminder        | Daily cron                                                                   | Owner, borrower, investors                              | `notifyDueReminders`, `notifyDueToday`, `notifyOverdue` |

Witnesses receive activity and signing emails. They are excluded from due and overdue digests because they are not financially involved.

## Email design

Every email uses the same branded shell and follows the same reading order:

1. **Summary card** with one eyebrow, one large value, and one short caption. This is the detail that matters most: amount, status, new due date, signature count, or group.
2. **Detail table** with at most three rows. Labels are tinted, values sit on white, and rows that would repeat the summary are left out.
3. **A short note** only when it changes what the reader should do (sign in with the right email, remaining signatures, balance may have changed).
4. **One primary button** and, when useful, one outlined secondary button. Group events get **View loan** plus **Open group**. Signing requests get **Review and sign** plus **View loan details**.
5. **A copyable fallback link** under the buttons.

Reminder digests add a **Today** summary card (`3 items` with `1 to sign · 1 due soon · 1 overdue`) and one section per reminder kind. Each item has an inline **Sign** or **View** link, so the reader can act without scrolling back to the main button.

Copy rules:

- Plain language, active voice, and a named actor when the app knows it (`Miguel Cruz recorded a payment from Ada Reyes.`).
- No em dashes, no marketing words, and no filler openers.
- Subjects say what happened: `Kame Lends: Alpha Loan was updated`, `Kame Lends: 1 contract to sign`.
- Amounts only appear when the recipient has `include_amounts` on. Hidden amounts become `Hidden` in the summary and disappear from reminder lines.
- The layout mirrors the Kame Homes summary-surface and tinted detail tables, with the Kame Lends orange accent.

## Recipient resolution

Loan recipients come from:

1. `loans.user` (owner).
2. `borrowers.borrower_user_id` when linked, otherwise `borrowers.email`.
3. `investors.investor_user_id` when linked, otherwise `investors.email`.
4. `witnesses.witness_user_id` when linked, otherwise `witnesses.email`.
5. `loan_signing_invitations.party_email` for any party not already covered.

Emails are normalized to lowercase. One person with multiple roles gets one email with combined role labels. Removed allocations (`loan_investors.deleted_at`) are ignored. The actor who performed the action is excluded by user id and by normalized email.

Group recipients come from `loan_groups.creator_user_id` plus `loan_group_members` joined to `user`. Group add and remove events merge group recipients with loan recipients.

## Preferences

`user_email_preferences`:

| Column                               | Default |
| ------------------------------------ | ------- |
| `email_enabled`                      | true    |
| `notify_activity`                    | true    |
| `notify_signing_requests`            | true    |
| `notify_signing_reminders`           | true    |
| `signing_reminder_first_after_days`  | 3       |
| `signing_reminder_repeat_every_days` | 3       |
| `notify_due_reminders`               | true    |
| `reminder_days`                      | `{3,1}` |
| `notify_due_today`                   | true    |
| `notify_overdue`                     | true    |
| `overdue_repeat_every_days`          | 3       |
| `include_amounts`                    | true    |

Bounds are enforced in `src/lib/schemas/email-preferences.ts` and in the migration:

- First reminder delay: 0 to 30 days.
- Repeat interval: 1 to 30 days.
- Lead days: 0 to 30, at most 5 entries, deduped and sorted newest first.
- Empty lead days normalize to `{3,1}`.

A party email with no `user` row has no preference row and receives defaults. That lets people who have not signed in yet get signing and activity mail.

## Reminder digest math

The cron plans one digest per recipient and sends it only when the digest fingerprint changes.

| Kind      | Fingerprint                                    | Cadence                                                                                                  |
| --------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Upcoming  | `due:upcoming:{loanId}:{dateKey}:d{n}`         | Once at each selected lead day                                                                           |
| Due today | `due:today:{loanId}:{dateKey}`                 | Once                                                                                                     |
| Overdue   | `due:overdue:{loanId}:{dateKey}:g{generation}` | `generation = 1 + floor((daysPast - 1) / repeat)`                                                        |
| Signing   | `signing:{invitationId}:g{generation}`         | `generation = 1 + floor((daysSinceCreated - firstAfter) / repeat)` when `daysSinceCreated >= firstAfter` |

The digest fingerprint is `digest:` plus the sorted item fingerprints. Same set means skip. A new lead day, a new signing generation, or a new overdue generation sends one new email.

Example with defaults:

- Day -3: one email with the loan.
- Day -2: same fingerprint, no email.
- Day 0: due-today fingerprint, one email.
- Day +1: overdue generation 1, one email.
- Day +2 and +3: same overdue fingerprint, no email.
- Day +4: overdue generation 2, one email.

## Delivery, dedupe, and retry

Immediate events use `integration_jobs`:

- `email.loan.activity` for loan-scoped events.
- `email.group.loanActivity` for group membership events.

The mutation route enqueues the job and the existing `scheduleDrain` call processes it after the response. This keeps the mutation fast and gives email the same backoff and retry behavior as calendar and Telegram jobs.

Every send goes through `sendNotificationEmail`:

1. Return skipped when Resend is missing or `EMAIL_NOTIFICATIONS_DISABLED` is true.
2. Claim `(recipient_email, fingerprint)` in `email_notification_log`.
3. Render and send with Resend.
4. Mark `sent` or `failed`.

A failed row can be reclaimed on the next attempt. A claimed row older than ten minutes is treated as a crashed worker and reclaimed. A sent row is never sent again for the same fingerprint.

If any recipient fails, the job throws so the runner retries with backoff. Successful recipients are already logged and are skipped on retry.

## Cron

`GET /api/cron/reminders` stays on the existing Vercel schedule, daily at `0 1 * * *` UTC (09:00 Manila).

The route runs push first, then email, then prunes old email logs. Each step is isolated in its own try/catch.

- `?dryRun=1` plans email digests without sending or pruning.
- `?today=YYYY-MM-DD` overrides the Manila business date for QA.
- `Authorization: Bearer CRON_SECRET` is required.

## API

| Route                                | Purpose                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `GET` / `PUT /api/email/preferences` | Read or update the signed-in user's preferences.                                     |
| `GET /api/email/status`              | `{ configured, disabled, enabled }`. No secrets.                                     |
| `POST /api/email/test`               | Send one test email to the signed-in user. 503 when Resend is missing. Rate-limited. |

## Environment

| Variable                       | Purpose                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`               | Resend key. Missing means every notification path skips.                                        |
| `RESEND_FROM_EMAIL`            | From address, for example `Kame Lends <noreply@yourdomain.com>`.                                |
| `EMAIL_NOTIFICATIONS_DISABLED` | `true` / `1` / `yes` stops notification email. Backup, health, and Neon usage crons still send. |

`PUBLIC_APP_URL` is used for links in every email.

## Failure behavior

| Case                        | Behavior                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| Resend missing              | Skip. No log rows. No mutation failure.                            |
| Kill switch on              | Skip notification email. Ops email still works.                    |
| Party has no email          | Skip.                                                              |
| Duplicate job or cron run   | Log claim skips the second send.                                   |
| Invalid recipient           | Mark failed, retry with backoff, other recipients still send.      |
| Loan deleted or completed   | Reminder loader skips it.                                          |
| Contract signed before send | Signing invitation is reloaded and signed slots are skipped.       |
| Server timezone             | Business date keys are read in `Asia/Manila` and formatted in UTC. |
| Large account               | Bulk loan load, recipients in chunks of 400, sequential sends.     |

## File map

| Concern          | Path                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| Preferences      | `src/lib/server/email/preferences.ts`                                    |
| Delivery log     | `src/lib/server/email/log.ts`                                            |
| Recipients       | `src/lib/server/email/recipients.ts`, `src/lib/email/recipient-merge.ts` |
| Templates        | `src/lib/server/email/notifications.ts`                                  |
| Activity fanout  | `src/lib/server/email/activity.ts`                                       |
| Reminder planner | `src/lib/email/reminder-plan.ts`                                         |
| Reminder runner  | `src/lib/server/email/reminders.ts`                                      |
| Kill switch      | `src/lib/server/email/index.ts`                                          |
| Settings card    | `src/lib/components/settings/EmailNotificationsCard.svelte`              |
| Migration        | `db/migrations/0045_email_notifications.sql`                             |

## Testing

- Unit: `notifications.test.ts`, `reminder-plan.test.ts`, `recipient-merge.test.ts`, `email-preferences.test.ts`, `interest-extensions.test.ts`.
- Integration: `email-log.integration.test.ts`, `preferences.integration.test.ts`, `reminders.integration.test.ts`.
- E2E: Settings email card in `e2e/advanced-controls.spec.ts`.
