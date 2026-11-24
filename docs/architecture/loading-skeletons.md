# Loading skeletons

**Status:** Current  
**Updated:** 2026-11-23

Skeletons exist to keep the page shape stable while streamed data loads. They mirror the real layout at every breakpoint, then hand off to the real content without a different page structure.

## Principles

1. **Mirror the final layout.** Each skeleton uses the same grid, card padding, row height, and control heights as the component it replaces. A table skeleton is a table; a card list is a card grid; the mobile loan default is a timeline.
2. **Breakpoint-accurate.** Skeletons use the same `lg` boundary as the responsive view mode. Below `lg` they show cards or the timeline; at `lg+` they show the table or calendar. When the view mode has resolved on the client, `ListPageSkeleton` uses it directly instead of the CSS fallback.
3. **Only while data is pending.** Pages render the skeleton only while the streamed promise is unresolved (`items === null`, `loans === null`, `{#await}`). Refreshes and invalidations keep the current data on screen.
4. **Modal headers stay with the modal.** `ResponsiveModal` owns the title/actions header. Detail and form skeletons used inside a modal omit the page header (`variant="modal"` or `showHeader={false}`) so there is never a second title block in the body.
5. **Empty vs non-empty.** Skeleton cards and rows use the same default page size as the list (9 cards, 10 table rows). An empty list collapses to the shared `ListEmptyState`; the skeleton never renders the empty-state copy. Do not add a skeleton for data that is already available during SSR.
6. **Delayed navigation chrome.** The layout waits ~120ms (`createDelayedFlag`) before replacing the old page during client navigation, so fast taps do not flash skeleton chrome. In-page skeletons appear immediately for streamed data because SSR already rendered the page shell.

## Inventory

### Layout navigation

`src/routes/+layout.svelte` maps the destination path to one of:

| Destination                                                                   | Skeleton                                                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                                                  | `DashboardSkeleton`                                                                                                                   |
| `/loans`, `/investments`, `/borrowed`, `/commissioned`, `/witnessed`          | `ListPageSkeleton` loan scope (header, scope tabs on `/loans`, summary cards, date range, toolbar, table below `lg` / timeline above) |
| `/groups`                                                                     | `ListPageSkeleton variant="groups"`                                                                                                   |
| `/{investors,borrowers,witnesses,debts,transactions}`                         | matching list variant                                                                                                                 |
| `/loans/[id]`                                                                 | `DetailPageSkeleton variant="loan"`                                                                                                   |
| `/loans/[id]/sign`                                                            | `DetailPageSkeleton variant="signing"`                                                                                                |
| `/groups/[id]`                                                                | `DetailPageSkeleton variant="group"`                                                                                                  |
| `/debts/[id]`                                                                 | `DetailPageSkeleton variant="debt"`                                                                                                   |
| `/investors/[id]`, `/borrowers/[id]`, `/witnesses/[id]`, `/transactions/[id]` | matching detail variant                                                                                                               |
| `/settings`                                                                   | `DetailPageSkeleton variant="settings"`                                                                                               |
| `/loans/new`                                                                  | `DetailPageSkeleton variant="loan-form"`                                                                                              |
| `/debts/new`                                                                  | `DetailPageSkeleton variant="debt-form"`                                                                                              |
| `/transactions/new`                                                           | `DetailPageSkeleton variant="transaction-form"`                                                                                       |
| `/{investors,borrowers,witnesses}/new`                                        | `DetailPageSkeleton variant="party-form"`                                                                                             |

### Shared primitives (`src/lib/components/common/page-skeletons/`)

| File                                                             | Use                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ListPageHeaderSkeleton`                                         | Page title, description, desktop actions                                                |
| `ListPageFiltersSkeleton`                                        | Search, inline filters, view toggle, More Filters, Clear, date range, trailing controls |
| `DataTableSkeleton`                                              | Column-weighted table rows, pill/numeric cells, row actions, inside/outside pagination  |
| `ListCardSkeleton` / `CardGridSkeleton`                          | Borrower, investor, witness, debt, transaction, loan, and group cards                   |
| `TimelineSkeleton`                                               | Loan timeline months, day markers, and movement rows                                    |
| `CalendarSkeleton`                                               | Calendar header, week strip, month grid                                                 |
| `SkeletonMetricCard` / `SkeletonMetricGrid`                      | `SummaryCard` metric rows                                                               |
| `SkeletonMetricCell`                                             | `dashboard-metric-cell` grids (loan/debt summaries)                                     |
| `ActivityCardsSkeleton`                                          | Dashboard and investor “needs attention” panels                                         |
| `ContactInfoCardSkeleton`                                        | Borrower/witness contact card                                                           |
| `DetailHeaderSkeleton`                                           | Page-level `DetailHeader`                                                               |
| `DetailModalHeaderSkeleton`                                      | `ResponsiveModal` header with actions                                                   |
| `LoanDetailSkeleton` -> page/modal                               | Loan summary, details, investors, witnesses                                             |
| `InvestorDetailSkeleton`                                         | Tabs, 8 overview metric cards, activity cards (overview tab is the default)             |
| `BorrowerDetailSkeleton` / `WitnessDetailSkeleton` -> page/modal | Header, contact card, metrics (borrower), loan rows                                     |
| `DebtDetailSkeleton` -> page/modal                               | Bank loan summary cells and interest overview                                           |
| `TransactionDetailSkeleton` -> page/modal                        | Detail card cells                                                                       |
| `GroupDetailSkeleton`                                            | Hub header, tabs, summary, overview cards                                               |
| `SigningPageSkeleton`                                            | Contract preview + signature + consent cards                                            |
| `SettingsPageSkeleton`                                           | Account card plus manager cards                                                         |
| `PartyProfileFormSkeleton`                                       | Contact details, ID/signature uploads, payment methods                                  |
| `SkeletonField` / `SkeletonIdentity`                             | Field and identity row building blocks                                                  |
| `SelectTriggerSkeleton`                                          | `SearchableSelect` while its options load                                               |

### Inline loading states

| Component                                                                                                     | Skeleton                                                                                |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `BorrowerDetailModal`, `WitnessDetailModal`, `LoanDetailModal`, `DebtDetailModal`                             | Header skeleton plus the matching modal detail body                                     |
| `DebtCreateModal`, `TransactionCreateModal`, `LoanCreateModal`, `LoanDetailModal` edit, `EditFormSheet` forms | `FormPageSkeleton showHeader={false}`                                                   |
| `PartyUserEditForm`                                                                                           | `PartyProfileFormSkeleton`; page header only when the form renders its own `FormHeader` |
| `LoanSigningSection`                                                                                          | Contract-signing card with name/role rows                                               |
| `GroupDefaultWitnessesCard`                                                                                   | Witness rows while `/default-witnesses` loads                                           |
| `AddGroupLoansSheet`, `CreateGroupWizard`, group add-rule modal                                               | Search/select row skeletons while contacts/loans load                                   |
| `AccessPreview`                                                                                               | Summary plus “will get access” rows while the preview is checked                        |
| `DataHealthCard`, `RecentlyDeletedCard`                                                                       | Result rows while the explicit action runs                                              |
| `ApexChart`                                                                                                   | Muted chart block until the dynamic import renders                                      |

## Responsive checks

`ListPageSkeleton` renders both branches when the client view mode is unknown (SSR and first paint):

```svelte
<div class="hidden lg:block">{table}</div>
<div class="lg:hidden">{cards or timeline}</div>
```

After `createResponsiveViewMode().isReady`, pages pass `viewMode` and `ready`, and only the resolved branch renders. This keeps phones on cards/timeline even when the persisted preference or SSR default is a table.

## When adding a page

1. Gate on the real data source, not a timer.
2. Pick the final layout (table, cards, timeline, calendar, or form).
3. Reuse a primitive above. If the layout is new, add it to `page-skeletons/`.
4. Check `sm`, `lg`, `xl`, and `2xl` widths against the real component.
5. Inside a modal, omit the page header.
6. Add the variant to `DetailPageSkeleton` or `ListPageSkeleton` if navigation should show it.
