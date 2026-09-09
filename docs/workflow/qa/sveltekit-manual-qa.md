# Manual QA checklist (post-migration)

Run against **dev Neon branch** with `bun run dev`. Compare behavior to last Next.js release on `main` if needed (git history).

## Auth

- [ ] Sign in with Google (admin)
- [ ] Sign in with Google (investor portal user)
- [ ] Session shows correct role; sign out works
- [ ] Unauthenticated `/dashboard` redirects to `/signin`

## Pages

- [ ] `/` landing renders; logged-in user redirects to dashboard
- [ ] `/dashboard` stats and charts load
- [ ] `/loans` list, filters, open detail
- [ ] `/loans/new` create minimal loan
- [ ] `/investors`, `/investors/new`, `/investors/[id]`
- [ ] `/borrowers/[id]`, `/barrowers/[id]` redirect
- [ ] `/debts`, `/debts/new`, `/debts/[id]`
- [ ] `/transactions/*` (if flag enabled)
- [ ] `/settings` maintenance buttons respond
- [ ] `/sign/[token]` public signing (valid token)

## API smoke

- [ ] `GET /api/backup?download=true` (authenticated)
- [ ] `POST /api/loans/check-overdue`
- [ ] Cron route rejects without `CRON_SECRET`

## Data writes (dev branch only)

- [ ] Create/edit loan, record payment, verify DB row counts
- [ ] Investor portal sees shared loans only

Mark items in `docs/workflow/done/sveltekit-migration.md` as you verify.
