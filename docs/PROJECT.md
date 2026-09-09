# Kame Lends — project reference

Architecture index for agents and developers.

## Product

**PawnTracker / Kame Lends** — loan management: loans (Lot Title, OR/CR, Agent), multi-investor allocations, interest periods, investors, borrowers, debts, transactions (feature-flagged), Google Calendar sync, investor portal, contract e-signing.

## Stack

| Layer    | Technology                                 |
| -------- | ------------------------------------------ |
| App      | SvelteKit 2 + Svelte 5                     |
| UI       | Tailwind CSS 4, shadcn-svelte              |
| Forms    | sveltekit-superforms + Zod                 |
| Charts   | LayerChart 2                               |
| Database | Neon Postgres + Drizzle ORM                |
| Auth     | Auth.js (`@auth/sveltekit`), Google OAuth  |
| Hosting  | Vercel (`@sveltejs/adapter-vercel`)        |
| PDF      | `@react-pdf/renderer` (server-only routes) |

### Dashboard UI (authenticated)

When a session exists, `+layout.svelte` adds `dashboard-shell` on `<html>`. That scopes a tighter visual system in `src/lib/styles/dashboard.css`: smaller radius (`--radius: 0.5rem`), reduced page padding (`dashboard-page`), flat cards (`surface-card`), and flush sidebar nav. Public routes (landing `/`, `/signin`, `/sign/[token]`) never get `dashboard-shell`; landing keeps the existing rounded marketing styles in `layout.css`.

## Repo layout

```text
src/routes/           # SvelteKit pages and API (+server.ts)
src/lib/              # Client-safe domain logic, components, composables
src/lib/server/       # DB, auth, calendar, access-control, backups
db/migrations/        # Hand-maintained SQL patches (do not edit shipped files)
drizzle/              # Drizzle Kit output (gitignored)
docs/                 # Guides, workflow, archive
scripts/              # Backup, AI tooling, migration helpers
```

## Environment variables

See `.env.example`. Production uses the same names as before cutover; public vars use SvelteKit `PUBLIC_*` where noted in `.env.example`.

During local SvelteKit QA, `DATABASE_URL` must use the **`dev-sveltekit-migration`** Neon branch (not `develop` or `main`). Auth.js selects `user.role`; stale branches without that column fail Google sign-in with `/auth/error?error=Configuration`.

## Pages

| Route                                             | Notes                                                                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                      | Streams `queryDashboardSummary` then `queryDashboardCharts` (summary skeleton first, chart skeleton below). See [`guides/routes/dashboard.md`](./guides/routes/dashboard.md). |
| `/loans`, `/investors`, `/debts`, `/transactions` | Stream list data; `ListPageSkeleton` paints before queries finish. List cache modes omit heavy relations.                                                                     |

## Performance

- Session is resolved once per request in `hooks.server.ts` (`event.locals.session`). Page loads and API handlers read that instead of calling `auth()` repeatedly.
- Client navigation shows a top progress bar (`NavigationProgress`) until the destination `load` finishes. Dashboard and list routes stream data and show skeletons (`DashboardSummarySkeleton`, `DashboardChartsSkeleton`, `ListPageSkeleton`) before queries finish.
- List queries use slim cache modes (`getCachedLoans(..., 'list')`, `getCachedInvestors(..., 'list')`) that omit heavy relations such as `receivedPayments` on list pages. Detail routes and `getCachedLoans()` default still load full graphs.
- `/investors/[id]` loads only the loans tied to that investor (`inArray(loans.id, investorLoanIds)`) with full nested relations, instead of filtering the user's entire loan cache; this prevents timeouts for investors associated with many loans.
- Overdue status checks run from the dashboard only, deferred 3s after mount so they do not compete with the initial load.
- List/dashboard queries use a process-local TTL cache (`src/lib/server/memory-cache.ts`, 45s). `getCached*`, `queryDashboardSummary`, and `queryDashboardCharts` read through it.
- Mutations call `invalidateLoanData` / `invalidateInvestorData` / etc. in `src/lib/server/cache-invalidation.ts`, which drop matching cache prefixes. In-flight fetches that finish after invalidation are not stored.
- Cache is per Node isolate (local `vite dev` is one process; Vercel instances do not share it). Hover preload is enabled on `body` and sidebar links.
- Local dev against remote Neon (`us-east-1`) adds ~200–300ms per query. Prefer **local Postgres** (`docker-compose.yml`, `bun run db:local:*`) or a Neon region closer to you for day-to-day work.

## API routes

SvelteKit `src/routes/api/**/+server.ts` mirrors legacy `/api/*` paths (loans, investors, borrowers, debts, transactions, signing, cron backup, witnesses, interest periods).

## Auth & roles

- Google sign-in via Auth.js
- Custom UI: `/signin` (`src/routes/signin/`). Auth.js endpoints stay at `/auth/*` (callback, session, csrf). Do not host the custom page at `/auth/signin` (Auth.js owns that path).
- `admin`: full workspace
- `investor`: shared loans via `investors.investor_user_id`

## Database

- Schema: `src/lib/server/db/schema.ts`
- Client: `src/lib/server/db/index.ts` — **local** URLs (`localhost` / `127.0.0.1`) use `postgres.js`; **Neon** URLs use a WebSocket `Pool` (`drizzle-orm/neon-serverless`), not one HTTP round-trip per query.
- Commands: `bun run db:generate`, `db:migrate`, `db:studio`
- **Local dev (low latency):** `bun run db:local:start` → `bun run db:local:push` → set `DATABASE_URL=postgresql://kame_lends:kame_lends@127.0.0.1:5433/kame_lends` in `.env.local`. See [`archive/operations/local-development-database.md`](./archive/operations/local-development-database.md).

### Data safety (prod)

Performance work does **not** delete or reset production data. No new migrations were added for these changes.

| Safe without `lendwave`                                   | Can change prod when `DATABASE_URL` is prod      |
| --------------------------------------------------------- | ------------------------------------------------ |
| `bun dev`, deploy app code                                | `db:migrate`, app writes, overdue status updates |
| `db:local:*` (`local-db-push.sh` → `127.0.0.1:5433` only) | `db:push` (hook-blocked without `lendwave`)      |
| `backup:neon`, `db:studio` (read-mostly)                  |                                                  |

`db:local:push` ignores `.env.local` and cannot target Neon.

## Deployment

- Vercel project: PawnTracker
- Cron: `/api/cron/backup` at 06:00 UTC (`vercel.json`)
- Prod deploy guard: unlock **`lendwave`** (`.cursor/rules/no-prod-deploy.mdc`)
- Backups: `bun run backup:neon`

## Migration history

Completed: [`docs/workflow/done/sveltekit-migration.md`](./workflow/done/sveltekit-migration.md)

Pre-cutover snapshot: `docs/archive/operations/vercel-production-snapshot.md`

## QA / CI

- `bun run check:all` runs `svelte-check`, Prettier + ESLint, and Vitest.
- `bun run build:clean` removes `.svelte-kit` and `.vercel/output`, then runs `svelte-kit sync` and `vite build` to avoid stale-cache and symlink build flakes from `adapter-vercel`.
- Playwright E2E tests run against `bun run dev` on port 4174; the dev server is started and stopped automatically by `playwright.config.ts`.
- E2E CRUD coverage creates and cleans up investors, transactions, borrowings, and loans (including a preselected investor, a borrower, principal, and due date), then verifies the generated signing link loads `/sign/[token]` successfully. It revealed and validated fixes for number-input validation in `TransactionForm.svelte` and `LoanForm.svelte` (`String(value).trim()` instead of assuming a string from `type="number"` inputs).
