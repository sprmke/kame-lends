# Settings

**Route:** `/settings`  
**Status:** Documented

## Behavior

**Page header:** `PageHeader` title **Settings** plus subtitle from `PAGE_DESCRIPTIONS.settings` (`src/lib/page-descriptions.ts`).

Account summary card (title **Account**, name / email / **Roles** in a compact grid). **Roles** lists **Owner** (owned lending data) plus party assignments (Investor, Borrower, Witness), not the single `users.role` column. Page title is Settings. On phone, open Settings from the dock profile photo; **More** opens the account sheet (Settings also appears in that nav list).

A **Settings sections** anchor row links Account, Templates, Payments, Notifications, and Data. Push notification preferences and **Send test** stay disabled when this browser cannot subscribe (for example missing VAPID keys), with the reason shown once.
All signed-in users get:

- **Payment methods** — each user manages their own bank/QR rows.
- **Loan templates** — each user saves their own presets (template name, borrowers, investors, type, groups, rate, loan name). None are shared. Borrowers and investors are multi-selects, and each name is listed once. Chosen people are listed under the field, and each investor row has a rate that starts from the template rate. Due in days and the rate sit in one column. The loan name can include `{sent}` and `{due}`. The form shows an example under that field, and switching type fills the matching pattern until the name is edited. Due in days starts at 14, so a new loan is due two weeks after the sent date. New Loan can start from one.
- **Install app** — shown only when this browser can install. **Chromium:** after `beforeinstallprompt`, the sidebar, account sheet (`InstallAppNavButton`), and this card run the browser install dialog. **iOS:** those same controls open an in-app sheet (Share → Add to Home Screen). Hidden when already installed, and hidden in browsers that will not offer install (desktop Safari, Firefox, or Chromium before the prompt). No Settings redirect.
- **Notifications** — per-device Web Push opt-in, reminder/activity/signing preferences, **Send test** when subscribed.
- **Email notifications** — per-user email switches (`user_email_preferences`): master switch; loan and payment updates; signing requests; unsigned contract reminders with **First reminder after** and **Repeat every** days; upcoming due dates with lead-day checkboxes; due today; overdue with **Repeat every** days; and **Show amounts in emails**. **Save** writes `PUT /api/email/preferences`. **Send test** calls `POST /api/email/test` and sends to the signed-in user; it is disabled when Resend is not configured. When email is not configured, the card shows one short read-only line and saving still works. See [`docs/architecture/email-notifications.md`](../../architecture/email-notifications.md).
- **Contract signing** — checkbox **Auto attach my signature on loans** (`PUT /api/signing/preferences`). Requires a saved e-signature (identity documents or linked party rows). When turned on, unsigned slots on existing loans where you are borrower, lender, or witness are signed with your saved signature; new and updated loans do the same for parties with this setting. Turning it off does not remove signatures already recorded.
- **Data & maintenance** — **Download my data** (`GET /api/backup?download=true`). JSON omits receipt image blobs (amounts/dates remain). Rate-limited.

Platform owner email only:

- **Download all data** (`GET /api/backup?download=true&scope=all`).
- Weekly email backup cron (`/api/cron/backup`) also goes to the owner only (thin payload). Full Postgres dumps: `bun run backup:neon --confirm-prod`.

Party users with linked CRM rows also get **Identity documents** (valid ID and e-signature via `/api/party-profile/me`).

Google Calendar sync is per group on the group hub only (no workspace calendar on Settings).

- **Loading:** `SettingsPageSkeleton` mirrors the header, Account card, and manager cards. Data health and recently deleted rows use inline row skeletons while their explicit checks run. Party identity and payment method cards load from the page payload, not a spinner.

## Load

[`src/routes/settings/+page.server.ts`](../../../src/routes/settings/+page.server.ts)

- Requires session.
- `isPlatformOwner` from `isWorkspaceOwnerEmail`.
- Payment methods, loan templates (plus the user's borrowers and groups for the template form), signing preferences, saved-signature flag, push preferences, email preferences, and optional party identity documents.
- `emailConfigured` comes from `isTransactionalEmailConfigured()` and only controls the Send test button.

## Permissions

Any signed-in user. All-users backup is platform owner only.

## Implementation map

| Piece           | Path                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| Page            | `src/routes/settings/+page.svelte`                                                          |
| Templates       | `src/lib/components/settings/LoanTemplatesManager.svelte`, `src/routes/api/loan-templates/` |
| Backup API      | `src/routes/api/backup/+server.ts`, `src/lib/server/backup-data.ts`                         |
| Due dates / fix | `SyncLoanDueDatesButton`, `FixReceivedPaymentsButton`                                       |

## Data & maintenance (2026-11)

- The one-click **Fix received payments** and **Sync loan due dates** buttons are gone. Their endpoints return **410 Gone**.
- The platform owner sees a read-only **Data health** card backed by `GET /api/admin/money-health`. It reports counts only (no PII) for unlinked payments, receipt-less payments, missing interest periods, zero-allocation loans, zero-capital fixed rows, duplicate period dates, periods or payments left on removed allocations, completed loans with a balance, debt orphan periods, and period/loan status drift against the ledger. Status drift is computed by the same rule as the daily sweep, so already-paid periods are never reported as underpaid.
- The platform owner also sees an **Assistant usage** card backed by `GET /api/admin/ai-usage`: turns, users, cost, average turn, fallback rate, helpful ratio, and tool error rate for the last 7 days. Counts and rates only; no questions, names, or amounts.
- Downloading a backup omits receipt image columns; loan detail still loads receipts when needed.
- Automated email backup is weekly (not daily) and owner-only to limit Neon egress.
- Signing out purges offline caches and the last-online timestamp.
