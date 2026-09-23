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

### When CD fails

| Signal                            | Where                                           |
| --------------------------------- | ----------------------------------------------- |
| Red **CD** badge in README        | Links to the latest workflow run                |
| GitHub issue labeled `cd-failure` | Opened or commented by the `notify-failure` job |
| Workflow annotation               | `Production CD failed` on the run summary       |

Enable email: GitHub → **Watch** → **Custom** → **Actions** (repo or org).

If CD is red, **do not** hand-deploy app code until quality passes and migrations apply. Schema drift (code shipped without SQL) surfaces as `Internal Error` on `/loans` and `GET /api/health` returns **503** with `pendingFiles` / `missingColumns`.

### Post-deploy smoke test

After Vercel promote, CD polls `GET /api/health` on production (default `https://pawn-tracker.vercel.app`, override with GitHub secret `PRODUCTION_URL`). The endpoint is public on purpose (CD + ops). It returns **200** only when the DB is reachable and migrations/columns match the running build. It lists pending file names and missing columns; treat that as deploy-state metadata, not a secret.

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

| Command                                          | Target                                                     |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `bun run db:migrate:pending`                     | `DATABASE_URL` (usually local Docker)                      |
| `bun run db:migrate:pending:prod`                | `DATABASE_URL_PROD` (Singapore Neon QA)                    |
| `bun run db:migrate:pending:vercel`              | `DATABASE_URL_VERCEL` (live Vercel prod, manual)           |
| `bun run db:migrate:check` / `:prod` / `:vercel` | Read-only: fail if pending SQL or required columns missing |

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

### PDF generation: pdfkit standard fonts

`@react-pdf/renderer`'s core fonts (Helvetica, Helvetica-Bold, ...) load metrics via `pdfkit`'s `#standard-fonts/*.cjs` internal import. `@vercel/nft` (the tracer `@sveltejs/adapter-vercel` uses to decide which `node_modules` files ship with each function) only follows static `.mjs`/`.js` requires and misses this dynamic subpath, so the `.cjs` files are silently dropped from the deployed bundle. Symptom in production: `POST /api/loans/[id]/contract` (or any `/api/export/*` PDF route) returns 500 with `Cannot find module '.../pdfkit/js/standard-fonts/Helvetica.cjs'` — **even though `bun run test` and local dev never hit this**, because they run against the real `node_modules` on disk, not a traced serverless bundle.

Fix: `scripts/deploy/copy-pdfkit-standard-fonts.mjs` runs as part of `bun run build` (`"build": "vite build && node scripts/deploy/copy-pdfkit-standard-fonts.mjs"`), after `@sveltejs/adapter-vercel` has written `.vercel/output/functions/**/*.func`. It recursively finds every traced `node_modules/pdfkit` directory and copies the missing `.cjs` files in, then **re-verifies** every one of those directories has all the files and exits non-zero if any are still missing — the build fails instead of shipping a broken PDF route.

This has shipped broken more than once because the fix lived only in an **uncommitted** working tree while CD kept deploying the last-committed (broken) code. If contract/export PDF downloads 500 in production with this error:

1. Confirm `scripts/deploy/copy-pdfkit-standard-fonts.mjs` and the `"build"` script in `package.json` are committed on `main` (`git log -- scripts/deploy/copy-pdfkit-standard-fonts.mjs`).
2. Confirm CD's `deploy` job actually ran (`bash scripts/deploy/vercel-prod.sh` → `vercel build --prod` invokes `bun run build`, which includes this script).
3. Rebuild locally (`rm -rf .vercel/output && bun run build`) — the script logs `verified N font file(s) in M pdfkit bundle(s)` on success, or exits 1 with the exact missing paths.

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

- Cron backup: `/api/cron/backup` at 06:00 UTC (`vercel.json`). Requires `Authorization: Bearer CRON_SECRET` (fail closed).
- Groups cron: `/api/cron/groups` at 00:00 UTC (membership, ACL, Telegram, job drain). Requires `CRON_SECRET`.
- Decision tree: app-only bug → Vercel rollback. Bad additive SQL → fix-forward new migration. Data corruption → Neon PITR/branch or `pg_restore` onto an isolated target, never edit shipped SQL.
- Telegram webhook: after deploy, `bun run telegram:set-webhook` (needs `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_APP_URL`)
- Manual Neon backup: `bun run backup:neon` (uses `DATABASE_URL_PROD` when `DATABASE_URL` is local Docker)
- Agent rule: `.cursor/rules/deployment.mdc`
