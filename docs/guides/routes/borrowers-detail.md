# Borrower detail (`/borrowers/[id]`)

**Status:** Documented  
**Updated:** 2026-09-11

## Behavior

- Shows contact info, summary stat cards (when the borrower has loans), notes, and linked loans (type/status/due + Open).
- Summary cards: **Active Balance** (open-loan principal), **Interest** (open-loan interest), **Total Due** (principal + interest on open loans), **Overdue** (past-due amount + count), **Completed** (closed loan count), **Total Lot** (when lot sqm exists).
- Edit via header or `?edit=1` (workspace admin only). Uses shared `PartyUserEditForm`: contact details, valid ID, e-signature (upload or draw), payment methods. Hover (or tap on phone) an ID, signature, or QR preview to Replace or Remove. Saves sync across all CRM rows for the same linked party user. On phone that opens `EditFormSheet` over the detail.
- Delete requires zero linked loans.
- Desktop list quick-view uses the same content inside `BorrowerDetailModal`, including in-modal edit.

## Permissions

Owner or linked borrower (`borrower_user_id`). Workspace owner can edit. Linked party is read-only. Others get 404.

## Load

[`src/routes/borrowers/[id]/+page.server.ts`](../../../src/routes/borrowers/[id]/+page.server.ts) loads the borrower with loans and `loanInvestors` (for stat calculations). Modal refresh uses [`src/routes/api/borrowers/[id]/+server.ts`](../../../src/routes/api/borrowers/[id]/+server.ts) with the same shape.

## Implementation map

| Concern     | Path                                                        |
| ----------- | ----------------------------------------------------------- |
| Page        | `src/routes/borrowers/[id]/+page.svelte`                    |
| Client      | `src/lib/components/borrowers/BorrowerDetailClient.svelte`  |
| Content     | `src/lib/components/borrowers/BorrowerDetailContent.svelte` |
| Stats       | `src/lib/calculations.ts` (`calculateBorrowerStats`)        |
| Form        | `src/lib/components/borrowers/BorrowerForm.svelte`          |
| Create page | `src/routes/borrowers/new/+page.svelte`                     |
| API         | `src/routes/api/borrowers/[id]/+server.ts`                  |
