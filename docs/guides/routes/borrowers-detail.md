# Borrower detail (`/borrowers/[id]`)

**Status:** Documented  
**Updated:** 2026-09-10

## Behavior

- Shows contact info, notes, and linked loans (type/status/due + Open).
- Edit via header or `?edit=1`. On phone that opens `EditFormSheet` over the detail. Desktop stays inline `BorrowerForm`.
- Delete requires zero linked loans.
- Desktop list quick-view uses the same content inside `BorrowerDetailModal`, including in-modal edit.

## Permissions

Owner-scoped (`borrowers.userId` = session user). Non-owners get 404.

## Load

[`src/routes/borrowers/[id]/+page.server.ts`](../../../src/routes/borrowers/[id]/+page.server.ts) loads the borrower with loans.

## Implementation map

| Concern     | Path                                                        |
| ----------- | ----------------------------------------------------------- |
| Page        | `src/routes/borrowers/[id]/+page.svelte`                    |
| Client      | `src/lib/components/borrowers/BorrowerDetailClient.svelte`  |
| Content     | `src/lib/components/borrowers/BorrowerDetailContent.svelte` |
| Form        | `src/lib/components/borrowers/BorrowerForm.svelte`          |
| Create page | `src/routes/borrowers/new/+page.svelte`                     |
| API         | `src/routes/api/borrowers/[id]/+server.ts`                  |
