# Kame Lends — project reference

Architecture index for agents and developers.

## Product

**PawnTracker / Kame Lends** — loan management: loans (Lot Title, OR/CR, Agent), multi-investor allocations, interest periods, investors, borrowers, debts, transactions (feature-flagged), Google Calendar sync, investor portal, contract e-signing.

## Stack

| Layer    | Technology                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| App      | SvelteKit 2 + Svelte 5                                                                                                  |
| UI       | Tailwind CSS 4, shadcn-svelte, Figtree + IBM Plex Mono                                                                  |
| Forms    | sveltekit-superforms + Zod                                                                                              |
| Charts   | SVG donuts and CSS ranking tracks in `src/lib/components/charts/`. ApexCharts 7 only for cashflow (`ApexChart.svelte`). |
| Database | Neon Postgres + Drizzle ORM                                                                                             |
| Auth     | Auth.js (`@auth/sveltekit`), Google OAuth                                                                               |
| Hosting  | Vercel (`@sveltejs/adapter-vercel`)                                                                                     |
| PDF      | `@react-pdf/renderer` (server-only routes)                                                                              |

### Dashboard UI (authenticated)

When a session exists, `+layout.svelte` adds `dashboard-shell` on `<html>`. Desktop (`lg+`) matches the legacy Next.js chrome: floating rounded sidebar, `--radius: 1rem`, elevated `rounded-3xl` cards, `h-11` / `rounded-2xl` inputs, selects, and buttons, FormHeader actions on the right, and generous page padding (`dashboard-page` up to `p-10`, max width 1680px). Search, selects, outline/secondary buttons, tabs, and data tables use the same white `bg-card` / `.surface-card` surface as dashboard cards so they sit off the cream page. Dropdown menus size to content (`min-w` 15rem, `w-max`) with `min-h-11` / `px-3.5` items so labels stay on one line. UI type is **Figtree** (400 body, 500 UI, 600 titles) with **IBM Plex Mono** for `font-mono`. Phone (`<lg`) uses the native shell (orange brand hero, floating tab dock, borderless float cards). Public routes (landing `/`, `/signin`, `/sign/[token]`) never get `dashboard-shell`; landing keeps the existing rounded marketing styles in `layout.css`. Visual layout is locked by Playwright `e2e/visual-parity.spec.ts` (1440×900).

### Mobile shell (authenticated, below `lg`)

Phone layouts use a native-style shell instead of a hamburger drawer:

- **Brand hero** (`MobileTopBar`) is a full-bleed orange bar (`--primary` `#fb9f44`): logo + app name (`APP_NAME`) on the left, page actions on the right as frosted icon wells. Page titles render in content (`PageHeader` / `DetailHeader` / `FormHeader`). Detail back is in content, not the bar. Status bar uses `theme-color` `#dd8c3c` (`THEME_COLOR_DASHBOARD`) while signed in.
- **Floating dock** (`MobileTabBar`) sits above the home indicator: glass pill, solid orange active tab, 18px icons, 10px labels. Up to four primary destinations from `src/lib/nav/app-nav.ts` sit on the dock as shortcuts; **More** is always last. Settings never appears on the dock.
- **More sheet** lists every nav link (same set and grouping as the desktop sidebar, including dock shortcuts and Settings), then account chrome: profile, price visibility, Light/Dark theme, and sign out (13px rows, 44px min height). Height hugs content (max `92dvh`). It slides up from the bottom with a fade frost scrim (shared Sheet primitive).
- **Safe areas** via `src/lib/styles/mobile.css` and `viewport-fit=cover` in `app.html`. Dashboard content uses `pt-mobile-top` / `pb-mobile-tab` (dock clearance `5.75rem` + safe area). Public/marketing chrome (`LandingNav`, `/signin`) uses `pt-safe-offset-sm` / `pt-safe-offset-md` (safe area + `0.75rem` / `1.25rem`).
- **Surfaces:** cards are borderless with `--shadow-native-float` under `lg`; desktop (`lg+`) keeps bordered `rounded-3xl` elevated cards.
- **Type:** phone KPI values `15px`, section titles `14px`; section eyebrows and card descriptions hide under `lg`.
- **Overlays:** `ResponsiveModal` renders a bottom **Sheet** under `lg` and a centered **Dialog** at `lg+`. Bottom sheets hug their content (`h-auto`) and cap at about `90dvh` so long forms scroll inside the sheet instead of stretching to full screen. Presentation is locked while open so resize does not remount form state. Shared Sheet (`src/lib/components/ui/sheet`) slides via bits-ui `data-starting-style` / `data-ending-style` (not `data-open:animate-in`; bits-ui sets `data-state`, not `data-open`). Motion tokens in `mobile.css`: ~300ms enter / ~220ms exit with iOS-style deceleration curves; scrim fades slightly faster. Scrim is `.modal-scrim` (frost blur). `data-open:` / `data-closed:` Tailwind variants map to `[data-state]` in `layout.css`. Sheet footers use `flex-col-reverse` so the primary action is on top and Cancel is below (DOM order stays Cancel then primary). Create / edit forms on phone open as sheets (`LoanCreateModal`, `EditFormSheet`, and the other CRUD modals) instead of navigating to `/new` or replacing the detail page. Direct `/new` URLs still exist for desktop and bookmarks.
- **List toolbars:** `ListPageToolbar` keeps search and controls on one row on phone (`.mobile-list-toolbar`: search flexes, `.mobile-list-toolbar-controls` stays shrink-wrapped). View toggle hides when the list is empty. Desktop (`lg+`) may wrap the same row. Shared `Pagination` on phone: range + compact page-size, then prev / page of total / next. Numbered page pills stay `lg+`. Empty card views use shared `ListEmptyState` (message only, or clear-filters when filters hide all rows). Create actions stay in the page header only.
- **List → detail:** loans, debts, party lists, and investor-detail loan rows navigate to detail pages under `lg` rather than opening large quick-view modals. List **create** and **edit** stay on the list (or detail) and open a sheet.
- **Chrome:** page titles live in `PageHeader` / `DetailHeader` / `FormHeader` (phone H1 in content; descriptions stay `hidden lg:block`). PageHeader/DetailHeader actions render in MobileTopBar on phone as frosted icon wells. Hero calendar (`SyncCalendarButton`) opens a bottom sheet under `lg` (dropdown at `lg+`). Price visibility lives in More on phone; desktop toggle stays beside the page title. Detail back is a 44px chevron in content under `lg`.
- **View mode / calendar:** cards (and day calendar) under `lg`; table and week/month calendar appear at `lg+`. View toggle stays in the toolbar on phone. Shared `CalendarHeader` on phone is a compact day toolbar (title + Today/prev/next; no Day-only toggle). Day/Week/Month segmented control stays `lg+`.
- **Forms:** `FormHeader` keeps Cancel / submit in the header at `lg+`. On phone those actions sit in the scrolling form body via `FormActions` (`layout="stacked"` in sheets: full-width 48px buttons, primary on top, Cancel below, `pb-safe`). Full-page forms use `layout="responsive"`. Sheet / modal footers from `ResponsiveModal` `{#snippet footer()}` share the same full-width button rules in `mobile.css`. Payment record/edit overlays use `ResponsiveModal`.
- Desktop (`lg+`) keeps the left sidebar and centered dialogs. Visual layout at 1440×900 is locked by Playwright `e2e/visual-parity.spec.ts`.

Light PWA installability: `static/manifest.webmanifest` + theme-color meta (no service worker).

### Light / dark theme

Class-based, same pattern as kame-homes and kame-desk: `document.documentElement` gets `.dark`. Preference is `light` | `dark` | `system` in `localStorage` (`kl-theme`). Tailwind `dark:` variants follow the class. `mode-watcher` applies the class before first paint (no flash). OS changes are tracked while preference is `system`.

Semantic tokens in `src/routes/layout.css` (`:root` and `.dark`) drive `bg-background`, `text-foreground`, `bg-card`, `border-border`, sidebar, charts, and toasts. Shadows and the dashboard `app-shell` wash are overridden in `.dark` so elevation still reads.

| Surface                  | Control                                         |
| ------------------------ | ----------------------------------------------- |
| Desktop sidebar          | Light/Dark segmented pill (icon when collapsed) |
| Phone More sheet         | Light/Dark segmented pill                       |
| Landing `/`              | Icon toggle in the header                       |
| Sign in                  | Icon toggle, top right                          |
| Logged-out public header | Icon toggle next to Login                       |

Signed-in status bar uses `#dd8c3c` (hero gradient foot). Solid `--primary` is `#fb9f44`. Public pages use cream (`#faf8f5`) or neutral dark (`#09090b`, zinc-scale surfaces with zero warm chroma). Sidebar active nav and landing marketing gradients keep their existing warm amber stops. Signature pads, contract paper, and payment QR images stay white so ink and scans remain readable.

## Repo layout

```text
src/routes/           # SvelteKit pages and API (+server.ts)
src/lib/              # Client-safe domain logic, components, composables
src/lib/server/       # DB, auth, calendar, access-control, backups
db/migrations/        # Hand-maintained SQL patches (do not edit shipped files)
drizzle.config.ts     # Kit config (schema: src/lib/server/db/schema.ts)
drizzle/              # Drizzle Kit output (gitignored)
docs/                 # Guides, workflow, archive
scripts/              # Backup, AI tooling, migration helpers
```

## Environment variables

See `.env.example`. Production uses the same names as before cutover; public vars use SvelteKit `PUBLIC_*` where noted in `.env.example`.

During local SvelteKit QA, set **`DATABASE_URL`** to `DATABASE_URL_LOCAL` (Docker at `127.0.0.1:5433`) or `DATABASE_URL_PROD` (Singapore Neon). Pull a Neon snapshot into Docker with `bun run db:local:sync-prod`. Auth.js selects `user.role`; a DB that cannot run queries (e.g. Neon data-transfer quota) surfaces as `/auth/error?error=Configuration` after Google redirects back.

A `DATABASE_URL` **exported in the shell overrides `.env.local`** (`$env/dynamic/private` reads `process.env` first) and is inherited by `bun dev`. An `.env.example` placeholder (`…@ep-....us-east-1…`) exported that way reaches no host, so every Auth.js adapter query fails with `AdapterError` / `SessionTokenError`. `src/lib/server/db/index.ts` now ignores placeholder URLs, warns, and falls back to `.env.local`. Fix the shell with `unset DATABASE_URL`, then restart `bun dev`.

## Pages

| Route                                                                         | Notes                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard`                                                                  | Streams `queryDashboardSummary` then `queryDashboardCharts`. Summary cards: Total Principal, Active, Interest Estimate, Interest Earned (all-time peak concurrent capital + scheduled interest). See [`guides/routes/dashboard.md`](./guides/routes/dashboard.md). |
| `/loans`, `/investors`, `/borrowers`, `/witnesses`, `/debts`, `/transactions` | Stream list data; `ListPageSkeleton` paints before queries finish. List cache modes omit heavy relations.                                                                                                                                                          |

## Performance

- Session is resolved once per request in `hooks.server.ts` (`event.locals.session`). Page loads and API handlers read that instead of calling `auth()` repeatedly.
- Client navigation shows a top progress bar (`NavigationProgress`) until the destination `load` finishes. Dashboard, list, detail, and form routes show layout-level skeletons (`DashboardSkeleton`, `ListPageSkeleton`, `DetailPageSkeleton`, `FormPageSkeleton`) that mirror the loaded chrome (header, metric cards, toolbar surface, table or form card). Quick-view modals (`DebtDetailModal`, `LoanDetailModal`, `BorrowerDetailModal`, `WitnessDetailModal`) and create modals use matching skeletons instead of spinners while fetching.
- List queries use slim cache modes (`getCachedLoans(..., 'list')`, `getCachedInvestors(..., 'list')`) that omit heavy relations such as `receivedPayments` on list pages. Detail routes and `getCachedLoans()` default still load full graphs. Shared co-investors are loaded by id (not nested `loanInvestors.loan.loanInvestors.investor…`) so Postgres aliases stay under the 63-character identifier limit.
- `/investors/[id]` loads only the loans tied to that investor (`inArray(loans.id, investorLoanIds)`) with full nested relations, instead of filtering the user's entire loan cache; this prevents timeouts for investors associated with many loans. Overview summary cards use per-investor peak concurrent paid allocation capital (`computeInvestorPortfolioCapitalStats`). See [`guides/routes/investors-detail.md`](./guides/routes/investors-detail.md).
- Overdue status checks run from the dashboard only, deferred 3s after mount so they do not compete with the initial load.
- List/dashboard queries use a process-local TTL cache (`src/lib/server/memory-cache.ts`, 45s). `getCached*`, `queryDashboardSummary`, and `queryDashboardCharts` read through it.
- Mutations call `invalidateLoanData` / `invalidateInvestorData` / etc. in `src/lib/server/cache-invalidation.ts`, which drop matching cache prefixes. In-flight fetches that finish after invalidation are not stored.
- Cache is per Node isolate (local `vite dev` is one process; Vercel instances do not share it). Hover preload is enabled on `body` and sidebar links.
- Local `bun dev` against the Singapore Neon project (`ap-southeast-1`, linked as **Kame Lends**) is the hosted QA target. Vercel production still uses the old US East 1 **Pawn Tracker** project until an explicit cutover. For zero-network local work, use Docker Postgres (`bun run db:local:*`).

## API routes

SvelteKit `src/routes/api/**/+server.ts` mirrors legacy `/api/*` paths (loans, investors, borrowers, debts, transactions, signing, cron backup, witnesses, interest periods, payment methods). `PATCH /api/loans/[id]/contract` saves contract customization only (loan admin); syncs signing invitations.

**Party profiles (admin):** `GET` / `PUT` `/api/party-profiles/{investor|borrower|witness}/[entityId]` loads or saves unified contact data (name, email, phone, address, valid ID, e-signature) and syncs across all investor/borrower/witness CRM rows linked to the same party user. **Party self-service:** `GET` / `PUT` `/api/party-profile/me` lets a signed-in party user update valid ID and e-signature across all linked CRM rows. **Party payment methods (admin):** `/api/party-users/[userId]/payment-methods` when editing a linked contact.

## Auth & roles

- Google sign-in via Auth.js. Invited party users already have a `users` row (email from CRM). First Google login links that row (`allowDangerousEmailAccountLinking`). Unknown Google emails are rejected (`AccessDenied`); they are not auto-created as `admin`. An empty workspace still accepts the first Google user.
- Custom UI: `/signin` (`src/routes/signin/`). Auth.js endpoints stay at `/auth/*` (callback, session, csrf). Auth errors return to `/signin?error=…`. Do not host the custom page at `/auth/signin` (Auth.js owns that path).
- `admin`: workspace owner (full create/edit/delete on owned records)
- `investor` / `borrower` / `witness`: display labels only. Access is membership-based. One Google account can be linked as investor, borrower, and witness via the same `users` row (`investors.investor_user_id`, `borrowers.borrower_user_id`, `witnesses.witness_user_id`). Party linking reuses the email; it does not create extra users.
- Loan access (`src/lib/server/access-control.ts`): owner full edit; investor/borrower/witness read-only (signing still allowed for their slot)
- Menus: party users see Dashboard, Investments, Borrowed, Witnessed, and Settings (empty party views stay open). Workspace admins also see Loans, Borrowings, Investors, Borrowers, Witnesses, and Transactions (when enabled). Create/edit/delete stay workspace-admin only.
- Contract signing: authenticated `/loans/[id]/sign` (Google email must match party). Legacy `/sign/[token]` redirects after login
- Access failures render `src/routes/+error.svelte`, not SvelteKit's bare fallback. Copy is mapped from status + route in `src/lib/error-presentation.ts` (403 = no signing slot or view-only, 404 = missing or no access, 401 = re-sign-in with `callbackUrl`). Internal reasons thrown by loads (`Not found`, `Read only`) are never shown. See [`guides/routes/errors.md`](./guides/routes/errors.md).
- Payment methods: any signed-in user manages their own bank/QR in `/settings`. Party users with linked CRM rows also manage valid ID and e-signature in `/settings` (`/api/party-profile/me`). When editing a party contact (`PartyUserEditForm`), admins can also manage that person's payment methods on their linked auth user. Loan detail APIs return the loan owner's methods only when the viewer has borrower membership on that loan.
- Tracker: [`workflow/done/multi-role-loan-access.md`](./workflow/done/multi-role-loan-access.md). QA: [`workflow/qa/multi-role-loan-access.md`](./workflow/qa/multi-role-loan-access.md).

## Database

- Schema: `src/lib/server/db/schema.ts` (includes `payment_methods` for owner bank/QR details)
- Client: `src/lib/server/db/index.ts` — **local** URLs (`localhost` / `127.0.0.1`) use `postgres.js`; **Neon** URLs use a WebSocket `Pool` (`drizzle-orm/neon-serverless`), not one HTTP round-trip per query. The pool is reused on `globalThis` and recreated when `DATABASE_URL` changes so Vite HMR does not leak dead Neon sockets (Auth.js `AdapterError` / `Failed query` on `account` / `session`). Placeholder URLs (`...`, `<`, `…`) are rejected in favor of `.env.local`.
- Commands: `bun run db:generate`, `db:migrate`, `db:studio`
- **Local Docker:** `bun run db:local:start` → `bun run db:local:push` → set `DATABASE_URL` to `DATABASE_URL_LOCAL`. See [`archive/operations/local-development-database.md`](./archive/operations/local-development-database.md).
- **Hosted (Singapore):** project `Kame Lends` (`twilight-bar-00845805`, `ap-southeast-1`). `.env.local` keeps `DATABASE_URL_PROD` (pooled) and copies it into `DATABASE_URL` when you want hosted QA. Data was copied from US East 1 with `pg_dump` / `pg_restore`. Auth stays Auth.js, not Neon Auth. `neon.ts` must not declare Neon Auth, Functions, Object Storage, or AI Gateway (those extras are US-Ohio beta and unused here).
- **Vercel production (until cutover):** old **Pawn Tracker** project in `us-east-1`. Do not change Vercel `DATABASE_URL` without **`lendwave`**.

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
- E2E CRUD coverage creates and cleans up investors, transactions, borrowings, and loans (including a preselected investor, a borrower, principal, and due date), then verifies the generated signing link is authenticated `/loans/{id}/sign` (legacy `/sign/[token]` redirects after login). It revealed and validated fixes for number-input validation in `TransactionForm.svelte` and `LoanForm.svelte` (`String(value).trim()` instead of assuming a string from `type="number"` inputs).
- E2E advanced-controls coverage verifies the settings maintenance controls, the new-borrower modal from the loan form, the valid signing page controls, and loan duplication from the detail page. The duplication test exposed a UTF-8 `btoa` crash when duplicate data contained non-Latin1 characters; it now uses `src/lib/base64-url.ts` helpers for safe encoding/decoding.
- Inline edit forms on detail pages are keyed by entity ID so client-side navigation between different investors/borrowers/witnesses/debts/loans resets form state instead of showing stale data from the previously viewed entity.
