# Vercel production deploy

**Current process:** GitHub Actions CD on `main` (quality → migrate → deploy). See [`docs/architecture/deployment.md`](../architecture/deployment.md).

## One-time setup

1. Add GitHub Actions secrets: `DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
2. Confirm Vercel Production env vars match the snapshot list in `vercel-production-snapshot.md` (plus `PUBLIC_APP_URL` if used).
3. Disable Vercel Git **Production** auto-deploy for `main` so CD owns migrate-then-deploy ordering. Preview deploys for PRs can stay enabled.
4. Google OAuth: Auth.js callback under `/auth/...`.

## Manual / emergency

```bash
DATABASE_URL='…same as Vercel Production…' bun run db:migrate:pending --yes
export VERCEL_TOKEN=… VERCEL_ORG_ID=… VERCEL_PROJECT_ID=…
bun run deploy:prod
```

## Rollback

Redeploy the previous Vercel production deployment from the dashboard. For schema issues, restore from Neon backup / branch snapshot (`bun run backup:neon`).
