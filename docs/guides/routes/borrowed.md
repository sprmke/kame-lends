# Borrowed

**Route:** `/borrowed`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is the borrower (`borrowers.borrower_user_id` → `loans.borrower_id`).

Read-only list and loan detail. Sign CTA when a borrower signature slot is open: `/loans/[id]/sign`.

## Load

[`src/routes/borrowed/+page.server.ts`](../../../src/routes/borrowed/+page.server.ts) → `getCachedLoansByScope(userId, 'borrowed', 'list')`.

## Permissions

Requires session. No create/edit/delete/payment actions.
