# Google Calendar integration — Kame Lends

Use when changing calendar sync, event shapes, or settings UI.

## Auth

Service account (not user OAuth):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID` (optional: legacy **workspace-wide** calendar id, never `primary`)

Credentials alone (`readGoogleServiceAccountCredentials`) are enough to **create and manage per-group calendars**. The workspace calendar still needs `GOOGLE_CALENDAR_ID`.

Read at runtime via `$env/dynamic/private` (`src/lib/server/google-calendar-config.ts`). Use a **kame-lends / pawn-tracker** Google Cloud service account, never kame-homes.

## Two calendar surfaces

| Surface            | Module                              | Sync                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace (legacy) | `src/lib/server/google-calendar.ts` | Manual batches from settings (`POST /api/loans/sync-calendar`)                                                                                                                                                                                                   |
| Per group          | `src/lib/server/group-calendar.ts`  | Automatic via `integration_jobs` (`waitUntil` + daily `/api/cron/groups`). ACL readers = group member emails. Owner full resync: `POST /api/groups/[id]/calendar/sync` (`prepare` / `wipe` / `loans` / `summaries`) via `SyncCalendarButton` `syncEndpoint` prop |

## Implementation notes

- Events: disbursements, due dates, interest due, **Total Summary**. All-day events use YYYY-MM-DD start and exclusive next-day end. Never `new Date(dateKey + "T00:00:00")`.
- Private `kameKey` / `kameLoanId` on group events for idempotent upserts.
- Group calendar subscribe URL: `https://calendar.google.com/calendar/r?cid=<id>`
- Dates: `manilaTodayKey`, `googleAllDayRange`

## Testing

Use a **test calendar** / throwaway secondary calendars on the QA Neon branch — never the prod calendar.

## App URL in events

`PUBLIC_APP_URL` via `resolveAppUrl()` (`src/lib/server/app-url.ts`).
