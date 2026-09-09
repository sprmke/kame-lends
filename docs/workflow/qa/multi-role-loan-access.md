# Multi-role loan access — QA checklist

Use Neon branch **`dev-sveltekit-migration`** only. Do not point at prod.

## Automated (this branch)

- [x] `bun run test:unit` (access-control + unit suite)
- [x] Migration `db/migrations/0013_multi_role_loan_access.sql` applied on `dev-sveltekit-migration`
- [x] E2E specs updated for authenticated `/loans/[id]/sign` (run with Google e2e session when secrets allow)

## Google Calendar (admin shared calendar)

- [ ] Live create / update / delete on the **test** calendar in `.env.local` (`GOOGLE_CALENDAR_ID` must not be `primary`)
- Manual runner: `bun run test:unit src/lib/server/google-calendar.smoke.manual.ts`
- **2026-09-09:** smoke blocked with Google `invalid_grant: account not found` for `GOOGLE_SERVICE_ACCOUNT_EMAIL`. Replace the service account key and re-share the test calendar, then re-run.

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
