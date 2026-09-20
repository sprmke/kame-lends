# Commissioned

**Route:** `/loans?scope=commissioned` (legacy `/commissioned` redirects)  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is an **investor**, **borrower**, or **witness** **and** has a private commission configured (`loan_user_commissions`, rate or fixed amount &gt; 0). Loans with no commission for the viewer are excluded. Loan fields stay read-only; commission is the focus. Table checkboxes and bulk add-to-group match **Managing**.

**Summary cards** (`LoanCommissionSummaryCards`): Principal (peak concurrent in the selected due-date range), Commission Estimate (open loans), Commission Earned (`Completed` loans), and Completed count. Stats use each loan's `myCommission` via `computePartyCommissionStats` in [`src/lib/loan-list-summary.ts`](../../../src/lib/loan-list-summary.ts). Commission cards appear only on this tab, not on **Invested**, **Borrowed**, or **Witnessed**.

Date range, search, status/type filters, More Filters, export PDF, cards/table/calendar, and row actions match `/loans` party scopes (read-only; **Add Commission** and **Contract Details** in the ⋯ menu). Grid cards show **Principal**, **Rate** (commission rate or **Fixed**), **Due**, and **Commission** from each loan's `myCommission` (`LoanCard` `showCommissionMetrics`).

On loan detail, each party edits **their** commission in **Your Commission** (`LoanMyCommissionCard`, `GET` / `PATCH /api/loans/[id]/my-commission`). Other users on the same loan never see that section.

## Load

[`src/routes/loans/+page.server.ts`](../../../src/routes/loans/+page.server.ts) → `getCachedLoansByScope(userId, 'commissioned', 'list')` (union of investment, borrowed, and witnessed IDs). [`LoanListPage`](../../../src/lib/components/loans/LoanListPage.svelte) filters to `loanHasPartyCommission` before the table and summary cards.

## Permissions

Requires session. Empty list if the user has no party loans with commission set. Commission edit on detail only (`hasMyCommissionAccess` in `src/lib/server/loan-user-commission.ts`: borrower, investor, or witness on the loan; not loan managers or group viewers).
