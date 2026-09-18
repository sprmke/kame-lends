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

When a session exists, `+layout.svelte` adds `dashboard-shell` on `<html>`. Desktop (`lg+`) matches the legacy Next.js chrome: floating rounded sidebar (`top-4`), `--radius: 1rem`, elevated `rounded-3xl` cards, `h-11` / `rounded-2xl` inputs, selects, and buttons, FormHeader actions on the right, and horizontal page padding on `dashboard-page` (up to `px-10`, max width 1680px; top padding comes from the app shell only so headers line up with the sidebar). Search, selects, outline/secondary buttons, tabs, and data tables use the same white `bg-card` / `.surface-card` surface as dashboard cards so they sit off the cream page. Dropdown menus size to content (`min-w` 15rem, `w-max`) with `min-h-11` / `px-3.5` items so labels stay on one line. UI type is **Figtree** (400 body, 500 UI, 600 titles) with **IBM Plex Mono** for `font-mono`. Phone (`<lg`) uses the native shell (orange brand hero, floating tab dock, borderless float cards). Public routes (landing `/`, `/signin`, `/sign/[token]`) never get `dashboard-shell`; landing keeps the existing rounded marketing styles in `layout.css`. Visual layout is locked by Playwright `e2e/visual-parity.spec.ts` (1440×900).

### Mobile shell (authenticated, below `lg`)

Phone layouts use a native-style shell instead of a hamburger drawer:

- **Brand hero** (`MobileTopBar`) is a full-bleed orange bar (`--primary` `#fb9f44`): logo + app name (`APP_NAME`) on the left, page actions on the right as frosted icon wells. Page titles render in content (`PageHeader` / `DetailHeader` / `FormHeader`). Detail back is in content, not the bar. Status bar uses `theme-color` `#dd8c3c` (`THEME_COLOR_DASHBOARD`) while signed in.
- **Floating dock** (`MobileTabBar`) sits above the home indicator: solid pill (no backdrop blur), orange active tab, 18px icons, 10px labels. Tab highlight follows the last tap and in-flight navigation (`resolveMobileDockPathname`) so rapid switches stay aligned before the route settles. Up to four primary destinations from `src/lib/nav/app-nav.ts` sit on the dock as shortcuts; **More** is always last. Settings never appears on the dock.
- **More sheet** lists every nav link (same set and grouping as the desktop sidebar, including dock shortcuts and Settings), then account chrome: profile, price visibility, Light/Dark theme, and sign out (13px rows, 44px min height). Height hugs content (max `92dvh`). It slides up from the bottom with a fade frost scrim (shared Sheet primitive).
- **Safe areas** via `src/lib/styles/mobile.css` and `viewport-fit=cover` in `app.html`. Dashboard content uses `pt-mobile-top` / `pb-mobile-tab` (dock clearance `5.75rem` + safe area). Public/marketing chrome (`LandingNav`, `/signin`) uses `pt-safe-offset-sm` / `pt-safe-offset-md` (safe area + `0.75rem` / `1.25rem`).
- **Surfaces:** cards are borderless with `--shadow-native-float` under `lg`; desktop (`lg+`) keeps bordered `rounded-3xl` elevated cards.
- **Type:** phone KPI values `15px`, section titles `14px`; section eyebrows and card descriptions hide under `lg`.
- **Overlays:** `ResponsiveModal` renders a bottom **Sheet** under `lg` and a centered **Dialog** at `lg+`. Nested dialogs, sheets, and alert dialogs share a stacking layer (`src/lib/composables/overlay-stack.svelte.ts`) so a later overlay (loan detail from the calendar day-events dialog) paints above the one that opened it. Selects, dropdowns, and popovers sit at `z-[100]` so they still clear stacked modals. Bottom sheets hug their content (`h-auto`) and cap at about `90dvh` so long forms scroll inside the sheet instead of stretching to full screen. Presentation is locked while open so resize does not remount form state. Shared Sheet (`src/lib/components/ui/sheet`) slides via bits-ui `data-starting-style` / `data-ending-style` (not `data-open:animate-in`; bits-ui sets `data-state`, not `data-open`). Motion tokens in `mobile.css`: ~300ms enter / ~220ms exit with iOS-style deceleration curves; scrim fades slightly faster. Scrim is `.modal-scrim` (solid tint; no backdrop blur on dashboard overlays, including sheets). Dialog and alert panels skip fade-in so they stay opaque if the main thread hitches. Light overlays (New group, pickers, confirms) mount the body immediately. Only heavy trees opt into `deferBody` (`tick` plus two animation frames; loan create/detail lazy-load internally). `createOverlayContentReady` is rising-edge so re-entry cannot leave the shell skeleton stuck. While any stacked overlay is open, `html.overlay-open` turns off sidebar/dock backdrop blur without transitioning it. At **`lg+`**, it also skips painting `.app-shell` (`content-visibility: hidden`) so heavy list pages do not show through dialog fades; mobile sheets keep the page visible under the solid scrim. `data-open:` / `data-closed:` Tailwind variants map to `[data-state]` in `layout.css`. Sheet footers use `flex-col-reverse` so the primary action is on top and Cancel is below (DOM order stays Cancel then primary). Create / edit forms on phone open as sheets (`LoanCreateModal`, `EditFormSheet`, and the other CRUD modals) instead of navigating to `/new` or replacing the detail page. Direct `/new` URLs still exist for desktop and bookmarks.
- **List toolbars:** `ListPageToolbar` keeps search and controls on one row on phone (`.mobile-list-toolbar`: search flexes, `.mobile-list-toolbar-controls` stays shrink-wrapped). View toggle hides when the list is empty. Desktop (`lg+`) may wrap the same row. Shared `Pagination` on phone: range + compact page-size, then prev / page of total / next. Numbered page pills stay `lg+`. Empty card views use shared `ListEmptyState` (message only, or clear-filters when filters hide all rows). Create actions stay in the page header only.
- **List → detail:** loans, debts, party lists, and investor-detail loan rows navigate to detail pages under `lg` rather than opening large quick-view modals. List **create** and **edit** stay on the list (or detail) and open a sheet.
- **Chrome:** page titles live in `PageHeader` / `DetailHeader` / `FormHeader` (phone H1 in content; descriptions stay `hidden lg:block`). PageHeader/DetailHeader actions render in MobileTopBar on phone as frosted icon wells. Group hub calendar sync (`SyncCalendarButton` on `/groups/[id]`) opens a bottom sheet under `lg` (dropdown at `lg+`). Price visibility (eye toggle) lives in More on phone and beside the page title on desktop; when on, it masks PHP amounts and percentage rates only (names, dates, counts, and labels stay visible). Detail back is a 44px chevron in content under `lg`.
- **View mode / calendar:** cards (and day calendar) under `lg`; table and week/month calendar appear at `lg+`. View toggle stays in the toolbar on phone. Shared `CalendarHeader` on phone is a compact day toolbar (title + Today/prev/next; no Day-only toggle). Day/Week/Month segmented control stays `lg+`.
- **Forms:** `FormHeader` keeps Cancel / submit in the header at `lg+`. On phone those actions sit in the scrolling form body via `FormActions` (`layout="stacked"` in sheets: full-width 48px buttons, primary on top, Cancel below, `pb-safe`). Full-page forms use `layout="responsive"`. Sheet / modal footers from `ResponsiveModal` `{#snippet footer()}` share the same full-width button rules in `mobile.css`. Payment record/edit overlays use `ResponsiveModal`.
- Desktop (`lg+`) keeps the left sidebar and centered dialogs. Visual layout at 1440×900 is locked by Playwright `e2e/visual-parity.spec.ts`.

**PWA:** installable app with service worker (`src/service-worker.ts`), read-only offline cache, install/update prompts, and Web Push. See [`architecture/pwa.md`](./architecture/pwa.md).

### Brand / logo

The logo is a geometric top-down sea turtle (_kame_ 亀 = turtle) with a hex-scute shell on an orange gradient tile (`#ffbf73` → `#fb9f44` → `#e4702a`). Geometry lives once in `src/lib/brand-mark.ts`:

- **In app:** `BrandMark` (turtle in `currentColor`) → `BrandIcon` (solid gradient tile, or `glass` on the mobile brand hero) → `Logo` (icon + `APP_NAME` wordmark). Used by the sidebar, `MobileTopBar`, landing nav/footer, sign-in, and the error page.
- **Static assets:** `bun run brand:assets` (`scripts/brand/generate-brand-assets.ts`, rasterized with Playwright Chromium) regenerates `static/favicon.svg` / `favicon.ico` (16/32/48), `apple-touch-icon.png` (180, full-bleed), `icon-192.png` / `icon-512.png` (manifest `any`), `icon-maskable-512.png` (manifest `maskable`), `og-image.png` (1200×630 social card), and `static/brand/` masters (`kame-lends-icon.svg`, `kame-lends-mark.svg`, `kame-lends-icon-1024.png`). Re-run after any geometry or color change; do not hand-edit the outputs.
- **Head:** icon links + `application-name` / `apple-mobile-web-app-title` in `src/app.html`; `description`, Open Graph, and Twitter card tags (`APP_DESCRIPTION` from `src/lib/brand.ts`, absolute `og:image` from the request origin) in `src/routes/+layout.svelte`.

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

During local SvelteKit QA, set **`DATABASE_URL`** to `DATABASE_URL_LOCAL` (Docker at `127.0.0.1:5433`) or `DATABASE_URL_PROD` (Singapore Neon). Pull a Neon snapshot into Docker with `bun run db:local:sync-prod`. Auth.js exposes `user.role` on the session (nullable). Shipped SQL patches live in `db/migrations/`. **Production CD** applies pending files via `bun run db:migrate:pending --yes` on every push to `main` (see [`architecture/deployment.md`](./architecture/deployment.md)). Locally: **`db:migrate:pending`** → `DATABASE_URL`; **`db:migrate:pending:prod`** → Singapore QA; **`db:migrate:pending:vercel`** → `DATABASE_URL_VERCEL` for manual prod repair. Journal table: `schema_migrations`. Missing columns/tables surface as SvelteKit `Internal Error` on `/loans`. A DB that cannot run queries (e.g. Neon data-transfer quota) surfaces as `/auth/error?error=Configuration` after Google redirects back.

A `DATABASE_URL` **exported in the shell overrides `.env.local`** (`$env/dynamic/private` reads `process.env` first) and is inherited by `bun dev`. An `.env.example` placeholder (`…@ep-....us-east-1…`) exported that way reaches no host, so every Auth.js adapter query fails with `AdapterError` / `SessionTokenError`. `src/lib/server/db/index.ts` now ignores placeholder URLs, warns, and falls back to `.env.local`. Fix the shell with `unset DATABASE_URL`, then restart `bun dev`.

**AI receipt scanning (optional):** `GEMINI_API_KEYS` (comma-separated, for rotating multiple free-tier accounts) or `GEMINI_API_KEY`, plus an optional `GROQ_API_KEY` fallback. Fully optional — with none set, receipt scanning reports "not configured" and every form still works via manual entry.

**Public app URL:** `PUBLIC_APP_URL` (SvelteKit `PUBLIC_` prefix). Used in Google Calendar event links, contract signing URLs, and landing mockups. Defaults to `https://pawn-tracker.vercel.app` via `src/lib/brand.ts` when unset. Set the same value on Vercel Production. For local dev, use `http://localhost:3200` (see `scripts/dev/local-dev-port.mjs`).

**Local dev server:** Vite binds **http://localhost:3200** with `strictPort` (avoids clashes with other projects on `:5173`). Playwright E2E uses **:4174** via the same module. Run `bun run dev:free-ports` if a stale process holds either port.

**Google Calendar:** `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` only. Per-group calendars are created by the service account; loan create/update/delete and due-date sync enqueue `integration_jobs` (`group.calendar.syncLoan`, summaries, ACL). Full resync: `POST /api/groups/[id]/calendar/sync` (`prepare`, `wipe`, `loans`, `summaries`; scope `all` | `open` | `upcoming`, Asia/Manila). UI: `SyncCalendarButton` on the group hub only. Legacy workspace-wide calendar sync was removed; wipe old events with `bun run dev:wipe-workspace-calendar` before dropping `GOOGLE_CALENDAR_ID` from env. All-day events use YYYY-MM-DD start and exclusive next-day end. **Total Summary** is one event per date with cashflow. Event colors match the old workspace calendar: disbursement red (`11`), due sage (`2`), interest due peacock (`7`), summary graphite (`8`); see `src/lib/calendar-event-colors.ts`. Backfill colors on existing group calendars: `bun run dev:backfill-group-calendar-colors -- --dry-run` then `--confirm` (add `--db=prod` or `--db=vercel` when `DATABASE_URL` points at local Docker).

**Object storage (optional):** Cloudflare R2 for valid IDs, e-signatures, payment receipts, and contract signing captures. When `R2_*` env vars and `PUBLIC_R2_ENABLED=true` are set, uploads go to a private bucket and Postgres stores a `storage:{objectKey}` reference in the existing `valid_id_url`, `e_signature_url`, and `receipt_image_url` columns (legacy `data:image/...` values still work). Without R2, the app keeps storing compressed data URLs in Postgres. Backfill existing rows with `bun run db:backfill:storage` (see `scripts/db/backfill-storage-to-r2.ts`).

**Web Push (optional):** `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUBLIC_VAPID_PUBLIC_KEY`. Generate with `bun run pwa:generate-vapid-keys`. Kill-switch: `PWA_DISABLED`, `PWA_MIN_VERSION` (string compare to `$service-worker` version; use commit SHAs). PWA build uses deterministic `kit.version.name` (`VERCEL_GIT_COMMIT_SHA` or `dev-local`). See [`docs/architecture/pwa.md`](architecture/pwa.md).

**Transactional email (optional):** Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Shared branded shell in `src/lib/server/email/` (same card layout as Kame Homes: accent bar, logo, CTA). On `POST /api/loans`, each signing party with an email gets a “Contract ready to sign” message with a **Sign contract** button to `/loans/[id]/sign` (Google sign-in with matching email). Parties without email are skipped. Missing Resend config is a no-op; send failures never roll back loan create. Daily backup cron uses the same shell.

## Pages

| Route                                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard`                                                                  | Streams `queryDashboardSummary` then `queryDashboardCharts`. Summary cards: Total Principal, Active, Interest Estimate, Interest Earned (all-time peak concurrent capital + scheduled interest). See [`guides/routes/dashboard.md`](./guides/routes/dashboard.md).                                                                                                             |
| `/loans`, `/investors`, `/borrowers`, `/witnesses`, `/debts`, `/transactions` | Stream list data; `ListPageSkeleton` paints before queries finish. List cache modes omit heavy relations.                                                                                                                                                                                                                                                                      |
| `/groups`, `/groups/[id]`                                                     | Loan groups with derived membership (parties on group loans see every loan read-only). Per-group Google Calendar + Telegram. Any signed-in user can create; only the creator manages. List shows owned + shared. Behind `SHOW_GROUPS_UI`. See [`guides/routes/groups.md`](./guides/routes/groups.md) and [`guides/routes/groups-detail.md`](./guides/routes/groups-detail.md). |

## Performance

- Session is resolved once per request in `hooks.server.ts` (`event.locals.session`). Page loads and API handlers read that instead of calling `auth()` repeatedly.
- Client navigation shows a top progress bar (`NavigationProgress`) until the destination `load` finishes. Dashboard, list, detail, and form routes show layout-level skeletons (`DashboardSkeleton`, `ListPageSkeleton`, `DetailPageSkeleton`, `FormPageSkeleton`) after ~120ms if navigation is still pending (`createDelayedFlag`), so fast tab taps do not flash skeleton chrome. Quick-view modals (`DebtDetailModal`, `LoanDetailModal`, `BorrowerDetailModal`, `WitnessDetailModal`) and create modals use matching skeletons instead of spinners while fetching.
- List queries use slim cache modes (`getCachedLoans(..., 'list')`, `getCachedInvestors(..., 'list')`) that omit heavy relations such as `receivedPayments` on list pages. `GET /api/loans` uses list mode. Detail `GET /api/loans/[id]` omits `loanContract` unless `?include=contract` (edit/duplicate/contract details). Shared co-investors are loaded by id (not nested `loanInvestors.loan.loanInvestors.investor…`) so Postgres aliases stay under the 63-character identifier limit.
- JSON APIs strip leftover `data:image…` values (`stripDataImageUrls` / `jsonSafeImageRef`) on identity photos (valid ID, e-signature). `storage:` refs stay. Payment receipt `receiptImageUrl` / `receipts[].imageUrl` values are kept so loan detail and the edit form can show them. Includes list/detail loan payloads, `GET /api/loans/[id]/contract`, and `GET` / `PUT` `/api/party-profile/me`. List/simple party payloads do not need inlined identity photos; UI previews go through `/api/storage/object`.
- Desktop loan list modal opens from the list row immediately, then refreshes `GET /api/loans/[id]` in the background. Signing and contract JSON load only when Contract Details is open (`GET /api/loans/[id]/signing`, `GET /api/loans/[id]/contract`). Those three GETs share a 45s per-loan client cache (`src/lib/composables/loan-detail-client-cache.ts`).
- After save, complete, quick-pay, or delete, the list patches that row in memory (`applyLoanListChange`) instead of `invalidate('app:loans')`. Creating a loan still reloads the list.
- `loadLoanDetail` loads the loan graph (including `groupLoans` links) and session email in one parallel step, then `computeLoanAccessContext` (`src/lib/loan-access-compute.ts`). No second access query. Contract GET/POST and signing GET use the same membership function on the loan they already loaded.
- Investor/borrower/witness option lists share one client fetch (`src/lib/composables/party-options.ts`, 45s TTL) so list filters and loan forms do not request the same simple APIs twice. Creating or saving a contact clears that cache.
- Loan list date-range changes use `replaceState` (not `goto`) and do not re-run `+page.server.ts` (the range already filters in the browser). First visit still redirects to the current month when `from`/`to` are missing.
- `requireWorkspaceAdminPage` reuses `navCapabilities` from `+layout.server.ts` instead of running `getNavCapabilities` again.
- Owned loan lists query `loans` by `user_id` in one step. Investor simple/list loads owned rows and linked IDs in parallel. `loan_signing_invitations.loan_id` is indexed (`0018_signing_invitations_loan_id_idx.sql`).
- Nav data preload is `tap` (not hover) so hovering Witnessed does not fire that page’s load and API prefetch.
- `/investors/[id]` loads only the loans tied to that investor (`inArray(loans.id, investorLoanIds)`) with nested relations, instead of filtering the user's entire loan cache; this prevents timeouts for investors associated with many loans. Overview summary cards use per-investor peak concurrent paid allocation capital (`computeInvestorPortfolioCapitalStats`). See [`guides/routes/investors-detail.md`](./guides/routes/investors-detail.md).
- Overdue status checks run from the dashboard only, deferred 3s after mount so they do not compete with the initial load. `POST /api/loans/check-overdue` sets a loan to `Completed` when received payments cover principal + interest, and does not mark those loans Overdue. Opening a loan (`loadLoanDetail` / `GET /api/loans/[id]`) heals the same stale Overdue row.
- List/dashboard queries use a process-local TTL cache (`src/lib/server/memory-cache.ts`, 45s). `getCached*`, `queryDashboardSummary`, and `queryDashboardCharts` read through it.
- Mutations call `invalidateLoanData` / `invalidateInvestorData` / etc. in `src/lib/server/cache-invalidation.ts`, which drop matching cache prefixes. In-flight fetches that finish after invalidation are not stored.
- Cache is per Node isolate (local `vite dev` is one process; Vercel instances do not share it). Tap preload is enabled on `body` and sidebar links.
- Local `bun dev` against the Singapore Neon project (`ap-southeast-1`, linked as **Kame Lends**) is the hosted QA target. Vercel Production `DATABASE_URL` uses the same Singapore project. Functions are pinned to `sin1` in `svelte.config.js` (`adapter({ regions: ["sin1"] })`) and `vercel.json`. Confirm with `x-vercel-id` (`sin1::sin1::…`, not `iad1`). Hobby allows one region. For zero-network local work, use Docker Postgres (`bun run db:local:*`).

## API routes

SvelteKit `src/routes/api/**/+server.ts` mirrors legacy `/api/*` paths (loans, investors, borrowers, debts, transactions, signing, cron backup, witnesses, interest periods, payment methods). `POST /api/loans` and `PUT /api/loans/[id]` reject borrower or investor IDs outside the session user's CRM (`src/lib/server/loan-crm-ownership.ts`). `GET /api/loans/[id]` is the list-modal payload (no `loanContract` unless `?include=contract`). `GET` / `POST /api/loans/[id]/contract` load or download the contract PDF (any party with loan view access). `PATCH` saves customization (loan admin) and syncs signing invitations. Contract GET JSON strips leftover `data:image…` values so large identity payloads cannot 500 the editor; PDF `POST` resolves `storage:` refs from R2 server-side (R2 S3 client strips unsupported checksum headers on GetObject). PDF render embeds JPEG/PNG valid IDs and signatures only, caps data-URL size, and retries without images if `@react-pdf/renderer` fails. WebP or unreadable images are omitted so the download still succeeds. Vite `ssr.external` keeps `@react-pdf/*` unbundled on Vercel Node functions.

**Party profiles (admin):** `GET` / `PUT` `/api/party-profiles/{investor|borrower|witness}/[entityId]` loads or saves unified contact data (name, email, phone, address, valid ID, e-signature) and syncs across all investor/borrower/witness CRM rows linked to the same party user. **Party self-service:** `GET` / `PUT` `/api/party-profile/me` lets a signed-in party user update valid ID and e-signature across all linked CRM rows. Responses keep `storage:` refs and drop leftover `data:image…` values. **Party payment methods (admin):** `/api/party-users/[userId]/payment-methods` when editing a linked contact.

**Object storage:** `POST /api/storage/upload` (authenticated) accepts the image body and writes to R2, returning a `storage:` reference. `GET /api/storage/object?ref=storage:…` checks RBAC, then redirects to a short-lived presigned download URL for UI previews. Server modules: `src/lib/server/storage/`.

**AI receipt scanning:** `POST /api/ai/receipt-extraction` (any signed-in user with storage access to the image) reads an uploaded payment receipt image and extracts sender/receiver name & bank, amount, date, and reference number — see `src/lib/server/ai/receipt-extraction.ts`. Gemini vision is primary (round-robins `GEMINI_API_KEYS`, falling back to a single `GEMINI_API_KEY`); on `429`/`403`/`5xx` from every Gemini key it falls back to Groq's Llama-4-Scout vision model (`GROQ_API_KEY`). Never throws — an unreadable image or missing keys returns `{ success: false, error }` so the caller (`ReceiptUploadField.svelte`) falls back to manual entry. Used from `LoanForm.svelte` (investor funding and received-payment rows, create/edit) and `LoanQuickPaymentDialog.svelte` (additional fund transfers and received payments): prefills amount/date without overwriting fields the admin already typed, and for investor payments fuzzy-matches the extracted sender name against the loan's lenders to auto-select one. Each disbursement or received payment stores up to 10 receipts in a `receipts` jsonb array (`imageUrl` + `extractedData`); the first item is also mirrored on the legacy `receiptImageUrl` / `receiptExtractedData` columns. Images are `storage:` refs when R2 is configured (otherwise compressed data URLs). Loan detail shows receipt thumbnails on disbursements and received payments. Additional fund transfers may share a sent date with an existing disbursement for the same lender.

**PWA / push:** `GET /api/pwa/version` (kill-switch). `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `GET /api/push/subscriptions`, `POST /api/push/test`, `GET|PUT /api/push/preferences`. Tables: `push_subscriptions`, `push_notification_log`, `user_push_preferences` (migration `0025_push_subscriptions.sql`).

**Party commission:** one private row per `(loan_id, user_id)` in `loan_user_commissions` (migration `0024_loan_user_commissions.sql`). Only the signed-in party (borrower, investor, or witness on that loan) can read or write their commission via `GET` / `PATCH` `/api/loans/[id]/my-commission`. Loan managers and other parties never see another user's rate or amount. Legacy `profit*` columns on `loans`, `loan_investors`, and `loan_witnesses` are stripped from API payloads; backfill copied existing values into `loan_user_commissions`. List stats: `computePartyCommissionStats` on **Commissioned** (`?scope=commissioned`) uses each loan's `myCommission` for the viewer. UI: `LoanMyCommissionCard`, `LoanCommissionModal`, `LoanCommissionSummaryCards`.

## Auth & roles

- Google sign-in via Auth.js. Any normalized Google email may sign in; Auth.js creates a `users` row on first login. Party contacts linked by email reuse the same row (`allowDangerousEmailAccountLinking`). New users get `users.role = NULL` unless they are the sitewide platform owner email.
- Custom UI: `/signin` (`src/routes/signin/`). Auth.js endpoints stay at `/auth/*` (callback, session, csrf). Auth errors return to `/signin?error=…`. Do not host the custom page at `/auth/signin` (Auth.js owns that path).
- **Sitewide `admin`:** only `michaeldmanlulu@gmail.com` (`src/lib/server/workspace-owner.ts`). The `admin` role is not a workspace-operator flag.
- **Owned lending data** (`isAdminWorkspace` in nav caps): true when the user owns loans, CRM contacts, or borrowings. Used for Settings **Owner** role label only, not for route gates.
- `investor` / `borrower` / `witness`: optional display labels set when party contacts are linked. Access is membership-based. One Google account can be linked as investor, borrower, and witness via the same `users` row (`investors.investor_user_id`, `borrowers.borrower_user_id`, `witnesses.witness_user_id`). Party linking reuses the email; it does not create extra users.
- Loan access (`src/lib/server/access-control.ts`): owner full edit; investor/borrower/witness read-only (signing still allowed for their slot), with one narrow exception — a borrower may edit their own profit value on a loan, and a witness may edit their own `loan_witnesses` row's profit value (see "Borrower & witness profit" under API routes). View via email match requires a non-empty party email (`computeLoanAccessContext`); blank invitation emails do not grant loan view (signing may still allow open slots separately).
- Menus (`src/lib/nav/app-nav.ts`): **Phone dock:** Dashboard, Groups (when `SHOW_GROUPS_UI`), Loans, Settings, plus **More** (People, Tools). **Same sidebar for every signed-in user:** Dashboard, Groups (when `SHOW_GROUPS_UI`), **Loans**, **People** (Investors, Borrowers, Witnesses, Transactions when enabled), **Tools** (**Bank Loans** at `/debts`), Settings. `isAdminWorkspace` affects Settings copy (Owner role) only, not nav visibility. Party views (invested, borrowed, witnessed) are **tabs on `/loans`**, not separate sidebar links; `/investments`, `/borrowed`, and `/witnessed` redirect there. List pages show **your** CRM rows; mutations stay scoped to owned rows (`*.userId`).
- Contract signing: authenticated `/loans/[id]/sign` (Google email must match party). Legacy `/sign/[token]` redirects after login
- Access failures render `src/routes/+error.svelte`, not SvelteKit's bare fallback. Copy is mapped from status + route in `src/lib/error-presentation.ts` (403 = no signing slot or view-only, 404 = missing or no access, 401 = re-sign-in with `callbackUrl`). Internal reasons thrown by loads (`Not found`, `Read only`) are never shown. See [`guides/routes/errors.md`](./guides/routes/errors.md).
- Payment methods: any signed-in user manages their own bank/QR in `/settings`. Party users with linked CRM rows also manage valid ID and e-signature in `/settings` (`/api/party-profile/me`). When editing a party contact (`PartyUserEditForm`), admins can also manage that person's payment methods on their linked auth user. Loan detail APIs return the loan owner's methods only when the viewer has borrower membership on that loan.
- Tracker: [`workflow/done/multi-role-loan-access.md`](./workflow/done/multi-role-loan-access.md). QA: [`workflow/qa/multi-role-loan-access.md`](./workflow/qa/multi-role-loan-access.md).
- **Groups** (`src/lib/server/group-access.ts`, migration `0020_loan_groups_v2.sql` + `0021_group_telegram_credentials.sql`): membership is **derived** from loan parties (owner, investors, borrower, witnesses on `loan_witnesses`). `syncWitnessUserLinksForLoans` links witness CRM emails to party users before recompute so witnesses join membership and Google Calendar ACL shares. Group members can view **every loan in the group, read-only** via `hasLoanGroupViewAccess` / loan-detail projection (PII redacted). `hasLoanViewAccess` stays party-only so payments, contracts, and storage never open by accident. Any signed-in user can create a group; only the creator manages. Smart rules (`loan_group_rules`) auto-add future loans owned by the group creator when a contact matches. Per-group Google Calendar (create / sync / clear). Telegram: per-group bot token + chat ID (`POST /api/groups/[id]/telegram/connect`) and editable message templates with `{{placeholders}}`; optional shared env bot for the startgroup link + webhook. Side effects go through `integration_jobs` + `waitUntil` / daily `/api/cron/groups`.
- **Backup:** `GET /api/backup?download=true` exports the signed-in user's business JSON (v2: investors, borrowers, witnesses, debts, loans, transactions, groups, payment methods). Platform owner email only: `GET /api/backup?download=true&scope=all` for every data owner (`src/lib/server/backup-access.ts`). Cron `/api/cron/backup` still emails per-owner exports.

## Database

- Schema: `src/lib/server/db/schema.ts` (includes `payment_methods` for owner bank/QR details; `loans.profit_type`/`profit_value` for borrower profit and the `loan_witnesses` junction table for witness profit — see "Borrower & witness profit" under API routes; `loan_groups`/`loan_group_loans`/`loan_group_members`/`loan_group_rules`/`group_calendars`/`group_telegram_settings`/`integration_jobs` for Groups v2 — see "Auth & roles"; `loan_investors.receipts` / `received_payments.receipts` jsonb arrays for payment evidence, migration `0019_payment_receipts.sql`)
- Client: `src/lib/server/db/index.ts` — **local** URLs (`localhost` / `127.0.0.1`) use `postgres.js`; **Neon** URLs use a WebSocket `Pool` (`drizzle-orm/neon-serverless`), not one HTTP round-trip per query. The pool is reused on `globalThis` and recreated when `DATABASE_URL` changes so Vite HMR does not leak dead Neon sockets (Auth.js `AdapterError` / `Failed query` on `account` / `session`). Placeholder URLs (`...`, `<`, `…`) are rejected in favor of `.env.local`.
- Commands: `bun run db:generate`, `db:migrate:pending`, `db:studio`
- **Local Docker:** `bun run db:local:start` → `bun run db:local:push` → set `DATABASE_URL` to `DATABASE_URL_LOCAL`. See [`archive/operations/local-development-database.md`](./archive/operations/local-development-database.md).
- **Hosted (Singapore):** project `Kame Lends` (`twilight-bar-00845805`, `ap-southeast-1`). `.env.local` keeps `DATABASE_URL_PROD` (pooled) and copies it into `DATABASE_URL` when you want hosted QA. Data was copied from US East 1 with `pg_dump` / `pg_restore`. Auth stays Auth.js, not Neon Auth. `neon.ts` must not declare Neon Auth, Functions, Object Storage, or AI Gateway (those extras are US-Ohio beta and unused here).
- **Vercel production:** same Singapore Neon URL in Vercel Production `DATABASE_URL` and the GitHub Actions `production` `DATABASE_URL` secret. Functions run in `sin1`. CD migrates then deploys on every push to `main`.

### Data safety (prod)

Performance work does **not** delete or reset production data. Schema changes ship as new files under `db/migrations/` and are applied by CD before the Vercel deploy.

| Prefer                                           | Avoid for routine releases                      |
| ------------------------------------------------ | ----------------------------------------------- |
| Merge to `main` (CD: quality → migrate → deploy) | One-off `vercel --prod` without migrating first |
| Additive SQL in a new migration file             | Editing shipped migration files                 |
| `backup:neon` before risky manual SQL            | `db:push` against hosted Neon without review    |

`db:local:push` ignores `.env.local` and cannot target Neon.

## Deployment

See **[`architecture/deployment.md`](./architecture/deployment.md)** for the full CI/CD runbook (secrets, Vercel settings, rollback).

- Vercel project: PawnTracker / kame-lends
- CD: `.github/workflows/cd.yml` on `main`
- Health: `GET /api/health` (public, no auth) returns **200** when Postgres is reachable and `schema_migrations` matches on-disk SQL plus required columns for the running build; **503** when migrations or columns are behind (CD smoke test and ops). See `docs/architecture/deployment.md`.
- Cron: `/api/cron/backup` at 06:00 UTC; `/api/cron/groups` at 00:00 UTC (08:00 Manila) for membership/ACL reconcile, Telegram reminders, and job drain; `/api/cron/reminders` at 01:00 UTC for Web Push due/overdue reminders (`vercel.json`). Groups and reminders crons **require** `Authorization: Bearer CRON_SECRET` (fails closed). Telegram webhook: `POST /api/webhooks/telegram` (set with `bun run telegram:set-webhook`).
- Function region: `sin1` (`svelte.config.js` adapter `regions` and `vercel.json` `"regions": ["sin1"]`)
- Backups: `bun run backup:neon`

## Migration history

Completed: [`docs/workflow/done/sveltekit-migration.md`](./workflow/done/sveltekit-migration.md)

Pre-cutover snapshot: `docs/archive/operations/vercel-production-snapshot.md`

## QA / CI

- `bun run ci:quality` is the local equivalent of GitHub Actions quality: typecheck (`svelte-check`), Prettier, ESLint, Vitest, AI tooling sync, and production build.
- CI (PRs / non-`main` pushes): same quality steps + Commitlint on pull requests.
- CD (`main`): quality → migrate → Vercel deploy (see [`architecture/deployment.md`](./architecture/deployment.md)).
- `bun run build:clean` removes `.svelte-kit` and `.vercel/output`, then runs `svelte-kit sync` and `vite build` to avoid stale-cache and symlink build flakes from `adapter-vercel`.
- Playwright E2E tests run against `bun run dev` on port 4174; the dev server is started and stopped automatically by `playwright.config.ts`. Projects include smoke, authenticated routes, modals, visual-parity, multi-role, and `loan-groups-v2`. E2E is not part of the default CD quality gate (slower; run locally or as a follow-up job when needed).
- E2E CRUD coverage creates and cleans up investors, transactions, borrowings, and loans (including a preselected investor, a borrower, principal, and due date), then verifies the generated signing link is authenticated `/loans/{id}/sign` (legacy `/sign/[token]` redirects after login). It revealed and validated fixes for number-input validation in `TransactionForm.svelte` and `LoanForm.svelte` (`String(value).trim()` instead of assuming a string from `type="number"` inputs).
- E2E advanced-controls coverage verifies the settings maintenance controls, the new-borrower modal from the loan form, the valid signing page controls, and loan duplication from the detail page. The duplication test exposed a UTF-8 `btoa` crash when duplicate data contained non-Latin1 characters; it now uses `src/lib/base64-url.ts` helpers for safe encoding/decoding.
- Inline edit forms on detail pages are keyed by entity ID so client-side navigation between different investors/borrowers/witnesses/debts/loans resets form state instead of showing stale data from the previously viewed entity.
