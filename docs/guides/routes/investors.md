# Investors list (`/investors`)

**Status:** Documented  
**Updated:** 2026-09-16

## Behavior

- Lists investor contacts with portfolio stats. Search by name or email.
- Inline filter: loan exposure (**All** / **Active** open loans / **Overdue**). **Active** means at least one linked loan is not `Completed`. **Overdue** means at least one linked loan has status `Overdue`.
- Table or card view; export PDF when the list has data.

## Implementation map

| Concern | Path                                                           |
| ------- | -------------------------------------------------------------- |
| Page    | `src/routes/investors/+page.svelte`                            |
| Filter  | `src/lib/list-filters.ts` (`matchesParticipantExposureFilter`) |
