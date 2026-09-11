# Investor detail (`/investors/[id]`)

**Status:** Documented  
**Updated:** 2026-09-11

## Behavior

CRM-style investor profile: contact header, tabs (Overview, Loans, Borrowings), and summary metrics on Overview.

Overview type/status filters apply to loan capital and interest cards, plus Total Lot. Borrowing cards use all borrowings for this investor (not filtered by loan type/status).

### Summary cards (all-time)

**Loan capital and interest** use `computeInvestorPortfolioCapitalStats` on this investor's rows from the `loans` load (includes `interestPeriods` for multi-period loans). Peak concurrent paid allocation: sequential non-overlapping periods count once; overlapping periods add together.

| Card                    | Meaning                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Total Capital**       | Peak paid allocation capital (loan count subtitle)                                                                                     |
| **Active**              | Peak on open-loan allocations (open loan count subtitle)                                                                               |
| **Active Borrowings**   | Peak concurrent principal on borrowings still being repaid                                                                             |
| **Borrowing Cost Paid** | Interest and fees already paid on borrowings                                                                                           |
| **Upcoming Earnings**   | Scheduled interest on open loan allocations                                                                                            |
| **Interest Earned**     | Scheduled interest on completed loan allocations                                                                                       |
| **Total Loan Interest** | Upcoming earnings plus interest earned (sub: `Upcoming - Earned`)                                                                      |
| **Net Earnings**        | Total loan interest minus borrowing cost paid (sub: `Loan interest - Borrowing cost`, or `Loan interest scheduled` when no borrowings) |
| **Total Lot**           | Lot sqm from filtered Lot Title loans                                                                                                  |

Borrowing cards hide when the investor has no borrowings.

### Loans tab

The loans table shows this investor's **capital per loan** in the Principal column (sum of their `loan_investors` rows on that loan), with their average interest rate below. It does not show full loan principal when other investors are on the same loan. Loan filters (Total Principal, Avg. Rate, etc.) use the same investor-scoped totals.

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
