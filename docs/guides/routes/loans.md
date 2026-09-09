# Loans list (`/loans`)

**Status:** Documented (mobile shell notes)  
**Updated:** 2026-09-09

## Behavior

- Lists loans with search, filters, cards/table/calendar view modes.
- **Phone (`<lg`):** card/row open navigates to `/loans/[id]` (native stack). Create / quick-pay / export use bottom sheets via `ResponsiveModal` where applicable.
- **Desktop (`lg+`):** row quick-view may open `LoanDetailModal`; sidebar nav remains.
- Primary destinations live in the bottom tab bar; Settings is under More.

## Implementation

| Concern        | Path                                                      |
| -------------- | --------------------------------------------------------- |
| Page           | `src/routes/loans/+page.svelte`                           |
| Table          | `src/lib/components/loans/LoansTable.svelte`              |
| Create overlay | `src/lib/components/loans/LoanCreateModal.svelte`         |
| Shell          | `src/lib/components/Nav.svelte`, `src/lib/nav/app-nav.ts` |
