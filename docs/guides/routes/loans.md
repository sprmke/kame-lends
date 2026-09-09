# Loans list (`/loans`)

**Status:** Documented (mobile shell notes)  
**Updated:** 2026-09-09

## Behavior

- Lists loans with search, filters, cards/table/calendar view modes.
- **Phone (`<lg`):** card/row open navigates to `/loans/[id]` via `isMobileShellViewport()`. New loan goes to `/loans/new` on phone (modal on desktop). Create / quick-pay / export / detail quick-view use bottom sheets via `ResponsiveModal` (presentation locked while open; sheet under `lg`). Modal create forms use `FormHeader variant="embedded"`. List page titles come from `MobileTopBar` (PageHeader title hidden under `lg`). Calendar defaults to day view under `lg`.
- **Desktop (`lg+`):** row quick-view may open `LoanDetailModal`; sidebar nav remains.
- Primary destinations live in the bottom tab bar; Settings is under More.

## Implementation

| Concern        | Path                                                      |
| -------------- | --------------------------------------------------------- |
| Page           | `src/routes/loans/+page.svelte`                           |
| Table          | `src/lib/components/loans/LoansTable.svelte`              |
| Create overlay | `src/lib/components/loans/LoanCreateModal.svelte`         |
| Shell          | `src/lib/components/Nav.svelte`, `src/lib/nav/app-nav.ts` |
