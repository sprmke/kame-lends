# Witnessed

**Route:** `/witnessed`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is a contract witness (`witnesses.witness_user_id` on a signing invitation for that loan).

Read-only list and detail. Sign via `/loans/[id]/sign` when their witness slot is unsigned.

## Load

[`src/routes/witnessed/+page.server.ts`](../../../src/routes/witnessed/+page.server.ts) → `getCachedLoansByScope(userId, 'witnessed', 'list')`.

## Permissions

Requires session. No create/edit/delete/payment actions.
