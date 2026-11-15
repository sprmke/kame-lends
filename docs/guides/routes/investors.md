# Investors list (`/investors`)

**Status:** Documented  
**Updated:** 2026-09-16

## Behavior

- Lists investor contacts with portfolio stats. Search by name or email. People saved as a borrower or witness with an email appear here too, including those with no investments yet. The email is the same user as the borrower and witness rows, and the same Google sign-in. Each name appears once. Saving the same name again updates that investor.
- Inline filter: loan exposure (**All** / **Active** open loans / **Overdue**). **Active** means at least one linked loan is not `Completed`. **Overdue** means at least one linked loan has status `Overdue`.
- Table or card view; export PDF when the list has data. Card view (`GridListCardShell`): tap the card to open; **⋯** top-right (Edit, Delete).

## Implementation map

| Concern | Path                                                           |
| ------- | -------------------------------------------------------------- |
| Page    | `src/routes/investors/+page.svelte`                            |
| Filter  | `src/lib/list-filters.ts` (`matchesParticipantExposureFilter`) |

## Money correctness (2026-11)

- Investor totals are grouped **by loan, then by investor**. Two loans for the same person never share one schedule.
- Allocations with the same investor on one loan count as one loan and use that investor's total capital for rate periods.
- The list, cards, detail, PDF, CSV, and dashboard chart use the same ledger aggregates. If they disagree, the screen is wrong.
- `totalGain` is kept for compatibility but means capital + interest; new code uses `totalWithInterest`.
