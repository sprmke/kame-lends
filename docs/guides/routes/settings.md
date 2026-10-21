# Settings

**Route:** `/settings`  
**Status:** Documented

## Behavior

**Page header:** `PageHeader` title **Settings** plus subtitle from `PAGE_DESCRIPTIONS.settings` (`src/lib/page-descriptions.ts`).

Account summary card (title **Account**, name / email / **Roles** in a compact grid). **Roles** lists **Owner** (owned lending data) plus party assignments (Investor, Borrower, Witness), not the single `users.role` column. Page title is Settings. On phone, open Settings from the dock profile photo; **More** opens the account sheet (Settings also appears in that nav list).

All signed-in users get:

- **Payment methods** — each user manages their own bank/QR rows.
- **Loan templates** — each user saves their own presets (template name, borrowers, investors, type, groups, rate, loan name). None are shared. Borrowers and investors are multi-selects, and each name is listed once. Chosen people are listed under the field, and each investor row has a rate that starts from the template rate. Due in days and the rate sit in one column. The loan name can include `{sent}` and `{due}`. The form shows an example under that field, and switching type fills the matching pattern until the name is edited. Due in days starts at 14, so a new loan is due two weeks after the sent date. New Loan can start from one.
- **Install app** — shown only when this browser can install. **Chromium:** after `beforeinstallprompt`, the sidebar, account sheet (`InstallAppNavButton`), and this card run the browser install dialog. **iOS:** those same controls open an in-app sheet (Share → Add to Home Screen). Hidden when already installed, and hidden in browsers that will not offer install (desktop Safari, Firefox, or Chromium before the prompt). No Settings redirect.
- **Notifications** — per-device Web Push opt-in, reminder/activity/signing preferences, **Send test** when subscribed.
- **Data & maintenance** — sync loan due dates, fix received payments, **Download my data** (`GET /api/backup?download=true`).

Platform owner email only:

- **Download all data** (`GET /api/backup?download=true&scope=all`).

Party users with linked CRM rows also get **Identity documents** (valid ID and e-signature via `/api/party-profile/me`).

Google Calendar sync is per group on the group hub only (no workspace calendar on Settings).

## Load

[`src/routes/settings/+page.server.ts`](../../../src/routes/settings/+page.server.ts)

- Requires session.
- `isPlatformOwner` from `isWorkspaceOwnerEmail`.
- Payment methods, loan templates (plus the user's borrowers and groups for the template form), and optional party identity documents.

## Permissions

Any signed-in user. All-users backup is platform owner only.

## Implementation map

| Piece           | Path                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| Page            | `src/routes/settings/+page.svelte`                                                          |
| Templates       | `src/lib/components/settings/LoanTemplatesManager.svelte`, `src/routes/api/loan-templates/` |
| Backup API      | `src/routes/api/backup/+server.ts`, `src/lib/server/backup-data.ts`                         |
| Due dates / fix | `SyncLoanDueDatesButton`, `FixReceivedPaymentsButton`                                       |
