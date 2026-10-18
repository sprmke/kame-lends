# Investors list (`/investors`)

**Status:** Documented  
**Updated:** 2026-09-16

## Behavior

- Lists investor contacts with portfolio stats. Search by name or email. People saved as a borrower or witness with an email appear here too, including those with no investments yet. The email is the same user as the borrower and witness rows, and the same Google sign-in.
- Inline filter: loan exposure (**All** / **Active** open loans / **Overdue**). **Active** means at least one linked loan is not `Completed`. **Overdue** means at least one linked loan has status `Overdue`.
- Table or card view; export PDF when the list has data. Card view (`GridListCardShell`): tap the card to open; **⋯** top-right (Edit, Delete).

## Implementation map

| Concern | Path                                                           |
| ------- | -------------------------------------------------------------- |
| Page    | `src/routes/investors/+page.svelte`                            |
| Filter  | `src/lib/list-filters.ts` (`matchesParticipantExposureFilter`) |
