# Google Calendar integration — Kame Lends

Use when changing calendar sync, event shapes, or settings UI.

## Auth

Service account (not user OAuth):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID` (shared calendar id, never `primary`)

Read at runtime via `$env/dynamic/private` (`src/lib/server/google-calendar-config.ts`). Use a **kame-lends / pawn-tracker** Google Cloud service account, never kame-homes. The account must exist and have **Make changes to events** on `GOOGLE_CALENDAR_ID`. `invalid_grant: account not found` means that SA was deleted; create a new key in this project's GCP account and re-share the calendar.

## Implementation

- `src/lib/server/google-calendar.ts` (`googleapis` client)
- Events: disbursements, due dates, interest due, **Total Summary** (one per date that has loan cashflow). All-day events use YYYY-MM-DD start and an exclusive next-day end. Never build Google dates from `new Date(dateKey + "T00:00:00")` (that shifts a day in Asia/Manila).
- One Google event per loan per date per kind (sent / due / interest due). Multiple investors are listed in the description, not as duplicate events.
- Private `kameKey` on each event so re-sync updates in place and leftover **Daily Summary** titles are replaced.
- Google API failures throw `GoogleCalendarError`. Sync/cleanup must not swallow them as empty event lists.
- Bulk writes space ~120ms apart and retry `rateLimitExceeded` with exponential backoff.
- Full sync is client-driven batches: `POST /api/loans/sync-calendar` with `prepare`, `wipe`, `loans`, `summaries`. Scope `all`, `open` (not Completed), or `upcoming` (today and later). Do not sync all loans in one serverless invocation.

## Sync model

- **Manual sync** from settings / loans (admin workspace owner only).
- Not triggered on every loan save.
- Shared service-account calendar (`GOOGLE_CALENDAR_ID`); no per-user Google OAuth attendees.
- Loan parties see events in the **in-app** loan calendar on `/loans`, `/investments`, `/borrowed`, `/witnessed`.

## SvelteKit wiring

- Settings page actions call server functions.
- API routes: `src/routes/api/loans/sync-calendar/+server.ts`, `cleanup-calendar`, etc.

## Testing

Use a **test calendar** on the QA Neon branch — never the prod calendar.

## App URL in events

`PUBLIC_APP_URL` (see `.env.example`).
