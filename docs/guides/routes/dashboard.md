# Dashboard (`/dashboard`)

Status: **Documented**

## Behavior

**Page header:** Subtitle from `PAGE_DESCRIPTIONS.dashboard` (`src/lib/page-descriptions.ts`).

Signed-in overview of lending performance: summary metrics, activity panels, analytics charts, and portfolio distribution. Unauthenticated users redirect to `/signin`.

**Summary cards (all-time, all loans):** Same metrics as `/loans` summary cards, plus **Active** principal. Peak concurrent paid capital (`computePortfolioCapitalStats` in `src/lib/loan-list-summary.ts`), no date-range clip. **Total Principal** = busiest day across full loan history. **Active** = peak on open loans only. **Interest Estimate** = scheduled interest on open loans. **Interest Earned** = scheduled interest on completed loans. Reused capital counts once when loan periods do not overlap. No completed-principal or total-earnings cards (completed capital is often redeployed into new loans).

Load is split into two streamed promises:

1. **Summary** (`queryDashboardSummary`): metrics + activity panels. Uses slim list caches (`getCachedLoans` / `getCachedInvestors` in `list` mode).
2. **Charts** (`queryDashboardCharts`): cashflow, investor capital, and portfolio donuts. Reuses the same loan/investor caches when warm; fetches transactions separately for cashflow.

While summary loads, `DashboardSummarySkeleton` renders the page chrome: `PageHeader`-shaped title row, 4 summary metric cards, and 4 activity panels (each with grouped loan rows). Charts show `DashboardChartsSkeleton` (section heading + chart cards) until the second promise resolves. Skeletons use the same card and toolbar surfaces as the loaded page. No orphan bars.

**Analytics layout:** When the user has at least one group (`SHOW_GROUPS_UI` and non-empty `groupsIndex`), **Your groups** (`DashboardGroupsCard`, copy from `PAGE_DESCRIPTIONS.dashboardGroups`) sits in a two-column row beside **Top investors** (`CurrencyBarChart`). Cashflow (when transactions UI is on) stays full width above that row. Groups no longer appear under **Needs attention**.

**New menu:** `PageHeader` **New** dropdown matches for every signed-in user: Loan, Bank loan, Lender, Borrower, Witness, and Transaction when enabled. Sidebar is the same for party-only and workspace-owner accounts: Dashboard, Groups, **Loans**, **People**, **Tools** (Bank Loans), Settings. Investing / borrowed / witnessed lists live on **Loans** scope tabs (`/loans?scope=investing`, etc.).

On client navigation to `/dashboard`, the layout swaps in `DashboardSkeleton` (summary + charts) until navigation completes. `NavigationProgress` runs on every client-side route change.

List pages (`/loans`, `/investments`, `/borrowed`, `/witnessed`, `/investors`, `/borrowers`, `/witnesses`, `/debts`, `/transactions`) share `ListPageToolbar`: search and controls on one row on phone (view toggle, module-specific inline filters, Clear All when filters are active).

## Load / actions

`src/routes/dashboard/+page.server.ts`:

- Requires a session (`requireUserSession`).
- Returns streamed `summary` and `charts` promises.
- No form actions.

`src/lib/server/dashboard-data.ts` — summary and charts share list-mode caches; errors return empty objects rather than failing the page.

## Validation

None. Read-only.

## Permissions

Admin and party sessions can open `/dashboard`. Data is scoped to the signed-in user (owned loans plus membership loans).

## Edge cases

- Empty activity hides the activity section below `2xl`; the skeleton always shows all four panels (data is unknown while loading).
- **Maturing Soon** includes funded loans due **today** through 14 calendar days out (inclusive). **Past Due** uses calendar days: due before today, or status `Overdue`. Fully paid loans are `Completed` and are not listed. Logic: `src/lib/loan-due-date.ts`. `POST /api/loans/check-overdue` also completes fully paid loans.
- **Phone (`<lg`):** chrome is the orange brand bar (logo + app name left, actions right) + floating glass tab dock (up to four primary destinations plus More). The More sheet lists every nav link (including dock shortcuts and Settings), plus account, price visibility, and Light/Dark. The More sheet hugs its content instead of filling the screen. `PageHeader` title sits in content below the bar; description stays hidden. Content uses `pt-mobile-top` / `pb-mobile-tab` clearance (scoped to `<lg` only; desktop has no extra top offset). Section eyebrows hide; metric cards are borderless with native float shadow. Price visibility is in More, not on the dashboard body. Empty metrics stay `hidden` on phone.
- **Desktop (`lg+`):** floating rounded sidebar (`left-4 top-4`, `rounded-[1.75rem]`), main content `pt-4` to match the sidebar inset; `dashboard-page` uses horizontal padding only (no extra top padding). `PageHeader` title row is `min-h-16` to align with the sidebar logo row; descriptions sit on the next line. Light/Dark theme control above the account menu. Four compact metric cards in one row (`SummaryCard` uses `p-5`). Activity/analytics/portfolio sections use default card padding. Visual layout is asserted by `e2e/visual-parity.spec.ts`.
- Empty charts show the chart empty state, not the skeleton.
- Summary stream failure shows `Dashboard failed to load`; chart stream failure shows `Charts failed to load` below a loaded summary.
- Investor capital is a ranked list of tracks. Portfolio donuts are custom SVG rings with a center total. Legend rows show name, count, and percent.
- Hover an investor row or donut slice to highlight it. Click a series legend to show or hide that series.
- Chart entrance motion (tracks grow, donut sweep, area draw) respects `prefers-reduced-motion`.

## Implementation map

| Piece            | Path                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| Page             | `src/routes/dashboard/+page.svelte`                                           |
| Quick actions    | `src/lib/components/dashboard/DashboardQuickActionsMenu.svelte`               |
| Action catalog   | `src/lib/dashboard-quick-actions.ts`                                          |
| Load             | `src/routes/dashboard/+page.server.ts`                                        |
| Root layout      | `src/routes/+layout.svelte` (nav-to-dashboard skeleton)                       |
| Full skeleton    | `src/lib/components/common/DashboardSkeleton.svelte`                          |
| Summary skeleton | `src/lib/components/common/DashboardSummarySkeleton.svelte`                   |
| Charts skeleton  | `src/lib/components/common/DashboardChartsSkeleton.svelte`                    |
| Summary metrics  | `src/lib/components/common/SummaryCard.svelte`                                |
| Summary grid     | `src/lib/summary-grid.ts` (cols + odd-last mobile span)                       |
| Activity         | `src/lib/components/common/DashboardActivityCards.svelte`                     |
| Charts           | `src/lib/components/charts/*` (SVG donuts + ranking tracks)                   |
| Theme            | `src/lib/components/theme/ThemeToggle.svelte`, `src/lib/theme/preferences.ts` |
| Query            | `src/lib/server/dashboard-data.ts`                                            |
| Due-date windows | `src/lib/loan-due-date.ts`                                                    |
| Nav progress     | `src/lib/components/common/NavigationProgress.svelte`                         |
