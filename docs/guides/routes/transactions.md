# Transactions (`/transactions`)

**Status:** Documented  
**Updated:** 2026-11-23

## Behavior

- Lists investor transactions (`In` / `Out`) with search by name, investor, or notes. Inline filters: direction and investor (both multi-select). Table or card view.
- Table: date, name, investor (`md+`), type (`lg+`), direction, amount. Rows open `/transactions/[id]`. Pagination sits below the table card.
- Card view: title plus type/direction badges, then date / amount / investor cells. Pagination is shared.
- Add Transaction opens `/transactions/new` on desktop and `TransactionCreateModal` on phone. The whole UI is behind `SHOW_TRANSACTIONS_UI`.
- `/transactions/[id]` shows the transaction fields (investor, date, type, direction, amount, balance) and optional notes. It uses `PageHeader` with a desktop Back button.

## Load

[`src/routes/transactions/+page.server.ts`](../../../src/routes/transactions/+page.server.ts) streams `items`. [`src/routes/transactions/[id]/+page.server.ts`](../../../src/routes/transactions/[id]/+page.server.ts) loads the entity.

## Loading

- List: `ListPageSkeleton variant="transactions"` mirrors the header, search + direction/investor filters, and the resolved view (table at `lg+`, transaction cards below `lg`). Table rows use the real column visibility; pagination is outside the table card, matching the loaded component.
- Detail: `TransactionDetailSkeleton` mirrors the page header and the six-field card. The modal variant omits the page header.
- Create sheet: `FormPageSkeleton showHeader={false}` while investors load.

## Implementation map

| Concern      | Path                                                            |
| ------------ | --------------------------------------------------------------- |
| List page    | `src/routes/transactions/+page.svelte`                          |
| Detail page  | `src/routes/transactions/[id]/+page.svelte`                     |
| Table        | `src/lib/components/transactions/TransactionsTable.svelte`      |
| Cards        | `src/lib/components/transactions/TransactionCard.svelte`        |
| Create modal | `src/lib/components/transactions/TransactionCreateModal.svelte` |
