# Investor detail (`/investors/[id]`)

**Status:** Documented  
**Updated:** 2026-09-20

## Behavior

CRM-style investor profile: contact header, tabs (Overview, Loans, Borrowings), and summary metrics on Overview.

Borrowing summary cards use all borrowings for this investor.

### Summary cards (all-time)

**Loan capital and interest** use `computeInvestorPortfolioCapitalStats` on this investor's rows from the `loans` load (includes `interestPeriods` for multi-period loans). Peak concurrent paid allocation: sequential non-overlapping periods count once; overlapping periods add together.

| Card                    | Meaning                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Total Capital**       | Peak paid allocation capital (loan count subtitle)                                                                                               |
| **Active**              | Peak on open-loan allocations (open loan count subtitle)                                                                                         |
| **Active Borrowings**   | Peak concurrent principal on borrowings still being repaid                                                                                       |
| **Borrowing Cost Paid** | Interest and fees already paid on borrowings                                                                                                     |
| **Interest Estimate**   | Scheduled interest on all loan allocations (open and completed)                                                                                  |
| **Interest Earned**     | Scheduled interest on completed loan allocations                                                                                                 |
| **Net Earnings**        | Total scheduled loan interest minus borrowing cost paid (sub: `Loan interest - Borrowing cost`, or `Loan interest scheduled` when no borrowings) |
| **Total Lot**           | Lot sqm from Lot Title loans for this investor                                                                                                   |

Borrowing cards hide when the investor has no borrowings.

### Loans tab

The loans table shows this investor's **capital per loan** in the Principal column (sum of their `loan_investors` rows on that loan), with their average interest rate below. It does not show full loan principal when other investors are on the same loan. Loan filters (Total Principal, Avg. Rate, etc.) use the same investor-scoped totals.

**Date range:** Same control as `/loans` (month/week/year/all-time/custom via URL `from`/`to` or `range=all`). Filters rows by loan **due date** and drives the four summary cards below.

**Summary cards (Loans tab):** Principal, Interest Estimate, Interest Earned, Completed (same layout as `/loans`). Metrics use this investor's paid allocations on loans in the date range (`computeInvestorLoanListSummaryStats`), not full-loan totals.

**Bulk select:** When groups are enabled and the viewer can manage the workspace, the table shows row checkboxes (desktop always; phone uses the same table). **Summary** opens a modal with investor-scoped totals for the selection. **Add to group** uses the shared group picker (`POST /api/groups/:id/loans`).

`InvestorDetailContent` also embeds on the group People tab (`embedded`, no Borrowings tab) with loans limited to that group. Investor rows stay allocation-scoped; owner/borrower/witness rows use full loan principal for summary cards when `scopeToInvestor` is false.

## Load

`src/routes/investors/[id]/+page.server.ts` loads investor with debts, transactions, and loans tied to this investor only.

## Edit

Workspace admin: header **Edit** or list quick-edit opens `PartyUserEditForm` (contact details, valid ID, e-signature upload or draw, payment methods). Hover (or tap on phone) a valid ID or QR preview to Replace or Remove; on a saved signature, Replace, Draw, or Remove. With no signature yet, use Upload or Draw tabs. Saves via `PUT /api/party-profiles/investor/[id]` and syncs shared fields across all investor/borrower/witness CRM rows for the same linked party user.

## Permissions

Admin workspace owners can edit. Linked party users can view the same CRM page read-only when they have access to the contact. Party activity also lives on `/investments`.

## Implementation map

| Piece           | Path                                                        |
| --------------- | ----------------------------------------------------------- |
| Page            | `src/routes/investors/[id]/+page.svelte`                    |
| Content         | `src/lib/components/investors/InvestorDetailContent.svelte` |
| Edit form       | `src/lib/components/party/PartyUserEditForm.svelte`         |
| Loan capital    | `src/lib/loan-list-summary.ts`                              |
| Borrowing stats | `src/lib/debt-calculations.ts`                              |
