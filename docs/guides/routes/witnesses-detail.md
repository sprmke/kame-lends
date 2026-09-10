# Witness detail (`/witnesses/[id]`)

**Status:** Documented  
**Updated:** 2026-09-10

## Behavior

- Shows contact info and witnessed loans (party role, signed date, type/status/due + Open).
- Edit via header or `?edit=1`. On phone that opens `EditFormSheet` over the detail. Desktop stays inline `WitnessForm`.
- Delete requires zero signing invitations.
- Desktop list quick-view uses the same content inside `WitnessDetailModal`, including in-modal edit.

Witnessed loans come from `loan_signing_invitations` where `witness_id` matches. Investor transactions are not linked to witnesses in the data model.

## Permissions

Owner-scoped (`witnesses.user_id` = session user). Non-owners get 404.

## Load

[`src/routes/witnesses/[id]/+page.server.ts`](../../../src/routes/witnesses/[id]/+page.server.ts) loads the witness with signing invitations and loan summaries.

## Implementation map

| Concern     | Path                                                       |
| ----------- | ---------------------------------------------------------- |
| Page        | `src/routes/witnesses/[id]/+page.svelte`                   |
| Client      | `src/lib/components/witnesses/WitnessDetailClient.svelte`  |
| Content     | `src/lib/components/witnesses/WitnessDetailContent.svelte` |
| Form        | `src/lib/components/witnesses/WitnessForm.svelte`          |
| Create page | `src/routes/witnesses/new/+page.svelte`                    |
| API         | `src/routes/api/witnesses/[id]/+server.ts`                 |
