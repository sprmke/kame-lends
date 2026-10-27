---
title: "Telegram message templates"
status: planned
tags: [telegram, groups, notifications]
updated: 2026-10-27
stage: for-testing
kind: plan
---

# Telegram message templates

**Goal:** Group Telegram messages should read as a short loan summary: who the loan is for, who funded it, what is due, how much, and a link back to the app. Each action the app already performs gets its own editable template. Owners start from that default and can insert any placeholder that applies to that template.

**Status:** For testing. Implementation is in the app. Manual check is the last section of this plan.

## Scope

### In

- Default copy and placeholder catalogs for every group Telegram template.
- Filling those placeholders on every send path (daily reminders, digest, unsigned contracts, `/upcoming`, activity jobs, test message).
- One activity template per action that already changes a group loan, plus the three actions that happen today and send nothing useful: loan created, loan removed from the group, contract signed.
- Settings UI so a long template list stays usable on a phone.
- Groups that saved the old one-line default pick up the new default. Groups that edited the text keep their text. Existing placeholder names keep working.

### Out

- Web Push and email copy. `event.summary` may become a clearer one-line sentence, because push already prints it. Do not add HTML or a template editor for push.
- Debts, bank-loan payments, receipts, calendar event text, and PDF.
- Direct messages to a person. Messages stay in the linked group chat.
- Reminder timing, cron schedules, bot connect, and the Show amounts toggle behavior (on or off). Only the words used when amounts are off change.
- Contact details in the chat: phone, email, address, valid ID, signature image, bank account, QR, receipt image, private commission.

## Current gap

Templates live in `src/lib/groups/group-telegram-templates.ts`. Stored overrides are `group_telegram_settings.templates` (jsonb). The editor is `TelegramTemplateEditor.svelte` inside `GroupTelegramSettingsCard.svelte`. Test is a template but hidden from the tabs.

| Kind                               | Default today                                      | What the chat actually receives                                                                                                                            |
| ---------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upcoming`, `due_today`, `overdue` | Heading, loan name, event type, date, amount, link | One line. No borrower, investors, status, loan type, principal vs interest, or how many days.                                                              |
| `unsigned`                         | "Signatures still needed" plus `pending_body`      | Loan name and waiting names. No type, due date, or amount.                                                                                                 |
| `digest`                           | Title, one `digest_body` blob, group link          | Sections cannot be reordered. No counts or group name.                                                                                                     |
| `activity`                         | "Activity" plus `summary`                          | Often one vague line. Loan update stores the loan name as `summary`, so the message is the name and nothing else (`src/routes/api/loans/[id]/+server.ts`). |
| `test`                             | "Test" plus group link                             | No group name.                                                                                                                                             |
| `/upcoming`                        | Not a template                                     | `planUpcomingWeekHtml` in `src/lib/group-notification-plan.ts` builds its own HTML.                                                                        |

Placeholder values for reminders are only `heading`, `loan_name`, `event_type`, `date`, `amount`, `loan_link` (`buildSingleReminderHtml`). The loan query in `loadGroupLoansForNotifications` does not load the borrower or witnesses.

Activity types the code already knows, and what it sends:

| Action                  | Enqueued today                                                                     | Template                                                          |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Loan added to a group   | `loan_added` from `POST /api/groups` and `POST /api/groups/[id]/loans`             | Generic activity. Summary fallback "Loan added to group".         |
| Loan updated            | `loan_updated`, summary = loan name                                                | Generic activity.                                                 |
| Disbursement            | `disbursement` from `POST /api/loans/[id]/payments`                                | Generic activity. Amount and lender are not passed.               |
| Payment received        | `payment_received` from `POST /api/loans/[id]/received-payments`                   | Generic activity. Amount, date, and lender are not passed.        |
| Interest extended       | `interest_extended`                                                                | Generic activity. New due date is not passed.                     |
| Loan completed          | `loan_completed`, summary = loan name                                              | Generic activity.                                                 |
| Loan created            | Calendar sync only (`POST /api/loans`, `enqueueGroupLoanChanged` with no activity) | Nothing.                                                          |
| Loan removed from group | `DELETE /api/groups/[id]/loans` syncs the calendar only                            | Nothing.                                                          |
| Contract signed         | `POST /api/sign/[token]`                                                           | Nothing. `interest_paid` is in the summary map and has no caller. |

`{{key}}` replacement is exact and case-insensitive. Unknown keys stay in the text. There is no way to hide a line when a value is empty (witnesses, lot size, notes).

Show amounts off currently substitutes an em dash for money (`formatTelegramMoney`). New copy uses the word `Hidden`.

## Approach

### One loan context, many templates

Add `buildTelegramLoanContext` in `src/lib/groups/telegram-message-context.ts`. It takes a loan loaded with borrower, investors, interest periods, and witnesses, plus the group name, app URL, Show amounts flag, and an optional calendar draft (`LoanGoogleEventDraft` already has per-investor amounts, `totalAmount`, `totalPrincipal`, `totalInterest`).

It returns a `Record<string, string>` of escaped text and a few prebuilt HTML fragments (links and bullet lists). `applyTelegramTemplate` only substitutes. It does not escape again.

Activity jobs pass a small `detail` object for facts that are not on the loan after the write (this payment's amount, who signed). The sender loads the loan at send time and merges `detail`. Do not put the HTML body in the job payload or in `summary`.

### Template language

Keep `{{snake_case}}`. Add one conditional, not a nested language:

```text
{{#if witnesses}}Witnesses: {{witnesses}}
{{/if}}
```

- The condition is one placeholder key. No `and` / `or` / comparisons.
- Hide the block when the value is missing, blank, or only whitespace.
- Remove the block's own trailing newline so a hidden section does not leave a hole.
- `{{#if}}` cannot nest.
- An unknown `{{key}}` stays visible so a typo is obvious. `{{#if unknown_key}}` hides the block.
- Allowed HTML in a saved template: `b`, `i`, `u`, `s`, `a`, `code`, `pre`, `br`. Reject anything else on save (400). Values from the loan are escaped before they are inserted. Link and list keys are built already escaped.

Cap each saved template at 4,000 characters. Cap rendered investor, witness, and rate lists at 12 lines, then `And N more.` Unsigned and digest already cap length (`MAX_HTML_LENGTH` 3500, 12 loans). Keep those caps. Single-loan messages should stay under Telegram's 4,096 limit. `chunkHtml` remains the fallback.

### Show amounts

When `includeAmounts` is false, money placeholders are the word `Hidden`. Investor lines are names only. A fixed-peso rate is `Hidden`. A percent rate stays visible (it is not an amount). Names, dates, status, and type always show.

### Old defaults and old tokens

Copy today's seven default strings into `PREVIOUS_GROUP_TELEGRAM_TEMPLATES`. `resolveGroupTelegramTemplate` and `mergeGroupTelegramTemplates` treat a stored value that equals that old string (trimmed) as empty, so the new default is used. Any other stored string is kept.

These keys stay filled so an old custom template does not go blank:

| Old key                                                                  | New meaning                                               |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| `date`                                                                   | Same as `event_date`                                      |
| `amount`                                                                 | Event total, or `Hidden`                                  |
| `summary`                                                                | One-line action sentence                                  |
| `digest_body`                                                            | All digest sections joined, including the empty-week line |
| `pending_body`                                                           | Unsigned loan blocks                                      |
| `heading`, `loan_name`, `event_type`, `loan_link`, `group_link`, `today` | Unchanged role                                            |

No SQL migration. The column is already jsonb.

### What we will not put in a placeholder

Phone, email, address, ID image, signature, bank account, QR, receipt, notes that are only a contact dump, and the viewer's private commission. `notes` is available as an optional placeholder (escaped, 240 characters) and is not in any default. `lot_size` is set only for Lot Title loans (`freeLotSqm`), and is not in any default. Owners insert those when they want them.

Empty people:

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| No borrower  | `No borrower`                                |
| No investors | `None`                                       |
| No witnesses | empty, so `{{#if witnesses}}` hides the line |

### Tabs

Sixteen kinds will not fit one phone tab row. Replace the single scroller with two rows, both `min-h-11`, no dropdown:

1. Category: Reminders, Digests, Activity, Other.
2. Template name for that category only.

`test` moves into Other so it can be edited. It stays out of the send path except **Send test**.

## Placeholder catalog

Keys marked HTML are inserted as markup. Every other key is plain text.

### Shared loan keys

Available on every template that is about one loan (all reminders and all activity kinds) and, where noted, on digests.

| Key              | HTML | Meaning                                                                                                        |
| ---------------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| `group_name`     | no   | Group name                                                                                                     |
| `group_link`     | yes  | `Open group` link to `/groups/{id}`                                                                            |
| `loan_name`      | no   | Loan name                                                                                                      |
| `loan_type`      | no   | Lot Title, OR/CR, or Agent                                                                                     |
| `status`         | no   | Partially Funded, Fully Funded, Overdue, Completed                                                             |
| `borrower`       | no   | Borrower name, or `No borrower`                                                                                |
| `investors`      | yes  | One line per lender: `• Ana Lim: ₱50,000`. Names only when amounts are hidden.                                 |
| `investor_count` | no   | Count                                                                                                          |
| `witnesses`      | yes  | `• Name` lines. Empty when none.                                                                               |
| `due_date`       | no   | Loan due date, `Oct 16, 2026`                                                                                  |
| `principal`      | no   | Sum of lender principals                                                                                       |
| `rates`          | yes  | One line per lender: `• Ana Lim: 5%` or `• Ana Lim: ₱1,000`. Fixed peso becomes `Hidden` when amounts are off. |
| `lot_size`       | no   | `120 sqm` or empty                                                                                             |
| `notes`          | no   | Trimmed to 240 characters, or empty                                                                            |
| `loan_link`      | yes  | `View loan` link to `/loans/{id}`                                                                              |

### Reminder keys

Also filled for `upcoming`, `due_today`, `overdue`. `date` remains an alias of `event_date`.

| Key              | Meaning                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `heading`        | `Upcoming in 3 days`, `Due today`, or `Overdue` (already chosen by the planner) |
| `event_type`     | Disbursement, Due, or Interest due                                              |
| `event_date`     | Draft date                                                                      |
| `amount`         | Draft total (`totalAmount`)                                                     |
| `principal_part` | Draft `totalPrincipal` when the draft has it, else empty                        |
| `interest_part`  | Draft `totalInterest` or `interest` when the draft has it, else empty           |
| `days_until`     | `3 days` or `1 day` for upcoming. Empty for due today and overdue.              |
| `days_overdue`   | `4 days` or `1 day` for overdue. Empty otherwise.                               |

`principal_part` and `interest_part` come from the calendar draft, so an interest-only period does not repeat the whole loan principal as if it were due that day. `principal` remains the full loan principal for owners who want it.

### Digest keys (`digest` and `upcoming_week`)

| Key                        | HTML | Meaning                                                                                                                           |
| -------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| `today`                    | no   | Manila today                                                                                                                      |
| `due_today_count`          | no   | Count. `0` when none.                                                                                                             |
| `due_today_body`           | yes  | Event lines, or empty                                                                                                             |
| `overdue_count`            | no   | Count                                                                                                                             |
| `overdue_body`             | yes  | Event lines, or empty                                                                                                             |
| `upcoming_count`           | no   | Next 7 days, excluding today                                                                                                      |
| `upcoming_body`            | yes  | Event lines, or empty                                                                                                             |
| `net`                      | no   | Signed 7-day outlook, or `Hidden`                                                                                                 |
| `digest_body`              | yes  | The sections that have rows, plus `Nothing due in the next 7 days.` when all three are empty. Kept so old templates still render. |
| `group_name`, `group_link` |      | As above                                                                                                                          |

`upcoming_week` uses the same keys. Its default only prints the next-7-days section. `/upcoming` renders that template.

Each event line inside a body:

```text
• Lot A · Interest due · Oct 16, 2026 · ₱12,000
  Ana Lim
```

Borrower name goes on the next indented line when the loan has one. Amount is omitted from the line when Show amounts is off (the line still has name, type, and date). Do not print `Hidden` on every digest row.

### Unsigned keys

| Key                        | Meaning             |
| -------------------------- | ------------------- |
| `pending_count`            | Loans still waiting |
| `pending_body`             | Blocks below        |
| `group_name`, `group_link` | As above            |

Each block:

```text
<b>Lot A</b>
OR/CR · Due Oct 16, 2026 · ₱120,000
Waiting:
• Maria Cruz, Borrower
• Juan Reyes, Investor
<a href="...">Open loan</a>
```

Amount follows Show amounts. Keep the 12-loan cap and `And N more.`

### Activity keys

Every activity template gets the shared loan keys, plus:

| Key             | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `action`        | Short title, same words as the template heading (`Payment received`) |
| `action_detail` | One line from `detail`, or empty                                     |
| `summary`       | One plain sentence for old templates and for push                    |
| `signer_name`   | Contract signed only. Empty otherwise.                               |
| `signer_role`   | Borrower, Investor, or Witness                                       |
| `signed_count`  | How many required parties have signed after this signature           |
| `signer_total`  | How many required parties the loan has                               |

`action_detail` examples:

| Type                | Line                                   |
| ------------------- | -------------------------------------- |
| `disbursement`      | `₱50,000 from Ana Lim on Oct 1, 2026`  |
| `payment_received`  | `₱12,000 from Ana Lim on Oct 16, 2026` |
| `interest_extended` | `Next due Oct 16, 2026`                |
| `contract_signed`   | `Maria Cruz, Borrower. 2 of 3 signed.` |
| others              | empty                                  |

When amounts are hidden, drop the peso amount from `action_detail` and keep the name and date.

`loan_removed` still needs a snapshot, because the loan is no longer in the group when the job runs. Put `loanName`, `loanType`, `status`, `borrowerName`, and `principal` on `detail` before the delete. The sender uses that snapshot when the loan cannot be loaded through the group. Link `loan_link` still opens the loan if it exists.

## Default copy

Tone: labels and facts. No marketing. No em dash. Middle dot is already used in these messages and stays.

Shared block, inlined into each reminder and activity default (each default is a full string, so an owner can delete lines):

```text
<b>{{loan_name}}</b>
{{loan_type}} · {{status}}
Borrower: {{borrower}}
Investors:
{{investors}}
{{#if witnesses}}Witnesses: {{witnesses}}
{{/if}}Due: {{due_date}}
Principal: {{principal}}
```

### Reminders

`upcoming`, `due_today`, and `overdue` use the same body. Only the heading and the day line differ, and both day lines are conditional so one structure is safe on all three.

```text
<b>{{heading}}</b>
<b>{{loan_name}}</b>
{{loan_type}} · {{status}}
Borrower: {{borrower}}
Investors:
{{investors}}
{{#if witnesses}}Witnesses: {{witnesses}}
{{/if}}{{event_type}}: {{event_date}}
Amount: {{amount}}
{{#if principal_part}}Principal due: {{principal_part}}
{{/if}}{{#if interest_part}}Interest due: {{interest_part}}
{{/if}}{{#if days_until}}Due in {{days_until}}
{{/if}}{{#if days_overdue}}Overdue by {{days_overdue}}
{{/if}}
{{loan_link}}
```

### Digests

`digest`:

```text
<b>Daily digest · {{group_name}}</b>
{{today}}
{{#if due_today_body}}
<b>Due today ({{due_today_count}})</b>
{{due_today_body}}
{{/if}}{{#if overdue_body}}
<b>Overdue ({{overdue_count}})</b>
{{overdue_body}}
{{/if}}{{#if upcoming_body}}
<b>Next 7 days ({{upcoming_count}})</b>
{{upcoming_body}}
{{/if}}
<b>Net (7 days)</b> {{net}}

{{group_link}}
```

When every body is empty, `digest_body` still contains `Nothing due in the next 7 days.` The default above would otherwise show only the title and a net of zero. Append that sentence in the builder when all three bodies are empty, as `{{empty_notice}}`, and put `{{empty_notice}}` before the net line. `empty_notice` is empty when any section has rows.

`upcoming_week` (bot command):

```text
<b>Next 7 days · {{group_name}}</b>
{{today}}
{{#if upcoming_body}}{{upcoming_body}}{{/if}}{{empty_notice}}

{{group_link}}
```

For this command, `upcoming_body` includes today through seven days (the command is "what is coming up", including today). `empty_notice` is `Nothing scheduled.` when that list is empty. `digest` keeps today in `due_today_body` and the following days in `upcoming_body`.

### Unsigned

```text
<b>Signatures still needed · {{group_name}}</b>
{{pending_count}} still open

{{pending_body}}

{{group_link}}
```

### Activity

| Kind                         | First lines, then the shared loan block and `{{loan_link}}`                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `activity_loan_created`      | `<b>New loan</b>`                                                                                                   |
| `activity_loan_added`        | `<b>Added to {{group_name}}</b>`                                                                                    |
| `activity_loan_updated`      | `<b>Loan updated</b>`                                                                                               |
| `activity_disbursement`      | `<b>Disbursement</b>` then `{{action_detail}}`                                                                      |
| `activity_payment`           | `<b>Payment received</b>` then `{{action_detail}}`                                                                  |
| `activity_interest_extended` | `<b>Interest extended</b>` then `{{action_detail}}`                                                                 |
| `activity_loan_completed`    | `<b>Loan completed</b>`                                                                                             |
| `activity_loan_removed`      | `<b>Removed from {{group_name}}</b>`                                                                                |
| `activity_contract_signed`   | `<b>Contract signed</b>` then `{{signer_name}}, {{signer_role}}` then `{{signed_count}} of {{signer_total}} signed` |
| `activity`                   | `<b>Activity</b>` then `{{summary}}` then the shared block. Fallback when `type` is unknown.                        |

`activity_payment` handles both `payment_received` and the unused `interest_paid` type.

### Test

```text
<b>Test · {{group_name}}</b>
Telegram notifications are working.

{{group_link}}
```

### Preview samples

Extend `GROUP_TELEGRAM_PREVIEW_SAMPLES` so every key in the catalog has a sample. Preview runs the same `applyTelegramTemplate` as send, including `{{#if}}`. The editor already shows sample data under the preview. Keep that line.

Placeholder sheet (`ResponsiveModal`, already a sheet on a phone): group rows by Loan, People, Money, Event, Links. Keep tap to insert and copy. Show the sample under the label. Add one line at the top: `Wrap a line in {{#if key}} to hide it when that value is empty.`

## Activity routing

`templateKindForActivity(type)` in `group-telegram-templates.ts`:

| `ActivityEvent.type`                | Template kind                |
| ----------------------------------- | ---------------------------- |
| `loan_created`                      | `activity_loan_created`      |
| `loan_added`                        | `activity_loan_added`        |
| `loan_updated`                      | `activity_loan_updated`      |
| `disbursement`                      | `activity_disbursement`      |
| `payment_received`, `interest_paid` | `activity_payment`           |
| `interest_extended`                 | `activity_interest_extended` |
| `loan_completed`                    | `activity_loan_completed`    |
| `loan_removed`                      | `activity_loan_removed`      |
| `contract_signed`                   | `activity_contract_signed`   |
| anything else                       | `activity`                   |

Extend `ActivityEvent` in `src/lib/server/jobs/queue.ts`:

```ts
detail?: {
  amount?: number;
  date?: string; // YYYY-MM-DD
  investorName?: string;
  signerName?: string;
  signerRole?: string;
  signedCount?: number;
  signerTotal?: number;
  loanName?: string;
  loanType?: string;
  status?: string;
  borrowerName?: string;
  principal?: number;
};
```

`summary` is a one-line plain sentence, never HTML and never the loan name alone.

| Type                | `summary`                         |
| ------------------- | --------------------------------- |
| `loan_created`      | `New loan: {loanName}`            |
| `loan_added`        | `Loan added: {loanName}`          |
| `loan_updated`      | `Loan updated: {loanName}`        |
| `disbursement`      | `Disbursement on {loanName}`      |
| `payment_received`  | `Payment received on {loanName}`  |
| `interest_extended` | `Interest extended on {loanName}` |
| `loan_completed`    | `Loan completed: {loanName}`      |
| `loan_removed`      | `Loan removed: {loanName}`        |
| `contract_signed`   | `{signerName} signed {loanName}`  |

Push keeps using `summary` only (`src/lib/server/push/activity.ts`). Update `SUMMARY_MAP` there for the new types so a missing summary still reads clearly. Do not load loan HTML into push.

Fingerprints stay as they are for reminders, digest, and unsigned, so a deploy does not resend today's messages. New activity types use the existing fingerprint `activity:{type}:{entityId}:{updatedAt}`.

Contract signed fires from `POST /api/sign/[token]` only, after the signature is saved. Auto-sign on create (`applyAutoAttachSignatureToLoan`) does not send, or a new loan would spam the chat once per auto-signed witness. Unsigned reminders still cover people who have not signed.

Loan removed cannot use `enqueueGroupLoanChanged` after the row is gone, because that helper looks up `loan_group_loans`. Enqueue `group.telegram.activity` on the group id inside the delete handler, with the snapshot in `detail`, before or after the delete as long as the payload does not depend on the link row.

Loan created: after `applyGroupRulesForLoan` in `POST /api/loans`, call `enqueueGroupLoanChanged` with `loan_created`. Do not also enqueue `loan_added` for that create. Adding an existing loan stays `loan_added`.

## UI labels

| Kind                         | Tab label         |
| ---------------------------- | ----------------- |
| `upcoming`                   | Upcoming          |
| `due_today`                  | Due today         |
| `overdue`                    | Overdue           |
| `digest`                     | Daily digest      |
| `unsigned`                   | Unsigned          |
| `upcoming_week`              | Next 7 days       |
| `activity_loan_created`      | New loan          |
| `activity_loan_added`        | Loan added        |
| `activity_loan_updated`      | Loan updated      |
| `activity_disbursement`      | Disbursement      |
| `activity_payment`           | Payment           |
| `activity_interest_extended` | Interest extended |
| `activity_loan_completed`    | Completed         |
| `activity_loan_removed`      | Loan removed      |
| `activity_contract_signed`   | Contract signed   |
| `activity`                   | Other activity    |
| `test`                       | Test              |

Category order: Reminders, Digests, Activity, Other. Remember the last category and kind in component state only (not the URL).

Reset still loads `DEFAULT_GROUP_TELEGRAM_TEMPLATES[kind]`. Save still writes the trimmed draft for every editable kind. Compare with the new defaults only for the upgrade helper on read, not by skipping save.

## Implementation tasks

### 1. Template engine and catalog

Files:

- `src/lib/groups/group-telegram-templates.ts`
- `src/lib/groups/telegram-template-highlight.ts` (highlight `{{#if key}}` and `{{/if}}` the same way as tokens, or leave them as plain text if they are not keys)
- `src/lib/groups/group-telegram-templates.test.ts`
- `src/lib/groups/telegram-template-highlight.test.ts`

- [ ] Add the kinds, labels, category map, and `templateKindForActivity`.
- [ ] Add `{{#if key}}...{{/if}}` to `applyTelegramTemplate` before `{{key}}` replacement. Conditionals run on the raw template so a hidden block does not leave its inner tokens behind.
- [ ] Add `PREVIOUS_GROUP_TELEGRAM_TEMPLATES` and the upgrade check in `resolveGroupTelegramTemplate` and `mergeGroupTelegramTemplates`.
- [ ] Add the placeholder rows (`key`, `label`, `kinds`, `group`) and preview samples for every key above.
- [ ] Set every default string to the copy in this plan.
- [ ] Tests: substitution, unknown key left in place, if-block removed when empty and kept when filled, old default string resolves to the new default, a custom string is kept, `payment_received` maps to `activity_payment`.

### 2. Loan context builder

Files:

- Create `src/lib/groups/telegram-message-context.ts`
- Create `src/lib/groups/telegram-message-context.test.ts`
- `src/lib/group-notification-plan.ts` (move `escapeHtml`, date format, and money format here or import them from the new module so digest and reminders share one formatter)

- [ ] `buildTelegramLoanContext(loan, options)` returns every shared key and, when a draft and today key are passed, the reminder keys.
- [ ] Escape names. Format PHP with the existing `formatCalendarCurrency`.
- [ ] `Hidden` when `includeAmounts` is false.
- [ ] List caps at 12.
- [ ] Tests: borrower and two investors, missing borrower, Lot Title `lot_size`, amount hidden, name containing `<` is escaped, fixed rate hidden when amounts are off, percent rate still shown.

### 3. Reminders

Files:

- `src/lib/group-notification-plan.ts`
- `src/lib/group-notification-plan.test.ts`
- `src/lib/server/telegram/group-notifications.ts` (`loanQueryShape`: `borrower: true`, `loanWitnesses: { with: { witness: true } }`)

- [ ] `buildSingleReminderHtml` fills the context plus reminder keys. Keep fingerprints and the overdue repeat rule.
- [ ] Pass `groupName` into `planGroupNotifications` from the daily runner (load `loan_groups.name` with the settings row).
- [ ] Tests: upcoming HTML contains borrower, investor name, event date, and amount. Due today omits both day lines. Overdue includes `Overdue by`. A stored old one-line default renders the new default. A custom `Hello {{loan_name}}` stays custom. Show amounts off renders `Hidden` and not an em dash.

### 4. Digest and `/upcoming`

Files:

- `src/lib/group-notification-plan.ts` (`buildDigestHtml`, `planUpcomingWeekHtml`)
- `src/routes/api/webhooks/telegram/+server.ts`
- `src/lib/group-notification-plan.test.ts`

- [ ] Split digest sections into the keys above. Keep `digest_body` equal to the joined sections.
- [ ] `planUpcomingWeekHtml` renders the `upcoming_week` template with the group's stored templates.
- [ ] Pass group name and templates from the webhook handler.
- [ ] Tests: a week with one due-today loan fills `due_today_body` and leaves `upcoming_body` empty. An empty week sets `empty_notice`. `/upcoming` helper includes today.

### 5. Unsigned contracts

Files:

- `src/lib/groups/unsigned-signing-reminder.ts`
- `src/lib/groups/unsigned-signing-reminder.test.ts`
- `src/lib/server/telegram/group-notifications.ts` (`loadGroupLoansForSigningReminders` should use the richer loan load, or join investors and borrower onto the rows it already loads)

- [ ] Each block includes type, due date, and amount.
- [ ] Fill `pending_count`, `group_name`.
- [ ] Tests: block contains the due date and a waiting borrower. Completed loans still skipped. Interval slot behavior unchanged.

### 6. Activity send path

Files:

- `src/lib/server/jobs/queue.ts` (`ActivityEvent.detail`)
- `src/lib/group-notification-plan.ts` (`buildGroupTelegramActivityHtml`)
- `src/lib/server/telegram/group-notifications.ts` (`sendGroupActivityNotification`, `formatActivitySummary`)
- `src/lib/server/push/activity.ts` (summary map only)

- [ ] Load one loan by id with the same relations as the reminder query. Build context. Pick the template with `templateKindForActivity`.
- [ ] Build `action_detail` from `detail`.
- [ ] For `loan_removed`, prefer `detail` snapshot fields when the loan is not in the group.
- [ ] Tests: `loan_updated` with summary `Lot A` still renders borrower and investors from the loaded loan, not a message that is only the name. `disbursement` detail amount appears. Unknown type uses `activity`.

### 7. Wire the actions

Files:

- `src/routes/api/loans/+server.ts` (create: `loan_created` after group attach)
- `src/routes/api/loans/[id]/+server.ts` (update: summary `Loan updated: {name}`, not the name alone)
- `src/routes/api/loans/[id]/payments/+server.ts` (detail amount, `sentDate`, investor name)
- `src/routes/api/loans/[id]/received-payments/+server.ts` (detail amount, `receivedDate`, investor name)
- `src/routes/api/loans/[id]/extend-interest/+server.ts` (detail date = the new due date the route already computed)
- `src/routes/api/loans/[id]/status/+server.ts` (summary `Loan completed: {name}`)
- `src/routes/api/groups/+server.ts` and `src/routes/api/groups/[id]/loans/+server.ts` (summary `Loan added: {name}` where the name is already loaded or load it)
- `src/routes/api/groups/[id]/loans/+server.ts` DELETE (enqueue `loan_removed` on that group with a snapshot taken before delete)
- `src/routes/api/sign/[token]/+server.ts` (after save, `contract_signed` with signer name, role, signed count, total)

- [ ] Do not enqueue telegram from `applyAutoAttachSignatureToLoan`.
- [ ] Do not enqueue `loan_added` on create.
- [ ] Investor name for a payment: load it from the investor id already validated in that route. Do not trust a name from the client body.
- [ ] Signed count: count invitations on that loan with `signedAt` set, after this update. Total: count of invitations. Role label from `partyRole` (`borrower`, `lender` → Investor, `witness_1` / `witness_2` → Witness).

### 8. Settings UI

Files:

- `src/lib/components/groups/GroupTelegramSettingsCard.svelte`
- `src/lib/components/groups/TelegramTemplateEditor.svelte`
- `src/lib/group-validation.ts` (`telegramTemplatesSchema`: keys must be a known kind, each string max 4,000, tags outside the allowlist fail)
- `PUT` handler that uses `updateTelegramBodySchema` (`src/routes/api/groups/[id]/telegram/+server.ts`)

- [ ] Category row, then kind tabs for that category. 44px targets. Horizontal scroll. No `DropdownMenu`.
- [ ] Placeholder sheet grouped. Insert and copy unchanged.
- [ ] Preview uses `applyTelegramTemplate` with samples, so `{{#if}}` matches what Telegram will do.
- [ ] Include `test` under Other.
- [ ] Save and reset still work per kind.
- [ ] API returns 400 for an unknown kind, an oversize string, or a disallowed tag. GET still returns merged defaults for missing kinds.

### 9. Tests that lock the defaults

File: `src/lib/groups/group-telegram-templates.test.ts` or `telegram-message-context.test.ts`.

- [ ] For each default, render with the preview samples and assert the result has no leftover `{{`.
- [ ] Assert each reminder default contains Amount, Borrower, and Investors.
- [ ] Assert `activity_payment` default contains `action_detail`.
- [ ] Assert `unsigned` default contains `pending_count` and `pending_body`.

Run: `bun run test src/lib/groups/group-telegram-templates.test.ts src/lib/groups/telegram-message-context.test.ts src/lib/group-notification-plan.test.ts src/lib/groups/unsigned-signing-reminder.test.ts src/lib/groups/telegram-template-highlight.test.ts`

### 10. Docs

- [ ] `docs/guides/routes/groups-detail.md`: template categories, what each message contains, which actions send, Show amounts, and that contact details are not available as placeholders.
- [ ] `docs/PROJECT.md`: the Telegram sentence that lists reminders and templates. Name the activity kinds and the three new sends (created, removed, signed).
- [ ] Do not add a migration file.

### 11. Manual check

Needs a group whose Telegram status is Connected. If the local app has no bot, say so and rely on the unit tests for the HTML.

- [ ] At 375px, open group Settings, Telegram card. Switch Reminders, Digests, Activity, Other. Each opens a sheet of placeholders, inserts at the cursor, and preview shows the sample with bold labels. No floating menu.
- [ ] Reset Upcoming, save, reload. The new default is still there.
- [ ] Type `Hello {{loan_name}}`, save, reload. That custom text remains. Other kinds stay on their defaults.
- [ ] Send test. The chat shows the group name and the group link.
- [ ] On a loan in that group: record a disbursement or a received payment. The chat shows the loan name, borrower, investors, amount, date, and lender.
- [ ] Remove the loan from the group. The chat says it was removed and still names the loan.
- [ ] Sign a contract on a loan in the group (not auto-sign). The chat names the signer and the role.
- [ ] Desktop width: the same card, categories in a row, preview readable.

## Docs to update

| Doc                                   | Change                                              |
| ------------------------------------- | --------------------------------------------------- |
| `docs/guides/routes/groups-detail.md` | Template list, message contents, new activity sends |
| `docs/PROJECT.md`                     | Telegram bullet: template kinds and send triggers   |
| `docs/workflow/planned/README.md`     | Index row (this plan)                               |
| `docs/workflow/intake/_to-plan.md`    | 📋 link                                             |
| `docs/workflow/intake/_to-prompt.md`  | 📋 link on the existing telegram line               |

## Open questions

None.
