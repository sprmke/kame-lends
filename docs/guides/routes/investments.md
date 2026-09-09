# Investments

**Route:** `/investments`  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is linked as an investor (`investors.investor_user_id` + `loan_investors`).

Read-focused list with in-app calendar. No New Loan or Google Calendar sync controls.

Opening a loan uses `/loans/[id]` with investor access: view all summary data; edit payments only for the user’s own allocation.

## Load

[`src/routes/investments/+page.server.ts`](../../../src/routes/investments/+page.server.ts) → `getCachedLoansByScope(userId, 'investments', 'list')`.

## Permissions

Requires session. Empty list if the user has no investor linkage.
