# Settings

**Route:** `/settings`  
**Status:** Documented

## Behavior

**Page header:** `PageHeader` title **Settings** plus subtitle from `PAGE_DESCRIPTIONS.settings` (`src/lib/page-descriptions.ts`).

Account summary card (title **Account**, name / email / **Roles** in a compact grid). **Roles** lists **Owner** (owned lending data) plus party assignments (Investor, Borrower, Witness), not the single `users.role` column. Page title is Settings. Settings is in the phone More sheet (not on the floating dock).

All signed-in users get:

- **Payment methods** — each user manages their own bank/QR rows.
- **Install app** — sidebar (desktop) and More sheet (phone) use `InstallAppNavButton`. **Chromium:** tap runs the browser install dialog when `beforeinstallprompt` is available. **iOS:** tap opens an in-app sheet with Share → Add to Home Screen steps (no Settings redirect). Hidden when already installed. Settings card mirrors the same install action.
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
- Payment methods and optional party identity documents.

## Permissions

Any signed-in user. All-users backup is platform owner only.

## Implementation map

| Piece           | Path                                                                |
| --------------- | ------------------------------------------------------------------- |
| Page            | `src/routes/settings/+page.svelte`                                  |
| Backup API      | `src/routes/api/backup/+server.ts`, `src/lib/server/backup-data.ts` |
| Due dates / fix | `SyncLoanDueDatesButton`, `FixReceivedPaymentsButton`               |
