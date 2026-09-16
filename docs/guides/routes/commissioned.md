# Commissioned

**Route:** `/loans?scope=commissioned` (legacy `/commissioned` redirects)  
**Status:** Documented

## Behavior

Lists loans where the signed-in user is an **investor**, **borrower**, or **witness** **and** has commission configured on that loan (rate or fixed amount &gt; 0 on their slot). Loans with no commission for your role are excluded. Read-only list and loan detail; commission is the focus.

**Summary cards** (`LoanCommissionSummaryCards`): Principal (peak concurrent in the selected due-date range), Commission Estimate (open loans; rate % of principal or fixed), Commission Earned (`Completed` loans), and Completed count. Stats sum **your** commission slots on each loan (borrower `loans.profit`, witness `loan_witnesses`, investor `loan_investors`) via `computePartyCommissionStats` in [`src/lib/loan-list-summary.ts`](../../../src/lib/loan-list-summary.ts). Commission cards appear only on this tab, not on **Investing**, **Borrowed**, or **Witnessed**.

Date range, search, status/type filters, More Filters, export PDF, cards/table/calendar, and row actions match `/loans` party scopes (read-only; **Add Commission** and **Contract Details** in the ⋯ menu).

On loan detail, each party edits **their** commission in **Your Commission** (borrower: `LoanBorrowerProfitCard`, `PATCH /api/loans/[id]/profit`; investor: `LoanInvestorCommissionCard`, `PATCH /api/loans/[id]/investors/[loanInvestorId]/commission`; witness: `LoanWitnessesSection`, `PATCH /api/loans/[id]/witnesses/[witnessLoanId]`). No loan manager role required beyond party membership.

## Load

[`src/routes/loans/+page.server.ts`](../../../src/routes/loans/+page.server.ts) → `getCachedLoansByScope(userId, 'commissioned', 'list')` (union of investment, borrowed, and witnessed IDs). [`LoanListPage`](../../../src/lib/components/loans/LoanListPage.svelte) filters to `loanHasPartyCommission` before the table and summary cards. Passes `myInvestorIds` / `myWitnessIds` for stat aggregation.

## Permissions

Requires session. Empty list if the user has no borrower linkage. Commission edit on detail only (`hasBorrowerProfitWriteAccess`).
