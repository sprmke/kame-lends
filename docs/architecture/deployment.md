# Deployment (CI/CD)

Production releases are automated on every push to **`main`**.

## Pipeline

```text
push / merge → main
  → quality (check, test, build)
  → migrate (pending db/migrations/*.sql against prod Neon)
  → deploy (Vercel production via CLI --prebuilt)
```

| Workflow                                                     | Trigger                          | Role                                                    |
| ------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------- |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | PRs + non-`main` pushes          | Typecheck, format, lint, tests, build, commitlint (PRs) |
| [`.github/workflows/cd.yml`](../../.github/workflows/cd.yml) | Push to `main` + manual dispatch | Same quality gate → migrate → Vercel prod               |

### Quality gate (CI and CD)

| Step            | Command                                       |
| --------------- | --------------------------------------------- |
| Typecheck       | `bun run check` (`svelte-check` + TypeScript) |
| Format          | `bun run format:check` (Prettier)             |
| Lint            | `bun run lint:js` (ESLint)                    |
| Unit tests      | `bun run test:unit` (Vitest)                  |
| AI tooling sync | `bun run check:ai-tooling-sync`               |
| Build           | `bun run build`                               |

Locally: `bun run ci:quality`.

Concurrency group `cd-main` with `cancel-in-progress: false` so a mid-migration run is never cancelled by a newer push.

## Migrations

Hand-maintained SQL lives in `db/migrations/`. The runner:

```bash
bun run db:migrate:pending --yes
```

1. Ensures `schema_migrations` exists.
2. **Bootstrap:** if the journal is empty but `loans.profit_type` already exists, records every on-disk migration as applied (no re-run). Fresh databases run every file in order.
3. Applies only files not yet in `schema_migrations`, then records filename + checksum.

Never edit a shipped migration file. Add a new numbered SQL file instead.

Local / QA:

| Command                             | Target                                           |
| ----------------------------------- | ------------------------------------------------ |
| `bun run db:migrate:pending`        | `DATABASE_URL` (usually local Docker)            |
| `bun run db:migrate:pending:prod`   | `DATABASE_URL_PROD` (Singapore Neon QA)          |
| `bun run db:migrate:pending:vercel` | `DATABASE_URL_VERCEL` (live Vercel prod, manual) |

## GitHub secrets

Create a GitHub Environment named **`production`**, then add **Environment secrets** (not repository secrets):

| Secret              | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `DATABASE_URL`      | Same Neon URL as Vercel **Production** `DATABASE_URL` |
| `VERCEL_TOKEN`      | [Vercel token](https://vercel.com/account/tokens)     |
| `VERCEL_ORG_ID`     | From `vercel link` or project settings                |
| `VERCEL_PROJECT_ID` | From `vercel link` or project settings                |

The CD workflow’s `migrate` and `deploy` jobs use `environment: production` so these secrets resolve.

## Vercel project settings

1. Keep Production env vars (Auth, `DATABASE_URL`, calendar, Resend, etc.).
2. **Git must not deploy Production before migrations.** Repo ships `vercel.json` → `ignoreCommand`: `scripts/deploy/vercel-ignore-git-production-build.sh` skips Git builds when `VERCEL_ENV=production` and branch is `main`. Only [`.github/workflows/cd.yml`](../../.github/workflows/cd.yml) should promote Production (`migrate` → `vercel deploy --prebuilt --prod`). Preview deploys for PRs still build.
3. After merging CD fixes, run **Actions → CD → Run workflow** on `main` once (or push) so pending SQL (`0020`, `0021`, …) applies before the next app deploy.
4. Framework: SvelteKit. Install: `bun install`. Build: `bun run build` (CD uses `vercel build --prod` with project settings).
5. Functions run in Singapore (`sin1`), pinned in `svelte.config.js` and `vercel.json`, next to the Singapore Neon `DATABASE_URL`. Hobby: one region. Confirm with `x-vercel-id` (`sin1::sin1::…`).

## Local emergency deploy

Prefer fixing via a push to `main`. If you must deploy by hand:

```bash
# 1. Migrate the same DB Vercel uses
DATABASE_URL='…prod…' bun run db:migrate:pending --yes

# 2. Deploy
export VERCEL_TOKEN=… VERCEL_ORG_ID=… VERCEL_PROJECT_ID=…
bun run deploy:prod
```

## Rollback

1. **App:** redeploy the previous Vercel production deployment from the Vercel dashboard (or `vercel rollback`).
2. **Schema:** Postgres has no automatic down migrations. Restore from the latest `bun run backup:neon` dump / Neon branch snapshot if a migration corrupted data. Prefer additive, idempotent SQL.

## Related

- Cron backup: `/api/cron/backup` at 06:00 UTC (`vercel.json`)
- Groups cron: `/api/cron/groups` at 00:00 UTC (membership, ACL, Telegram, job drain). Requires `CRON_SECRET`.
- Telegram webhook: after deploy, `bun run telegram:set-webhook` (needs `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_APP_URL`)
- Manual Neon backup: `bun run backup:neon` (uses `DATABASE_URL_PROD` when `DATABASE_URL` is local Docker)
- Agent rule: `.cursor/rules/deployment.mdc`
