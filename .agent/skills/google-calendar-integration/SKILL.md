# Google Calendar integration — Kame Lends

Use when changing calendar sync, event shapes, or group settings UI.

## Auth

Service account (not user OAuth):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Credentials are enough to create and manage per-group calendars. There is no workspace-wide shared calendar.

Read at runtime via `$env/dynamic/private` (`src/lib/server/google-calendar-config.ts`). Use a **kame-lends / pawn-tracker** Google Cloud service account, never kame-homes.

## Calendar surface

| Surface   | Module                             | Sync                                                                                                                                                             |
| --------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per group | `src/lib/server/group-calendar.ts` | Automatic via `integration_jobs` (`waitUntil` + daily `/api/cron/groups`). ACL readers = group member emails. Full resync: `POST /api/groups/[id]/calendar/sync` |

Shared pure helpers: `src/lib/calendar-summaries.ts`, `src/lib/calendar-events.ts`, `src/lib/calendar-sync-plan.ts`, `src/lib/calendar-google-dedupe.ts`.

## Implementation notes

- Events: disbursements, due dates, interest due, **Total Summary**. All-day events use YYYY-MM-DD start and exclusive next-day end. Never `new Date(dateKey + "T00:00:00")`.
- Event colors (`colorId`, same as legacy workspace sync): disbursement `11`, due `2`, interest due `7`, Total Summary `8`. Shared helper: `src/lib/calendar-event-colors.ts`. Backfill existing group calendars: `bun run dev:backfill-group-calendar-colors -- --dry-run` then `--confirm` (optional `--group-id=N`).
- Private `kameKey` / `kameLoanId` on group events for idempotent upserts. Each sync patches one event per key, deletes extra copies with the same key, drops stale keys, and removes legacy rows without `kameKey` when a keyed row exists for that slot (`planLoanCalendarEventDeletions`).
- `integration_jobs.dedupe_key` is unique while status is `pending` or `running` (migration `0026_integration_jobs_active_dedupe.sql`) so overlapping `group.calendar.syncLoan` runs are not queued during an in-flight sync.
- Group calendar subscribe URL: `https://calendar.google.com/calendar/r?cid=<id>`
- Dates: `manilaTodayKey`, `googleAllDayRange`
- Loan create/update/delete and due-date sync enqueue `group.calendar.syncLoan` / `removeLoan` via `enqueueGroupLoanChanged`.

## Legacy workspace calendar

Removed from the app. To wipe events on an old shared calendar before decommissioning env vars, use `bun run dev:wipe-workspace-calendar -- --dry-run` then `--confirm`. The script refuses to run if `GOOGLE_CALENDAR_ID` matches any `group_calendars.google_calendar_id`.

## Testing

Use throwaway secondary calendars on the QA Neon branch.

## App URL in events

`PUBLIC_APP_URL` via `resolveAppUrl()` (`src/lib/server/app-url.ts`).
