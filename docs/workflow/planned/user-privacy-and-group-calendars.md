# User privacy, group calendars, workspace-admin removal

**Status:** Shipped (implementation branch)  
**Updated:** 2026-09-16

## Summary

- Removed legacy workspace Google Calendar (`GOOGLE_CALENDAR_ID`, `/api/loans/sync-calendar`, Settings/Loans sync UI). Group calendars only.
- Open Google sign-up; any user creates and owns loans, CRM, and groups. No cross-user loan/group visibility for platform owner.
- Settings: maintenance tools for all signed-in users; `Download my data`; platform owner gets `Download all data` (`scope=all`).
- Wipe script: `bun run dev:wipe-workspace-calendar -- --dry-run|--confirm`.

## Post-ship hardening (2026-09-16)

- Loan create/update validates borrower and investor rows belong to `session.user.id` (`src/lib/server/loan-crm-ownership.ts`).
- Backup `scope=all` gate tested via `src/lib/server/backup-access.ts`.
- Wipe script no longer touches dropped `google_calendar_event_ids` column.
- `SyncCalendarButton` requires an explicit group sync endpoint.
