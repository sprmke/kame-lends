# Multi-role loan access — QA checklist

Use Neon branch **`dev-sveltekit-migration`** only. Do not point at prod.

## Automated (this branch)

- [x] `bun run test:unit` (access-control + unit suite)
- [x] Migration `db/migrations/0013_multi_role_loan_access.sql` applied on `dev-sveltekit-migration`
- [x] E2E specs updated for authenticated `/loans/[id]/sign`
- [x] `bun run test:e2e -- --project=multi-role` (investor/borrower/witness session switch + edit denials)

## Google Calendar (admin shared calendar)

- [x] Live create / update / delete on the **test** calendar in `.env.local` (`GOOGLE_CALENDAR_ID` must not be `primary`)
- Verified through app helpers `createCalendarEvent` / `updateCalendarEvent` / `deleteCalendarEvent` (Vitest smoke)
- **2026-09-09:** old `pawn-tracker@...` SA returned `invalid_grant: account not found`. Local `.env.local` was rotated to a working service account and a new non-`primary` QA calendar (`Kame Lends QA Test Calendar`). Secrets stay in `.env.local` only.
- Manual runner: copy `google-calendar.smoke.manual.ts` to `*.test.ts` (or include it) and run with Vitest

## Manual multi-user Google sign-in

Create one loan with distinct investor, borrower, and witness emails (each a real Google account you can open).

| Actor    | Expect                                                                |
| -------- | --------------------------------------------------------------------- |
| Admin    | Full edit on `/loans/[id]`; Sync Calendar / settings tools visible    |
| Investor | `/investments` lists loan; can record payments only on own allocation |
| Borrower | `/borrowed` lists loan; read-only detail; can open `/loans/[id]/sign` |
| Witness  | `/witnessed` lists loan; read-only; can sign matching witness slot    |

- [ ] Nav shows membership routes only when that membership exists
- [ ] Borrower/witness cannot PUT loan shell, status, or payments (API 403)
- [ ] Signing requires Google login; no new token URL in admin copy link
- [ ] In-app calendar on `/investments`, `/borrowed`, `/witnessed` shows that loan’s events
