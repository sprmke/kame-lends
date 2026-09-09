# Dashboard (`/dashboard`)

Status: **Documented**

## Behavior

Signed-in overview of lending performance: summary metrics, activity panels, analytics charts, and portfolio distribution. Unauthenticated users redirect to `/signin`.

Load is split into two streamed promises:

1. **Summary** (`queryDashboardSummary`): metrics + activity panels. Uses slim list caches (`getCachedLoans` / `getCachedInvestors` in `list` mode).
2. **Charts** (`queryDashboardCharts`): cashflow, investor capital, and portfolio donuts. Reuses the same loan/investor caches when warm; fetches transactions separately for cashflow.

While summary loads, `DashboardSummarySkeleton` renders (header, 5 summary cards, 4 activity panels). Charts show `DashboardChartsSkeleton` until the second promise resolves.

On client navigation to `/dashboard`, the layout swaps in `DashboardSkeleton` (summary + charts) until navigation completes. `NavigationProgress` runs on every client-side route change.

List pages (`/loans`, `/investors`, `/debts`, `/transactions`) use route-specific `ListPageSkeleton` variants with matching header actions, filters, and table column layouts.

## Load / actions

`src/routes/dashboard/+page.server.ts`:

- Requires a session (`requireUserSession`).
- Returns streamed `summary` and `charts` promises.
- No form actions.

`src/lib/server/dashboard-data.ts` — summary and charts share list-mode caches; errors return empty objects rather than failing the page.

## Validation

None. Read-only.

## Permissions

Admin and investor sessions can open `/dashboard`. Data is scoped to the signed-in user (owned loans plus shared investor loans).

## Edge cases

- Empty activity hides the activity section below `2xl`; the skeleton always shows all four panels (data is unknown while loading).
- On phone (`<lg`), chrome is the bottom tab bar + top bar (Dashboard is a primary tab). Content uses `pt-mobile-top` / `pb-mobile-tab` clearance.
- Empty charts show the chart empty state, not the skeleton.
- Summary stream failure shows `Dashboard failed to load`; chart stream failure shows `Charts failed to load` below a loaded summary.
- Investor capital uses a horizontal grouped bar chart so names stay readable. Hover a bar for Capital and Interest amounts.
- Portfolio donuts show the loan count in the center. Hover a slice or a legend row to highlight it; the tooltip includes count and percent.
- Chart entrance motion (bars grow, arcs wind in, lines draw) respects `prefers-reduced-motion`.

## Implementation map

| Piece            | Path                                                        |
| ---------------- | ----------------------------------------------------------- |
| Page             | `src/routes/dashboard/+page.svelte`                         |
| Load             | `src/routes/dashboard/+page.server.ts`                      |
| Root layout      | `src/routes/+layout.svelte` (nav-to-dashboard skeleton)     |
| Full skeleton    | `src/lib/components/common/DashboardSkeleton.svelte`        |
| Summary skeleton | `src/lib/components/common/DashboardSummarySkeleton.svelte` |
| Charts skeleton  | `src/lib/components/common/DashboardChartsSkeleton.svelte`  |
| Summary metrics  | `src/lib/components/common/SummaryCard.svelte`              |
| Activity         | `src/lib/components/common/DashboardActivityCards.svelte`   |
| Charts           | `src/lib/components/charts/*`                               |
| Query            | `src/lib/server/dashboard-data.ts`                          |
| Nav progress     | `src/lib/components/common/NavigationProgress.svelte`       |
