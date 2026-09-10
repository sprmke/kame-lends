# Google Calendar integration — Kame Lends

Use when changing calendar sync, event shapes, or settings UI.

## Auth

Service account (not user OAuth):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`

## Implementation

- `src/lib/server/google-calendar.ts` (`googleapis` client)
- Events: disbursements, due dates, interest due, daily summaries with links back to filtered loans.

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
