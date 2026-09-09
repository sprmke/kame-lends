# Google Calendar integration — Kame Lends

Use when changing calendar sync, event shapes, or settings UI.

## Auth

Service account (not user OAuth):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`

## Implementation

- `lib/google-calendar.ts` (~1k lines, `googleapis` client) — framework-agnostic, port to `new-app/src/lib/server/`.
- Events: disbursements, due dates, interest due, daily summaries with links back to filtered loans.

## Sync model

- **Manual sync** from settings / loans (admin workspace owner only).
- Not triggered on every loan save (matches legacy behavior).
- Shared service-account calendar (`GOOGLE_CALENDAR_ID`); no per-user Google OAuth attendees.
- Loan parties see events in the **in-app** loan calendar on `/loans`, `/investments`, `/borrowed`, `/witnessed`.

## SvelteKit wiring

- Settings page actions call server functions.
- API routes: port `app/api/loans/sync-calendar`, `cleanup-calendar`, etc. to `+server.ts`.

## Testing

Use a **test calendar** on dev Neon QA — never prod calendar during migration.

## App URL in events

- Legacy: `NEXT_PUBLIC_APP_URL`
- SvelteKit cutover: `PUBLIC_APP_URL` (document in env migration)
