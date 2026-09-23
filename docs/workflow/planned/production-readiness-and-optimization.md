# Production readiness and optimization

**Status:** Planned (checklist and execution guide)  
**Scope:** Make Kame Lends fast, secure, and reliable before and after production cutover.  
**This document:** Planning and verification only. Implementation happens in separate PRs tracked against the items below. Do not treat this file as authorization to change application code.

**Reference (sibling product):** [Kame Homes `production-deployment.md`](https://github.com/sprmke/kame-homes/blob/main/docs/production-deployment.md) (ordered checkout: backup → preview → migrate → secrets → smoke → rollback). Kame Lends uses SvelteKit + Neon + Auth.js + Vercel + R2 + PWA, not Supabase Edge Functions or `pg_cron`. Do not copy Supabase-specific steps.

**Related docs:** [`docs/architecture/deployment.md`](../../architecture/deployment.md) · [`docs/PROJECT.md`](../../PROJECT.md) · [`docs/architecture/pwa.md`](../../architecture/pwa.md) · [`docs/workflow/qa/sveltekit-manual-qa.md`](../qa/sveltekit-manual-qa.md)

---

## How to use this doc

| Symbol       | Meaning                                                    |
| ------------ | ---------------------------------------------------------- |
| **Existing** | Already shipped; preserve and verify                       |
| **Required** | Must complete for production sign-off (or explicit waiver) |
| **Decision** | Product or architecture choice before implementation       |
| **Optional** | Hardening or polish after launch                           |
| **Deferred** | Known gap; scheduled or waived with owner                  |

Track each row with: **Status** (open / done / waived), **Owner**, **Evidence** (PR, test run, runbook note), **Target release**, **Waiver expiry** (if waived).

**One-time launch gates** are P0 items plus the first restore drill and first signed QA. **Recurring release checks** are §15 (every production deploy) and §16 (daily / weekly / monthly).

**Production-ready definition:** All **P0** items closed; all **P1** closed or waived with owner, reason, and expiry; green release candidate on `main`; recorded restore drill; signed QA checklist; production monitoring receiving events; observation window completed after deploy.

**Privacy:** Benchmarks and load tests use anonymized or approved QA data. Do not copy PII, secrets, production row values, or private URLs into logs, CI artifacts, or this document.

---

## 0. Preconditions

| Requirement                                 | Notes                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Repo on `main` for production CD            | [`.github/workflows/cd.yml`](../../../.github/workflows/cd.yml)                                |
| GitHub Environment **`production`** secrets | `DATABASE_URL`, Vercel deploy tokens (see [`deployment.md`](../../architecture/deployment.md)) |
| Vercel Production env                       | Same `DATABASE_URL` as GitHub; region **`sin1`**                                               |
| Local full gate                             | `bun run ci:quality`                                                                           |
| Neon backup scripts                         | `bun run backup:neon`                                                                          |

Do not treat “merge to `main`” as full sign-off until P0/P1 items below are addressed or waived.

---

## 1. Current baseline (Existing — do not regress)

These controls are already in the codebase. Future work should extend them, not duplicate or bypass them.

### Release and schema

| Control                                         | Path                                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CD: quality → migrate → deploy → health smoke   | [`.github/workflows/cd.yml`](../../../.github/workflows/cd.yml)                                                                                                |
| PR quality (precache budget, audit, e2e-smoke)  | [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)                                                                                                |
| Pending SQL runner + journal                    | [`scripts/db/migrate-pending.sh`](../../../scripts/db/migrate-pending.sh)                                                                                      |
| Read-only migration check                       | [`scripts/db/check-migrations-pending.sh`](../../../scripts/db/check-migrations-pending.sh)                                                                    |
| Health: DB + pending migrations + column probes | [`src/routes/api/health/+server.ts`](../../../src/routes/api/health/+server.ts)                                                                                |
| Git production deploy skipped; CD owns prod     | [`vercel.json`](../../../vercel.json), [`scripts/deploy/vercel-ignore-git-production-build.sh`](../../../scripts/deploy/vercel-ignore-git-production-build.sh) |
| PDF pdfkit font copy + build fail if missing    | [`scripts/deploy/copy-pdfkit-standard-fonts.mjs`](../../../scripts/deploy/copy-pdfkit-standard-fonts.mjs)                                                      |

### Auth and authorization

| Control                                          | Path                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Auth.js + Google; session once per request       | [`src/lib/server/auth.ts`](../../../src/lib/server/auth.ts), [`src/hooks.server.ts`](../../../src/hooks.server.ts) |
| HTML route protection (API passes through hooks) | [`src/hooks.server.ts`](../../../src/hooks.server.ts)                                                              |
| Loan / party / debt access                       | [`src/lib/server/access-control.ts`](../../../src/lib/server/access-control.ts)                                    |
| Group view vs manage                             | [`src/lib/server/group-access.ts`](../../../src/lib/server/group-access.ts)                                        |
| R2 read authorization                            | [`src/lib/server/storage/access.ts`](../../../src/lib/server/storage/access.ts)                                    |
| Upload MIME allowlist + 2 MB cap                 | [`src/routes/api/storage/upload/+server.ts`](../../../src/routes/api/storage/upload/+server.ts)                    |
| E2E session mint disabled on production          | [`src/routes/api/e2e/session/+server.ts`](../../../src/routes/api/e2e/session/+server.ts)                          |

### Performance and caching

| Control                                         | Path                                                                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45s process-local cache + in-flight coalescing  | [`src/lib/server/memory-cache.ts`](../../../src/lib/server/memory-cache.ts)                                                                                                        |
| Mutation prefix invalidation                    | [`src/lib/server/cache-invalidation.ts`](../../../src/lib/server/cache-invalidation.ts)                                                                                            |
| List-slim queries, streaming loads (documented) | [`docs/PROJECT.md`](../../PROJECT.md) Performance                                                                                                                                  |
| Client loan detail / party caches (45s)         | [`src/lib/composables/loan-detail-client-cache.ts`](../../../src/lib/composables/loan-detail-client-cache.ts), [`party-options.ts`](../../../src/lib/composables/party-options.ts) |
| Delayed skeletons (~120ms)                      | [`src/lib/composables/use-delayed-flag.svelte.ts`](../../../src/lib/composables/use-delayed-flag.svelte.ts)                                                                        |
| Loan list row patch after save                  | [`src/lib/composables/refresh-loan-list.ts`](../../../src/lib/composables/refresh-loan-list.ts)                                                                                    |
| Neon pool + `sin1`                              | [`src/lib/server/db/index.ts`](../../../src/lib/server/db/index.ts), [`svelte.config.js`](../../../svelte.config.js)                                                               |

### PWA

| Control                                     | Path                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| SW, offline allowlist, never-cache prefixes | [`src/service-worker.ts`](../../../src/service-worker.ts), [`src/lib/pwa/shared.ts`](../../../src/lib/pwa/shared.ts) |
| Purge on sign-out                           | [`src/lib/pwa/purge.ts`](../../../src/lib/pwa/purge.ts)                                                              |
| Precache budget (local `ci:quality`)        | [`scripts/pwa/check-precache-budget.mjs`](../../../scripts/pwa/check-precache-budget.mjs)                            |
| Kill-switch API (`cache-control: no-store`) | [`src/routes/api/pwa/version/+server.ts`](../../../src/routes/api/pwa/version/+server.ts)                            |

### Integrations and jobs

| Control                                         | Path                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Cron routes: fail closed without `CRON_SECRET`  | [`src/lib/server/cron-auth.ts`](../../../src/lib/server/cron-auth.ts), [`api/cron/*`](../../../src/routes/api/cron/) |
| Telegram webhook secret                         | [`src/routes/api/webhooks/telegram/+server.ts`](../../../src/routes/api/webhooks/telegram/+server.ts)                |
| Integration job dedupe / runner / stuck reclaim | [`src/lib/server/jobs/`](../../../src/lib/server/jobs/)                                                              |
| Google Calendar rate-limit retry helper         | [`src/lib/server/google-calendar-config.ts`](../../../src/lib/server/google-calendar-config.ts)                      |
| Push delivery retry / 410 handling              | [`src/lib/server/push/status.ts`](../../../src/lib/server/push/status.ts)                                            |

### Testing (local today)

| Control                                                          | Path                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Vitest (domain, jobs, PWA shared, access)                        | `src/**/*.test.ts`                                                               |
| Playwright: smoke, auth, modals, visual, multi-role, groups, PWA | [`e2e/`](../../../e2e/), [`playwright.config.ts`](../../../playwright.config.ts) |
| Manual QA indexes                                                | [`docs/workflow/qa/`](../qa/)                                                    |

**Not wired in Playwright projects today:** [`e2e/crud-flows.spec.ts`](../../../e2e/crud-flows.spec.ts), [`e2e/advanced-controls.spec.ts`](../../../e2e/advanced-controls.spec.ts). PWA E2E uses [`playwright.pwa.config.ts`](../../../playwright.pwa.config.ts) and is not in GitHub Actions.

---

## 2. P0 release blockers (Required)

Complete or waive with evidence before calling production “signed off.” Status starts **open**.

| ID   | Item                      | Type                | Status | Acceptance criteria                                                                                                                                                                         | Verify                                                                                                                                              | Likely paths                                                                                                                                                     |
| ---- | ------------------------- | ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | **Sign-in policy**        | Decision + Required | done   | Written policy: open Google signup vs invite/allowlist. Threat model for `allowDangerousEmailAccountLinking` documented. Tests match policy.                                                | Review [`auth-sign-in.ts`](../../../src/lib/server/auth-sign-in.ts): today any normalized email is allowed. Update tests in `auth-sign-in.test.ts`. | [`src/lib/server/auth-sign-in.ts`](../../../src/lib/server/auth-sign-in.ts), [`auth.ts`](../../../src/lib/server/auth.ts), [`docs/PROJECT.md`](../../PROJECT.md) |
| P0-2 | **Backup cron auth**      | Required            | done   | In production, missing or wrong `Authorization: Bearer` → **401** always (same as groups/reminders). Vercel cron with secret → **200**.                                                     | `curl -i` without `Authorization` and with wrong bearer must 401 when `VERCEL_ENV=production`. Groups/reminders already fail closed.                | [`src/routes/api/cron/backup/+server.ts`](../../../src/routes/api/cron/backup/+server.ts) — fail closed via `isCronAuthorized`                                   |
| P0-3 | **Legacy signing API**    | Decision + Required | done   | Decide: keep `GET/POST /api/sign/[token]` without session or retire. If kept: rate limits, expiry, audit, minimal payload. If retired: docs only authenticated `/loans/[id]/sign`.          | Anonymous `GET /api/sign/{token}` behavior matches the written decision. UI `/sign/[token]` already requires login.                                 | [`src/routes/api/sign/[token]/+server.ts`](../../../src/routes/api/sign/[token]/+server.ts), [`docs/guides/routes/sign.md`](../../guides/routes/sign.md)         |
| P0-4 | **Error monitoring**      | Required            | done   | Server (and optional client) errors reach a dashboard with release SHA; PII scrubbed; one test alert delivered.                                                                             | Throw a test error on preview; confirm dashboard event has SHA and no email/token/receipt.                                                          | New: `hooks.server.ts` `handleError`; cron/job catch blocks                                                                                                      |
| P0-5 | **Restore drill**         | Required            | waived | Restore latest Neon dump or PITR branch to isolated env; `db:migrate:check` passes; sign-in smoke documented with RPO/RTO and restore approver.                                             | Record elapsed time, dump id, and `bun run db:migrate:check` output. Never restore onto production.                                                 | [`scripts/backup/backup-neon.sh`](../../../scripts/backup/backup-neon.sh), [`scripts/db/sync-prod-to-local.sh`](../../../scripts/db/sync-prod-to-local.sh)       |
| P0-6 | **CI E2E gate**           | Required            | done   | Representative Playwright (smoke + authenticated minimum) on PR or `main` with disposable DB secrets. Never against production.                                                             | Green Actions job; artifacts (trace) on failure. `E2E_AUTH_SECRET` only on the CI/preview env.                                                      | [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)                                                                                                  |
| P0-7 | **Precache budget on CD** | Required            | done   | `check-precache-budget.mjs` runs on `main` CD quality job (not only local `ci:quality`).                                                                                                    | CD log contains budget pass; a budget-breaking commit fails the quality job.                                                                        | [`.github/workflows/cd.yml`](../../../.github/workflows/cd.yml), [`scripts/pwa/check-precache-budget.mjs`](../../../scripts/pwa/check-precache-budget.mjs)       |
| P0-8 | **Performance baseline**  | Required            | done   | Document anonymized row counts (QA), p95 TTFB/payload sizes for `/dashboard`, `/loans`, `GET /api/loans`, and one load/concurrency report at current scale. No optimization until measured. | Attach report (no PII) before Phase 6 query work.                                                                                                   | New `scripts/load/` or external k6; Neon slow-query sample                                                                                                       |

---

## 3. P1 high priority

| ID    | Item                                             | Type                | Status | Acceptance criteria                                                                                                     | Verify                                                                                          | Likely paths                                                                                                      |
| ----- | ------------------------------------------------ | ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| P1-1  | Default-deny API auth helper + public route list | Required            | done   | New routes fail closed; explicit allowlist for health, pwa/version, auth, crons, webhooks, approved token routes        | Add a dummy `/api` route in a branch; unsigned request is 401. Inventory in §6.1 stays current. | `hooks.server.ts` or `src/lib/server/api-auth.ts`                                                                 |
| P1-2  | Security headers + CSP (report-only first)       | Required            | done   | Production `curl -I` shows HSTS, nosniff, referrer-policy, frame-ancestors; CSP report-only without breaking Auth/fonts | `curl -sI https://<prod>/signin` header list. Tighten CSP after a report-only window.           | `vercel.json` or `hooks.server.ts`                                                                                |
| P1-3  | Distributed rate limiting                        | Decision + Required | done   | Limits on sign, AI, backup, export, upload; not in-memory-only on serverless. Decision recorded in §6.3.                | Burst exceeds limit → 429 + `Retry-After`. Second isolate still counts.                         | ADR in §6.3                                                                                                       |
| P1-4  | PDF export server-side data                      | Required            | done   | Export routes load from DB for session user; body cannot inject other users’ rows                                       | POST forged `body.data` rows the user cannot `GET`; PDF must omit them.                         | [`src/routes/api/export/`](../../../src/routes/api/export/) — today trusts `body.data`                            |
| P1-5  | Storage IDOR tests                               | Required            | done   | Vitest or E2E: owner, party, unrelated user, group viewer, prefix traversal, expired signed URL                         | New test file green in CI.                                                                      | [`src/lib/server/storage/access.ts`](../../../src/lib/server/storage/access.ts)                                   |
| P1-6  | Production env inventory                         | Required            | open   | Refresh snapshot from [`.env.example`](../../../.env.example): R2, VAPID, Telegram, Gemini, `PUBLIC_*`, `CRON_SECRET`   | Every name marked Present / N/A / Intentionally unset.                                          | [`docs/archive/operations/vercel-production-snapshot.md`](../../archive/operations/vercel-production-snapshot.md) |
| P1-7  | Scheduled Postgres backup                        | Required            | open   | Weekly (or documented Neon PITR) off-site dump; not only email JSON cron                                                | Restore sample from that dump (ties to P0-5).                                                   | [`scripts/backup/backup-neon.sh`](../../../scripts/backup/backup-neon.sh)                                         |
| P1-8  | Wire orphan E2E specs                            | Required            | done   | `crud-flows`, `advanced-controls` in Playwright projects                                                                | `bun run test:e2e` runs those specs (or documented `--project=`).                               | [`playwright.config.ts`](../../../playwright.config.ts)                                                           |
| P1-9  | Migration health breadth                         | Required            | done   | Health/check scripts cover release-critical columns beyond current `loan_investors.profit_*` probes                     | Missing a listed column → health **503**.                                                       | [`src/lib/server/migration-status.ts`](../../../src/lib/server/migration-status.ts)                               |
| P1-10 | Checksum drift detection                         | Required            | done   | Edited shipped migration file fails `db:migrate:check`                                                                  | Change a shipped SQL checksum locally; check exits non-zero.                                    | [`scripts/db/check-migrations-pending.sh`](../../../scripts/db/check-migrations-pending.sh)                       |
| P1-11 | Telegram webhook post-deploy                     | Required            | open   | Checklist step when `PUBLIC_APP_URL` changes                                                                            | After URL change, `bun run telegram:set-webhook` recorded.                                      | [`scripts/telegram/set-webhook.ts`](../../../scripts/telegram/set-webhook.ts)                                     |
| P1-12 | `/api/health` exposure                           | Decision            | open   | Accept public migration metadata or restrict (IP/internal token)                                                        | Decision written in [`deployment.md`](../../architecture/deployment.md).                        | [`src/routes/api/health/+server.ts`](../../../src/routes/api/health/+server.ts)                                   |

---

## 4. P2 medium

| ID    | Item                                      | Type     | Status | Notes                                                                                           |
| ----- | ----------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------- |
| P2-1  | Staging environment                       | Optional | open   | Vercel preview + Neon branch + cron smoke                                                       |
| P2-2  | Dependabot / Renovate + `bun audit` in CI | Required | open   | Supply chain; fail on high/critical                                                             |
| P2-3  | Mobile 375px automated smoke              | Required | open   | Sheet/modals/tab bar                                                                            |
| P2-4  | Accessibility (axe) on critical flows     | Required | open   | Settings, loan form, sign-in                                                                    |
| P2-5  | Data retention policy                     | Required | open   | Jobs prune 14d/180d today; document user deletion                                               |
| P2-6  | R2 DR                                     | Required | open   | [`docs/archive/operations/object-storage-r2.md`](../../archive/operations/object-storage-r2.md) |
| P2-7  | Cron/log alerts                           | Required | open   | Vercel log drain or synthetic cron check                                                        |
| P2-8  | Expanded post-deploy smoke                | Required | open   | PWA version, sign-in 200, security headers, `/api/e2e/session` 404 on prod                      |
| P2-9  | CSRF / Origin checks on mutating APIs     | Required | open   | `hooks.server.ts`; must not break Google OAuth callback                                         |
| P2-10 | Strip `details` from prod JSON errors     | Required | open   | Grep `details:` under `src/routes/api`; log server-side only                                    |
| P2-11 | Central request/body schemas              | Required | open   | Zod (or shared parsers) + max body size on mutating APIs                                        |
| P2-12 | File magic-byte / decompression limits    | Required | open   | Do not trust `Content-Type` alone on uploads                                                    |

---

## 5. P3 polish

| ID   | Item                                                           | Status |
| ---- | -------------------------------------------------------------- | ------ |
| P3-1 | Formal on-call / incident doc under `docs/archive/operations/` | open   |
| P3-2 | Browser matrix (Safari iOS PWA, Android Chrome) sign-off       | open   |
| P3-3 | Visual parity Linux CI strategy (darwin baselines today)       | open   |
| P3-4 | Bound memory-cache Map size + hit/miss metrics                 | open   |
| P3-5 | Self-host fonts for LCP                                        | open   |

---

## 6. Security and privacy checklist

### 6.1 API surface inventory (Required audit)

**Existing pattern:** HTML protected in [`hooks.server.ts`](../../../src/hooks.server.ts); `/api/*` is **not** gated there. Each handler calls [`getSession`](../../../src/lib/server/session.ts) or a secret check.

Keep this inventory current when adding routes (~79 `+server.ts` files today).

| Class                                       | Routes                                        | Auth today                                                                 | Cache               | Rate-limit tier       |
| ------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- | ------------------- | --------------------- |
| Public ops                                  | `/api/health`, `/api/pwa/version`             | none                                                                       | no-store on version | none                  |
| Auth.js                                     | `/auth/*`                                     | Auth.js                                                                    | never cache         | burst                 |
| Cron                                        | `/api/cron/backup`, `/groups`, `/reminders`   | Bearer `CRON_SECRET` (backup fail-open if unset)                           | never               | n/a (Vercel cron)     |
| Webhook                                     | `/api/webhooks/telegram`                      | `x-telegram-bot-api-secret-token`                                          | never               | webhook abuse         |
| Legacy token                                | `/api/sign/[token]`                           | token only, no session                                                     | never               | high                  |
| E2E                                         | `/api/e2e/session`                            | `E2E_AUTH_SECRET`; disabled on production                                  | never               | high                  |
| User backup                                 | `/api/backup`                                 | session; `scope=all` owner-only                                            | never               | high                  |
| Export PDF                                  | `/api/export/loans\|investors\|transactions`  | session; **trusts `body.data`**                                            | never               | high                  |
| Storage                                     | `/api/storage/upload`, `upload-url`, `object` | session + [`canReadStorageRef`](../../../src/lib/server/storage/access.ts) | never               | high                  |
| AI                                          | `/api/ai/receipt-extraction`                  | session + storage ACL                                                      | never               | high                  |
| Push                                        | `/api/push/*`                                 | session                                                                    | never               | medium (`/test` high) |
| Loans / parties / debts / groups / payments | remaining `/api/*`                            | session + domain ACL                                                       | private             | list GETs medium      |

**Proposed public allowlist (P1-1):** `/api/health`, `/api/pwa/version`, `/auth/*`, `/api/cron/*` (secret), `/api/webhooks/*` (secret), `/api/sign/[token]` only if P0-3 keeps it, `/api/e2e/*` only off production.

### 6.2 Authorization matrix (Required tests)

For loans, storage, backup, signing, groups, party-profile, export PDF:

| Actor                         | Expected                                          |
| ----------------------------- | ------------------------------------------------- |
| Anonymous                     | 401 or public-only endpoints                      |
| Unrelated signed-in user      | 403/404                                           |
| Investor / borrower / witness | Read-only where designed                          |
| Group member                  | Group view projection; no payment/contract bypass |
| Owner                         | Full mutate on owned CRM                          |
| Platform owner email          | Backup `scope=all` only                           |
| Expired / invalid token       | 404/410, no contract listing                      |

**Existing tests:** [`e2e/multi-role-access.spec.ts`](../../../e2e/multi-role-access.spec.ts), [`src/lib/loan-access-compute.test.ts`](../../../src/lib/loan-access-compute.test.ts), [`src/lib/server/backup-access.test.ts`](../../../src/lib/server/backup-access.test.ts).

### 6.3 Rate limiting (Decision record)

| Option                      | Latency | Cost          | Fail mode                       | Privacy           | Hobby-plan notes        |
| --------------------------- | ------- | ------------- | ------------------------------- | ----------------- | ----------------------- |
| Vercel Firewall / WAF rules | Edge    | Plan limits   | Coarse; may miss app-level keys | IP-based          | Hobby WAF is limited    |
| Upstash Redis / similar     | Low     | Extra vendor  | Shared across isolates          | Store hashed keys | Fits serverless         |
| Postgres counters           | Medium  | No new vendor | Adds DB load; needs cleanup     | Store hashed keys | Competes with app quota |

**Required:** Do not rely on in-process Maps alone on Vercel (isolates do not share memory). **Fail closed** on limit exceeded (429 + `Retry-After`). Decide after P0-8 cost/latency notes; default lean is **Vercel WAF for coarse IP** plus **Postgres counters** if no new vendor is wanted.

**Surfaces:** `/api/sign/*`, `/api/ai/receipt-extraction`, `/api/backup`, `/api/export/*`, `/api/storage/upload*`, `/api/push/test`, auth callback burst, Telegram webhook.

### 6.4 CSRF and cookies

SvelteKit CSRF covers form actions. Cookie-authenticated JSON `POST`/`PATCH`/`DELETE` need an explicit **Origin / Referer** check (P2-9) that allows the production origin and Auth.js OAuth callback. `trustHost: true` in [`auth.ts`](../../../src/lib/server/auth.ts) stays a host-header risk; lock `AUTH_URL` / `PUBLIC_APP_URL` in production.

### 6.5 Headers and CSP

Roll out **report-only CSP** first (Google Fonts, Auth.js, R2 presigned hosts, push). Then enforce. Always ship: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options` / `frame-ancestors`, `Permissions-Policy`.

### 6.6 Input, files, and errors

| Control                  | Today                                | Required                                             |
| ------------------------ | ------------------------------------ | ---------------------------------------------------- |
| Page forms               | sveltekit-superforms + Zod           | Keep                                                 |
| Most `+server.ts` bodies | Ad hoc `request.json()`              | Shared Zod + max bytes (P2-11)                       |
| Upload MIME              | Content-Type allowlist, 2 MB         | Magic-byte check + decompression bomb limit (P2-12)  |
| PDF export               | Client-supplied `body.data`          | Server-side owned rows (P1-4)                        |
| JSON errors              | Some return `details: error.message` | Prod: generic client message; log internally (P2-10) |

Do not log emails, tokens, signatures, government IDs, receipts, contract HTML, or raw third-party bodies.

### 6.7 Secrets (Required verification)

Canonical list: [`.env.example`](../../../.env.example) and [`docs/PROJECT.md`](../../PROJECT.md).

| Must be set in Vercel Production                           | Must NOT be on Production               |
| ---------------------------------------------------------- | --------------------------------------- |
| `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_*`             | `E2E_AUTH_SECRET`, `E2E_USER_EMAIL`     |
| `PUBLIC_APP_URL`, `CRON_SECRET` (all crons)                | `DATABASE_URL_LOCAL`, placeholder URLs  |
| Optional: R2, VAPID, Resend, Telegram, Gemini, calendar SA | GitHub-only `VERCEL_*` tokens in Vercel |

**Optional:** Boot-time validator when `VERCEL_ENV=production` (`src/lib/server/env-production.ts` — to be added).

### 6.8 Supply chain (Required)

- [ ] `bun audit` (or Snyk) in CI; fail on high/critical unfixed
- [ ] Dependabot/Renovate for lockfile
- [ ] Secret scanning on repo
- [ ] Least privilege on GitHub `production` environment and Vercel tokens
- [ ] License review on new runtime dependencies

### 6.9 Retention and deletion (Required policy, P2-5)

| Data                                    | Today                               | Policy to write                |
| --------------------------------------- | ----------------------------------- | ------------------------------ |
| Loans, payments, parties                | Indefinite                          | Business retention + export    |
| Identity images / signatures / receipts | Postgres data URL or R2             | Align with R2 lifecycle        |
| Auth sessions                           | Auth.js adapter tables              | Session TTL                    |
| `integration_jobs`                      | Groups cron prunes done jobs (~14d) | Keep                           |
| `group_notification_log` / push log     | ~180d prune                         | Keep                           |
| Email JSON backups                      | Inbox retention unknown             | Off-inbox encrypted store      |
| User deletion request                   | Not supported                       | Document “not yet” or add path |

---

## 7. Cache architecture and invalidation

### 7.1 Layer matrix

| Layer                              | Key shape                                          | Viewer                                            | TTL       | Max size                  | Stale OK           | Invalidators                                                                      | Account switch | Offline         | Observe    |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------- | --------- | ------------------------- | ------------------ | --------------------------------------------------------------------------------- | -------------- | --------------- | ---------- |
| SvelteKit `depends('app:*')`       | route + search                                     | session                                           | nav       | —                         | until invalidate   | `invalidate('app:…')` or `invalidateAll()`                                        | full reload    | N/A             | —          |
| Server `remember()`                | `loans:`, `dashboard:`, `investors:`, `groups:`, … | per isolate, not user-shared if key includes user | 45s       | unbounded Map (**P3-4**)  | 45s cross-instance | [`cache-invalidation.ts`](../../../src/lib/server/cache-invalidation.ts) prefixes | N/A            | N/A             | none today |
| Client loan detail                 | loan id                                            | tab                                               | 45s       | few loans                 | 45s                | clear on save                                                                     | tab close      | N/A             | —          |
| Client party options               | global tab                                         | tab                                               | 45s       | small                     | 45s                | clear on contact save                                                             | tab close      | N/A             | —          |
| PWA `kl-pages` / `kl-data` / fonts | normalized URL (strip `x-sveltekit-invalidated`)   | `kl:uid`                                          | SW policy | precache budget 12800 KiB | until purge        | never-cache prefixes; purge on sign-out                                           | **must purge** | yes (allowlist) | PWA e2e    |
| R2 presigned                       | object key                                         | authz at mint                                     | ~5 min    | n/a                       | URL expiry         | remint                                                                            | new session    | no              | —          |
| HTTP CDN                           | hashed static                                      | public                                            | long      | n/a                       | deploy             | new hash                                                                          | n/a            | precache        | —          |

**Decision:** Is 45s cross-instance staleness acceptable for multi-admin? If no, design distributed tag/version **after** P0-8. Do not add Redis solely for cache until measured.

**Known gap (Required):** [`invalidateWitnessData()`](../../../src/lib/server/cache-invalidation.ts) drops `witnesses:` only — not `loans:` / `dashboard:`.

**Known gap (Required):** Broad `invalidateAll()` in:

- [`LoanDetailClient.svelte`](../../../src/lib/components/loans/LoanDetailClient.svelte)
- [`LoanDetailContent.svelte`](../../../src/lib/components/loans/LoanDetailContent.svelte)
- [`LoanBulkActionBar.svelte`](../../../src/lib/components/loans/LoanBulkActionBar.svelte)
- [`InvestorDetailContent.svelte`](../../../src/lib/components/investors/InvestorDetailContent.svelte)
- [`investors/[id]/+page.svelte`](../../../src/routes/investors/[id]/+page.svelte)

Replace with targeted `invalidate('app:loans')` (and related keys) where correctness allows.

**HTTP policy:** Auth, backup, storage, contract POST, crons, personalized JSON → `private, no-store`. `GET /api/pwa/version` already `no-store`. Static hashed assets → immutable.

Align with [`shared.ts`](../../../src/lib/pwa/shared.ts) `NEVER_CACHE_PREFIXES` and `OFFLINE_API_READS` (PII on disk, unencrypted).

### 7.2 Cache correctness tests (Required)

- [ ] Create/update/delete loan → list + dashboard within SLA
- [ ] Payment / interest period → detail + list patch
- [ ] Party rename (including witness) → loan list names
- [ ] Contract / signing change → signing GET not stale past TTL
- [ ] Group membership change → hub + loan projection
- [ ] Calendar job complete → UI does not require full reload
- [ ] Push preference save → next cron uses new flags
- [ ] Sign-out / account switch → `kl-*` empty; user B never sees user A offline
- [ ] In-flight `remember()` after invalidation does not store stale (**Existing:** version bump)
- [ ] Kill-switch fetch failure does not self-destruct SW (**Existing** intent)

---

## 8. Database and query performance

**Rule:** Measure (P0-8) before new indexes or large refactors. New SQL only as a **new** file under `db/migrations/`.

### 8.1 Inventory (Required once per cycle; anonymized)

| Metric                                        | Source         |
| --------------------------------------------- | -------------- |
| Loans per owner (p50/p95)                     | QA Neon counts |
| Investors / payments / periods per loan (p95) | same           |
| Groups, pending `integration_jobs`            | same           |

### 8.2 Hot paths (Required `EXPLAIN (ANALYZE, BUFFERS)`)

| Query / handler                                  | File                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Owned loan list + `createdAt` order              | [`src/lib/server/cached-data.ts`](../../../src/lib/server/cached-data.ts)                                 |
| Dashboard summary + charts (duplicate iteration) | [`src/lib/server/dashboard-data.ts`](../../../src/lib/server/dashboard-data.ts)                           |
| Check overdue (full nested graphs)               | [`src/routes/api/loans/check-overdue/+server.ts`](../../../src/routes/api/loans/check-overdue/+server.ts) |
| Investor detail (duplicate loan load)            | [`src/routes/investors/[id]/+page.server.ts`](../../../src/routes/investors/[id]/+page.server.ts)         |
| Loan detail SSR (`includeContract: true`)        | [`src/routes/loans/[id]/+page.server.ts`](../../../src/routes/loans/[id]/+page.server.ts)                 |
| Group cron sequential recompute                  | [`src/routes/api/cron/groups/+server.ts`](../../../src/routes/api/cron/groups/+server.ts)                 |
| Layout `getNavCapabilities` (8 probes)           | [`src/routes/+layout.server.ts`](../../../src/routes/+layout.server.ts)                                   |

**Existing indexes:** [`db/migrations/0010_query_performance_indexes.sql`](../../../db/migrations/0010_query_performance_indexes.sql) and follow-ons. Candidates after EXPLAIN only: `loans.status`, composite `(user_id, created_at DESC)`.

### 8.3 Optimization backlog (after baseline)

| Item                                                     | Priority | Acceptance                         |
| -------------------------------------------------------- | -------- | ---------------------------------- |
| Slim check-overdue query                                 | P0/P1    | p95 ≤ 3s at max owned loans        |
| Defer contract on `/loans/[id]` SSR                      | P1       | Smaller `__data.json`; match modal |
| Pagination or server date window for lists + offline API | P1       | Payload budget met                 |
| Remove duplicate investor-detail fetch                   | P1       | One loan graph                     |
| Dashboard shared pass for summary+charts                 | P2       | Less CPU on same rows              |
| Nav caps `remember('nav:caps:${userId}')`                | P2       | Layout p95 improved                |
| Evidence-based indexes                                   | P1       | New migration file only            |
| Pool / timeout / deadlock review                         | P1       | 0 exhaustion in soak               |

**Existing pool:** Neon WebSocket `Pool` `max: 10`, reuse on `globalThis` ([`db/index.ts`](../../../src/lib/server/db/index.ts)). Confirm `x-vercel-id` contains `sin1`.

Slow-query threshold (proposed): log / alert p95 > 1s on list/dashboard; review bloat monthly (§16).

---

## 9. Frontend speed and interactivity

### 9.1 Targets (confirm after P0-8)

| Metric                      | Initial target (p75) | Measure                            |
| --------------------------- | -------------------- | ---------------------------------- |
| LCP                         | ≤ 2.5s               | RUM / Lighthouse; mobile + desktop |
| INP                         | ≤ 200ms              | RUM                                |
| CLS                         | ≤ 0.1                | RUM                                |
| TTFB (authenticated detail) | ≤ 800ms              | RUM / Server-Timing                |

Measure separately: cold start, warm navigation, cache hit, offline revisit, post-mutation.

### 9.2 Payload and bundle budgets

| Route                      | Target (max QA scale)                  |
| -------------------------- | -------------------------------------- |
| `/dashboard` `__data.json` | ≤ 500 KB or split                      |
| `/loans` `__data.json`     | ≤ 1 MB or paginate                     |
| `GET /api/loans`           | ≤ 1 MB, p95 ≤ 2s cold                  |
| Precache client + static   | ≤ 12800 KiB (**Existing** local check) |

Keep ApexCharts dynamic ([`ApexChart.svelte`](../../../src/lib/components/charts/ApexChart.svelte)) and `@react-pdf/*` server-only / `split: true`.

### 9.3 UX and media checks

- [ ] Skeleton delay ~120ms
- [ ] Loan list row patch without full reload
- [ ] Light modals mount immediately ([`overlay-performance`](../../../.cursor/rules/overlay-performance.mdc))
- [ ] 375px: sheets, not dropdowns ([`mobile-native-ui`](../../../.cursor/rules/mobile-native-ui.mdc))
- [ ] Overlay open < 100ms shell; no `backdrop-blur` on dashboard scrims
- [ ] Images / fonts / receipt thumbs: dimensions, compression, lazy load, no CLS
- [ ] Navigation cancel under Slow 3G does not leave stuck skeletons

---

## 10. Reliability, jobs, and integrations

| Integration     | Idempotency / retry                                                                | Outage behavior                  | Verify                                                                      |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Google Calendar | `dedupe_key` while pending/running; rate-limit retry                               | Loan CRUD continues; job retries | Job rows + `SyncCalendarButton`                                             |
| Telegram        | Webhook secret; 429 `retry_after`                                                  | CRUD continues                   | [`telegram/api.ts`](../../../src/lib/server/telegram/api.ts)                |
| Resend          | Signing + backup email; send failure does not roll back loan create (**Existing**) | CRUD continues                   | Cron / loan-create logs                                                     |
| Web Push        | `push_notification_log` dedupe                                                     | CRUD continues                   | [`push/status.ts`](../../../src/lib/server/push/status.ts)                  |
| Gemini / Groq   | Key rotation; never throw to client (**Existing**)                                 | Manual receipt entry             | [`receipt-extraction.ts`](../../../src/lib/server/ai/receipt-extraction.ts) |
| R2              | Private bucket; short presign                                                      | Fallback data URLs if unset      | upload + object GET                                                         |

**Crons (UTC):** backup `06:00`, groups `00:00`, reminders `01:00` — [`vercel.json`](../../../vercel.json). Groups/reminders **require** `CRON_SECRET`. Runner: `maxJobs` 25, ~50s deadline ([`jobs/runner.ts`](../../../src/lib/server/jobs/runner.ts)).

**Required tests / ops:**

- [ ] Duplicate cron fire does not double-send (dedupe / `onConflictDoNothing`)
- [ ] Overlapping deploy + cron: jobs reclaim stuck rows
- [ ] 2× group count still finishes under `maxDuration`
- [ ] Never blindly retry permanent 4xx
- [ ] Alert when `drain.failed` > 0 or cron 401/500 repeats
- [ ] Re-register Telegram webhook after `PUBLIC_APP_URL` change (P1-11)

Circuit-breaker policy (to write per integration): timeout, max attempts, jitter, dead-letter visibility. Default: retry 429/5xx with cap; fail open for optional side effects.

---

## 11. Observability and incident response

| Signal                               | Status              | Action                                                                                                                                  |
| ------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| CD failure GitHub issue `cd-failure` | **Existing**        | Link to [`deployment.md`](../../architecture/deployment.md)                                                                             |
| Structured logs                      | Partial `console.*` | JSON: route, SHA, duration, correlation id; no PII                                                                                      |
| Error tracking                       | **Required** P0-4   | Sentry or equivalent; scrub PII                                                                                                         |
| Metrics                              | **Required**        | Request count/latency/5xx, cache hit/miss, DB latency, pool errors, job age/fail, cron result, PWA update fail, push, third-party quota |
| Synthetics                           | **Required** P2-8   | Health, `/signin` 200, `/api/pwa/version`, prod `/api/e2e/session` 404. No production credentials in synthetics.                        |
| Runbook                              | **Required** P3-1   | `docs/archive/operations/incident-response.md`                                                                                          |

### 11.1 Alert table (draft)

| Alert           | Threshold                        | Severity | Owner         | Runbook            |
| --------------- | -------------------------------- | -------- | ------------- | ------------------ |
| Health 503      | 2 consecutive CD/synthetic fails | P1       | release owner | deployment.md      |
| 5xx rate        | > 2% for 15 min                  | P1       | on-call       | incident doc       |
| Cron 401/500    | 2 consecutive scheduled runs     | P1       | on-call       | cron section       |
| Job `failed`    | > 0 for 1h                       | P2       | on-call       | `integration_jobs` |
| Backup not sent | missed daily window              | P1       | on-call       | backup runbook     |
| Do not page     | Single transient 5xx             | —        | —             | —                  |

**Incident steps:** detect → assign → contain (PWA kill-switch / disable integration) → choose rollback vs fix-forward → preserve logs → validate health + smoke → postmortem.

---

## 12. Backups and disaster recovery

| Mechanism               | Purpose                        | Path                                                                                      |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| Daily email JSON cron   | Per-owner export (not full DR) | [`src/routes/api/cron/backup/+server.ts`](../../../src/routes/api/cron/backup/+server.ts) |
| Manual Neon dump        | Postgres DR                    | [`scripts/backup/backup-neon.sh`](../../../scripts/backup/backup-neon.sh)                 |
| User-initiated download | Operator backup                | [`src/routes/api/backup/+server.ts`](../../../src/routes/api/backup/+server.ts)           |
| Neon PITR / branch      | Fast schema/data rewind        | Neon dashboard; document in deployment.md                                                 |

### 12.1 Decision tree

```text
App-only bug, schema OK
  → Vercel rollback previous production deployment

Bad additive migration, data intact
  → Fix-forward new SQL file (never edit shipped migrations)

Data corruption or failed destructive SQL
  → Neon PITR / branch restore to isolated target, verify, then cut over
  → or pg_restore from encrypted off-site dump (P1-7)

R2 objects missing
  → Object lifecycle / replica (P2-6); Postgres refs must still resolve
```

**Required:**

- [ ] Record RPO / RTO and restore approver
- [ ] Fresh backup before high-risk migrations
- [ ] Restore only to isolated local/QA, then `db:migrate:check` + sign-in smoke
- [ ] Encrypted off-site retention (proposed 30/90 days)
- [ ] R2 keys stay consistent with Postgres rows

---

## 13. CI/CD and release gates

### 13.1 Current vs target

| Step                | PR CI | CD main | Local `ci:quality`                       |
| ------------------- | ----- | ------- | ---------------------------------------- |
| check / lint / unit | yes   | yes     | yes                                      |
| build + pdfkit copy | yes   | yes     | yes                                      |
| precache budget     | no    | no      | yes                                      |
| Playwright E2E      | no    | no      | partial (`test:e2e:pwa` in `ci:quality`) |
| `bun audit`         | no    | no      | no                                       |
| migrate then deploy | n/a   | yes     | n/a                                      |

**Target:** One canonical script (or documented subset) so local, PR, and CD do not drift. Keep `cancel-in-progress: false` on CD migrate. E2E uses disposable Neon branch or Docker, **never** production `DATABASE_URL`.

### 13.2 Post-deploy smoke (extend CD)

- [ ] `GET /api/health` 200 (**Existing**)
- [ ] `GET /signin` 200
- [ ] `GET /api/pwa/version` 200, `cache-control: no-store`
- [ ] `POST /api/e2e/session` 404 on production
- [ ] Security header spot-check after P1-2
- [ ] Controlled PDF canary on a test loan (not in public logs)

### 13.3 Per-release record (Required)

| Field                  | Value |
| ---------------------- | ----- |
| Git SHA                |       |
| Migrations applied     |       |
| Env checklist signed   |       |
| Tests run              |       |
| Operator               |       |
| Rollback deployment id |       |
| Observation window end |       |

Prohibit routine `vercel --prod` that skips migrate-then-deploy.

---

## 14. Test and QA matrix

| Area                                             | Automated                | Manual                                                            |
| ------------------------------------------------ | ------------------------ | ----------------------------------------------------------------- |
| Loan money / dates                               | Vitest + loan-domain     | spot calc                                                         |
| Access matrix                                    | multi-role E2E + unit    | [`qa/multi-role-loan-access.md`](../qa/multi-role-loan-access.md) |
| Cache invalidation map                           | unit (to add)            | —                                                                 |
| API contract (auth, 403, body limits, CSRF, 429) | to add                   | curl matrix                                                       |
| Loans CRUD + PDF                                 | `crud-flows` (wire P1-8) | [`qa/sveltekit-manual-qa.md`](../qa/sveltekit-manual-qa.md)       |
| Groups + Telegram                                | `loan-groups-v2`         | [`qa/loan-groups-v2.md`](../qa/loan-groups-v2.md)                 |
| PWA install/offline/purge/kill-switch            | `test:e2e:pwa`           | [`qa/pwa-manual.md`](../qa/pwa-manual.md)                         |
| Visual desktop                                   | visual-parity (darwin)   | 1440×900                                                          |
| Mobile 375px                                     | P2-3                     | sheet/menu pass                                                   |
| a11y keyboard / reduced motion                   | P2-4 axe                 | sign-in, loan form                                                |
| Browsers                                         | Chromium CI              | Safari iOS PWA, Android Chrome                                    |
| Resilience                                       | to add                   | Slow 3G, offline POST 503, third-party timeout, duplicate submit  |
| Load / soak                                      | **Required** P0-8        | 1× and 2× scale; p50/p95/p99, error rate, pool                    |

**Consolidated sign-off (Required):** One release table (owner + date) covering Auth, loans CRUD, PDF, calendar, groups/Telegram, push, backup download, mobile 375px.

---

## 15. Production launch checklist (ordered)

Mirror Kame Homes §0–§12 for SvelteKit / Vercel / Neon.

1. **Scope** — Release notes, owners, rollback Vercel deployment id, comms if needed.
2. **Secrets audit** — Vercel Production + GitHub `production` match [`.env.example`](../../../.env.example); `CRON_SECRET` set; no E2E secrets on prod.
3. **Region** — Neon `ap-southeast-1`; Vercel `sin1`; confirm `x-vercel-id`.
4. **Backup / DR** — Fresh `backup:neon` or Neon snapshot; restore drill within policy window.
5. **Quality gate** — `bun run ci:quality` green on release commit (or CI equivalent) plus dependency scan.
6. **Migrations** — `db:migrate:check:vercel` read-only; review pending SQL, locks, duration; plan fix-forward only.
7. **Deploy** — Push/merge to `main` only (CD): quality → migrate → build → deploy.
8. **Post-deploy smoke** — §13.2 plus critical-path click-through.
9. **Integrations** — Calendar sample; Telegram webhook if URL changed; push test device; Resend if enabled; R2 preview; AI fallback.
10. **Observe** — 24–48h: 5xx, latency, failed jobs, Web Vitals, cron logs.
11. **Sign-off** — Update Status columns; waived P1 items have expiry; close rollback window.

---

## 16. Recurring operations

| Cadence         | Tasks                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Daily**       | Health 200; cron success; error dashboard; backup cron `sent`; failed jobs                                                  |
| **Weekly**      | Slow queries (Neon); dependency alerts; DB/R2 growth; third-party quota; spot-check email backup                            |
| **Monthly**     | Restore drill or Neon restore test; secrets/access review; retention execution; PWA/mobile/browser smoke; DR contact review |
| **Per release** | §15; invalidation review for every new mutation; schema evidence; docs sync; observation window                             |

---

## 17. Implementation phases

Use separate PRs. Update Status columns as items close. Infrastructure vendors stay **Decision** until P0-8 and cost constraints are known.

| Phase                   | Depends on                       | Work                                                                   | Likely files                                                             | Tests / evidence                             | Rollout / rollback                     | Docs                                |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- | -------------------------------------- | ----------------------------------- |
| **1 Measure**           | none                             | P0-8 baseline, §6.1 inventory, P1-6 env snapshot                       | `scripts/load/` (optional), snapshot md                                  | Payload sizes, EXPLAIN samples (anonymized)  | n/a                                    | this file, PROJECT.md Performance   |
| **2 P0 security / ops** | Phase 1 for sign-in product call | P0-1..P0-3, P0-2 cron auth, P0-4 monitoring, P0-5 restore              | `auth-sign-in.ts`, `cron/backup/+server.ts`, `hooks.server.ts`, sign API | Cron 401 tests; sign-in tests; restore notes | Feature-flag sign-in if locking signup | PROJECT.md, sign.md, deployment.md  |
| **3 CI parity**         | Phase 2 secrets strategy         | P0-6, P0-7, P1-8, P2-2 audit                                           | `ci.yml`, `cd.yml`, `playwright.config.ts`                               | Actions green                                | Revert workflow                        | deployment.md                       |
| **4 DR**                | Phase 2 restore                  | P1-7, P2-6, decision tree                                              | backup scripts, r2 ops doc                                               | Restore from scheduled dump                  | n/a                                    | deployment.md, object-storage-r2.md |
| **5 Cache**             | Phase 1                          | Witness prefixes, `invalidateAll` reduction, HTTP headers, cache tests | `cache-invalidation.ts`, loan/investor detail components, hooks          | §7.2                                         | Revert invalidation if stale bugs      | PROJECT.md Performance              |
| **6 Query + payload**   | Phase 1 numbers                  | check-overdue, contract deferral, pagination, indexes                  | overdue handler, loan detail load, new migration                         | EXPLAIN + p95                                | Additive indexes only                  | PROJECT.md, loans-detail.md         |
| **7 Edge security**     | Phase 2–3                        | Headers, CSP, rate limits, CSRF, PDF server load, Zod, IDOR tests      | hooks, export routes, storage tests                                      | curl headers, 429, IDOR                      | CSP report-only first                  | PROJECT.md                          |
| **8 UX + PWA + a11y**   | Phase 6 budgets                  | RUM, 375px, axe, browser matrix                                        | layout, e2e                                                              | Lighthouse/RUM                               | RUM-only rollback                      | pwa.md, route guides                |
| **9 Load + launch**     | All P0; ≥80% P1                  | Soak 1×/2×, §15 dry run                                                | load scripts                                                             | Pass/fail thresholds                         | Abort launch                           | this file §18                       |

---

## 18. Sign-off tracker (copy per release)

| Gate                     | Status | Owner | Evidence | Waiver expiry |
| ------------------------ | ------ | ----- | -------- | ------------- |
| All P0 closed or waived  |        |       |          |               |
| P1 ≥ 80% closed          |        |       |          |               |
| Restore drill ≤ 90 days  |        |       |          |               |
| Monitoring live          |        |       |          |               |
| §15 checklist complete   |        |       |          |               |
| QA consolidated sign-off |        |       |          |               |

---

## Changelog

| Date       | Change                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-23 | Initial plan from Kame Homes production checklist pattern + Kame Lends codebase audit                                                                                               |
| 2026-09-23 | Implemented P0/P1 in-repo: fail-closed crons, API default-deny, headers, Postgres rate limits, owned PDF export, CI precache/audit/smoke, checksum health, cache/invalidation fixes |
