# SvelteKit parity audit (vs legacy Next.js)

Branch: `feat/sveltekit-migration`. Compared against last Next.js tree in git (`HEAD` before cutover).

**Status key:** ✅ parity · ⚠️ partial · ❌ missing/broken

Last updated: 2026-09-09

---

## Summary

Most list surfaces, modals, PDF export, investor detail tabs, loan form depth, and **debt create** are ported. Remaining gaps: **modal interaction QA**, `/sign/[token]` fixture, route guides sync.

**Verification:** `bun run check` — 0 errors (2026-09-09, session 9) · `bun run build` — pass · Playwright **13/13** with `DATABASE_URL` + `E2E_AUTH_SECRET`

| Route                                 | Code parity | Runtime verified       |
| ------------------------------------- | ----------- | ---------------------- |
| `/`, `/signin`                        | ✅          | ✅ Playwright smoke    |
| `/dashboard`                          | ✅          | ✅ E2E                 |
| `/loans`, `/loans/new`, `/loans/[id]` | ✅          | ✅ E2E                 |
| `/investors`, `/investors/[id]`       | ✅          | ✅ E2E                 |
| `/debts`, `/debts/new`, `/debts/[id]` | ✅          | ✅ E2E                 |
| `/settings`                           | ✅          | ✅ E2E                 |
| `/sign/[token]`                       | ✅          | ⚠️ needs token fixture |
| `/borrowers/[id]`                     | ✅          | ⚠️ not in E2E yet      |

**Run E2E:** `E2E_AUTH_SECRET=e2e-local-secret bun run test:e2e`

---

## Route-by-route

### `/` (landing)

| Area               | Legacy       | New                         | Status |
| ------------------ | ------------ | --------------------------- | ------ |
| Marketing sections | Full landing | `LandingPage.svelte` ported | ✅     |
| Auth CTA           | Yes          | Yes                         | ✅     |

### `/signin`

| Area         | Legacy | New | Status |
| ------------ | ------ | --- | ------ |
| Google OAuth | Yes    | Yes | ✅     |

### `/dashboard`

| Area                    | Legacy                     | New                           | Status |
| ----------------------- | -------------------------- | ----------------------------- | ------ |
| Summary metrics         | 5 cards                    | 5 cards                       | ✅     |
| Activity cards          | 4 panels                   | 4 panels                      | ✅     |
| Charts                  | Cashflow + investors + pie | Same (cashflow gated by flag) | ✅     |
| Overdue checker         | On mount                   | `OverdueChecker`              | ✅     |
| Price visibility toggle | Yes                        | Yes                           | ✅     |

### `/loans` (list)

| Area                         | Legacy                                       | New                                     | Status |
| ---------------------------- | -------------------------------------------- | --------------------------------------- | ------ |
| Search + status/type filters | Yes                                          | Yes                                     | ✅     |
| Range filters                | Principal, rate, interest, total amount      | `RangeFilter` + More Filters panel      | ✅     |
| View modes                   | table / cards / calendar                     | Yes                                     | ✅     |
| Table columns + sort         | Full set                                     | `LoansTable` full columns + sort        | ✅     |
| Row selection                | Yes                                          | Yes                                     | ✅     |
| Pagination                   | Full footer + per-page                       | Table + `CardPagination` on cards       | ✅     |
| Export PDF                   | Scope + column picker                        | `ExportButton` + `/api/export/loans`    | ✅     |
| Quick view modal             | `LoanDetailModal` inline edit + modal header | `LoanDetailModal` + `DetailModalHeader` | ✅     |
| Row actions                  | Edit, payments, duplicate, contract, delete  | Wired with handlers + dialogs           | ✅     |
| Create modal                 | `LoanCreateModal` on page                    | `LoanCreateModal` + duplicate in modal  | ✅     |
| Quick payment dialog         | `LoanQuickPaymentDialog`                     | Wired on list and detail modal          | ✅     |
| Sync calendar button         | Yes                                          | Yes                                     | ✅     |

### `/loans/new` (create)

| Area                            | Legacy                                            | New                                                   | Status |
| ------------------------------- | ------------------------------------------------- | ----------------------------------------------------- | ------ |
| Borrower select                 | Required + inline create modal                    | Required select + `BorrowerFormModal`                 | ✅     |
| Multi-investor allocation       | `LoanInvestorsSection`, multiple txs per investor | Multi-investor + multi-tx + copy config in `LoanForm` | ✅     |
| Multiple interest periods       | `MultipleInterestManager`                         | `MultipleInterestManager.svelte`                      | ✅     |
| Contract preview / signing tabs | On form                                           | `LoanContractDraftPreview` on create                  | ✅     |
| Loan preview + summary          | Collapsible preview + summary cards               | `LoanInvestorsSection` + `LoanSummarySection`         | ✅     |
| Received payments on create     | Per-investor                                      | Per-investor tabs in `LoanForm`                       | ✅     |
| Duplicate prefill               | Store + query                                     | Query param + modal duplicate                         | ✅     |
| Status calculation              | Auto from disbursement / received / due           | Ported in `LoanForm`                                  | ✅     |

### `/loans/[id]` (detail)

| Area                           | Legacy    | New                            | Status |
| ------------------------------ | --------- | ------------------------------ | ------ |
| Detail header + status actions | Yes       | `LoanDetailClient` + quick pay | ✅     |
| Investor transactions          | Full      | `InvestorTransactionsDisplay`  | ✅     |
| Signing section                | Yes       | Yes                            | ✅     |
| Contract download              | Yes       | Yes (POST PDF route)           | ✅     |
| Edit in place                  | Full form | `LoanForm` inline + `?edit=1`  | ✅     |

### `/investors` (list)

| Area          | Legacy                                | New                        | Status |
| ------------- | ------------------------------------- | -------------------------- | ------ |
| Table columns | Name, capital, rate, interest, amount | Same                       | ✅     |
| Sorting       | Yes                                   | Sortable headers           | ✅     |
| Export        | PDF                                   | `ExportButton` + API route | ✅     |
| View toggle   | table / cards                         | Yes + `CardPagination`     | ✅     |

### `/investors/[id]` (detail)

| Area                                | Legacy                     | New                              | Status |
| ----------------------------------- | -------------------------- | -------------------------------- | ------ |
| Contact + summary                   | Yes                        | Yes                              | ✅     |
| Tabs: Overview / Loans / Borrowings | Full filters + modals each | `InvestorDetailContent.svelte`   | ✅     |
| Activity cards                      | Past due, maturing, etc.   | On Overview tab                  | ✅     |
| Add loan / borrowing modals         | Yes                        | Loan create modal + debt modal   | ✅     |
| Export per tab                      | PDF scoped to investor     | Loans tab export wired           | ✅     |
| Transactions tab                    | Full                       | Omitted (`SHOW_TRANSACTIONS_UI`) | ⚠️ N/A |

### `/investors/new`

| Area        | Legacy | New            | Status |
| ----------- | ------ | -------------- | ------ |
| Create form | Yes    | `InvestorForm` | ✅     |

### `/borrowers/[id]`

| Area                   | Legacy         | New                                  | Status |
| ---------------------- | -------------- | ------------------------------------ | ------ |
| Contact + edit/delete  | `DetailHeader` | `DetailHeader` + `BorrowerForm`      | ✅     |
| Linked loans           | Count only     | Loan cards with badges               | ✅     |
| Valid ID / e-signature | On edit form   | `ValidIdUpload` + `ESignatureUpload` | ✅     |

### `/debts` (borrowings list)

| Area                  | Legacy              | New                             | Status |
| --------------------- | ------------------- | ------------------------------- | ------ |
| List + search + cards | Yes                 | Yes                             | ✅     |
| Repaid toggle         | Hide/show completed | Yes                             | ✅     |
| Interval filter       | Multi-select        | Yes                             | ✅     |
| Amount range          | `RangeFilter`       | Yes (More Filters)              | ✅     |
| Investor filter       | Multi-select        | Yes (More Filters)              | ✅     |
| Quick view modal      | `DebtDetailModal`   | `DebtDetailModal.svelte`        | ✅     |
| Table sort + actions  | Yes                 | `DebtsTable` sort + row actions | ✅     |
| Card pagination       | `CardPagination`    | Yes                             | ✅     |

### `/debts/new`, `/debts/[id]`

| Area                    | Legacy                      | New                                     | Status |
| ----------------------- | --------------------------- | --------------------------------------- | ------ |
| Create form             | Full + fees + preview       | `DebtForm` + `DebtEntryCard` + preview  | ✅     |
| Edit mode (`?edit=1`)   | Inline toggle               | `DebtDetailClient` view/edit toggle     | ✅     |
| Detail header           | `DetailHeader`              | `DetailHeader` edit/delete              | ✅     |
| Payment schedule        | Record/edit/consolidate     | `DebtPaymentSchedule` + APIs            | ✅     |
| Interest summary        | `DebtSummaryPreview`        | `DebtSummaryPreview` on detail + modal  | ✅     |
| Quick view modal        | Summary + schedule          | `DebtDetailModal` + `DetailModalHeader` | ✅     |
| Add investor inline     | `InvestorFormModal`         | `InvestorFormModal` on debt form        | ✅     |
| Multi-debt batch create | Multiple entries one submit | `entries[]` × investors batch POST      | ✅     |

### `/transactions/*` (flagged)

| Area                   | Legacy | New    | Status                   |
| ---------------------- | ------ | ------ | ------------------------ |
| List / create / detail | Full   | Ported | ⚠️ Needs QA when flag on |

### `/settings`

| Area              | Legacy                   | New                                  | Status |
| ----------------- | ------------------------ | ------------------------------------ | ------ |
| User info         | Implicit                 | Basic card                           | ✅     |
| Maintenance tools | 3 buttons + descriptions | 4 buttons + Fix Payments description | ✅     |
| Sync calendar     | On loans page in legacy  | Also on settings                     | ✅     |

### `/sign/[token]`

| Area             | Legacy | New                     | Status          |
| ---------------- | ------ | ----------------------- | --------------- |
| Contract signing | Yes    | `ContractSigningClient` | ✅ (verify E2E) |

---

## Shared components

| Component                            | Role                            | Status               |
| ------------------------------------ | ------------------------------- | -------------------- |
| `Pagination`                         | Page numbers + per-page         | ✅                   |
| `CardPagination`                     | Card grid + per-page            | ✅                   |
| `RangeFilter`                        | Min/max filters                 | ✅                   |
| `ExportButton` + modal               | PDF export                      | ✅                   |
| `LoanDetailModal`                    | Quick view                      | ✅                   |
| `LoanCreateModal`                    | Inline create + duplicate       | ✅                   |
| `LoanQuickPaymentDialog`             | Fund / received payment         | ✅                   |
| `MultipleInterestManager`            | Interest periods on loan form   | ✅                   |
| `DebtDetailModal`                    | Borrowing quick view + schedule | ✅                   |
| `DebtDetailClient`                   | Full page view/edit             | ✅                   |
| `DebtPaymentSchedule`                | Payment record/consolidate      | ✅                   |
| `DebtSummaryPreview`                 | Interest overview + schedule    | ✅                   |
| `DebtCreateModal`                    | Create borrowing in modal       | ✅ (investor detail) |
| `BorrowerFormModal`                  | Inline borrower on loan form    | ✅                   |
| `ValidIdUpload` / `ESignatureUpload` | Borrower docs                   | ✅                   |
| `ConfirmDeleteDialog`                | Delete confirm                  | ✅                   |

---

## Remaining work (priority)

1. **Modal QA** — loan quick-view, create modals, payment dialogs (open/close/save)
2. **`/sign/[token]`** — E2E with signing token fixture
3. **Route guides** — sync `docs/guides/routes/` for changed pages

---

## Files changed in parity pass (2026-09-09, session 9)

- `src/routes/api/e2e/session/+server.ts` — dev-only session bootstrap for Playwright
- `e2e/auth.setup.ts` — saves `e2e/.auth/admin.json`
- `e2e/authenticated-routes.spec.ts` — 10 authenticated route smoke tests
- `playwright.config.ts` — loads `.env.local`, smoke + authenticated projects, preview port 4174

## Files changed in parity pass (2026-09-09, session 8)

- `src/routes/investors/[id]/+page.server.ts` — load full loans for investor detail (fixes 500 risk)
- `src/lib/components/investors/InvestorDetailContent.svelte` — null-safe `loanInvestors` / `investor` access
- `src/routes/settings/+page.svelte` — legacy page description + maintenance card copy
- `playwright.config.ts` — dedicated preview port `4174` (avoids collisions)
- `e2e/smoke.spec.ts` — sign-in button matcher fix; **2/2 pass** on preview build

## Files changed in parity pass (2026-09-09, session 7)

- `src/lib/components/debts/debt-form-types.ts` — shared entry/fee types + factories
- `src/lib/components/debts/DebtEntryCard.svelte` — per-entry borrowing card + preview
- `src/lib/components/debts/DebtForm.svelte` — multi-investor select, batch create, inline add investor
- `src/lib/components/debts/DebtDetailModal.svelte` — `DetailModalHeader`, additional fees list

## Files changed in parity pass (2026-09-09, session 6)

- `src/lib/components/loans/CopyInvestorModal.svelte` — copy investor allocation config to other investors
- `src/lib/components/loans/copy-investor-utils.ts` — config comparison helpers
- `src/lib/components/loans/LoanForm.svelte` — Copy action on investor cards + modal wiring
- `src/lib/components/investors/InvestorForm.svelte` — FormHeader on standalone create/edit
- `src/routes/investors/new/+page.svelte` — legacy form-only layout

## Files changed in parity pass (2026-09-09, session 5)

- `src/lib/components/common/FormHeader.svelte` — ported legacy form page header (title + Cancel/Submit)
- `src/lib/components/investors/InvestorFormModal.svelte` — inline investor create from loan form
- `src/lib/components/investors/InvestorForm.svelte` — `onSuccess` / `onCancel` for modal use
- `src/lib/components/loans/LoanForm.svelte` — FormHeader, legacy field labels/layout, inline add investor
- `src/lib/components/debts/DebtForm.svelte` — FormHeader + Borrowing Details card title
- `src/routes/loans/new/+page.svelte` — legacy layout (form only, no duplicate PageHeader)
- `src/routes/debts/new/+page.svelte` — legacy layout (form only)
- `src/lib/components/loans/LoanDetailClient.svelte` — remove duplicate back button in edit mode

## Files changed in parity pass (2026-09-09, session 4)

- `src/lib/components/common/DetailModalHeader.svelte` — modal actions menu + close (legacy parity)
- `src/lib/components/loans/LoanDetailModal.svelte` — inline edit, legacy header layout, duplicate callback
- `src/lib/components/loans/LoanSummarySection.svelte` — fix metric tile text clipping
- `src/lib/components/loans/LoanDetailClient.svelte` — quick payment dialog + header actions
- `src/lib/components/loans/LoansTable.svelte` — show Rate/Interest/Amount at all widths; actions from md+
- `src/routes/loans/+page.svelte` — duplicate from detail modal opens create modal

## Files changed in parity pass (2026-09-09, session 3)

- `src/lib/components/debts/DebtPaymentSchedule.svelte` — new
- `src/lib/components/debts/DebtSummaryPreview.svelte` — new
- `src/lib/components/debts/DebtForm.svelte` — edit mode, fees, preview
- `src/lib/components/debts/DebtDetailClient.svelte` — new (view/edit + `DetailHeader`)
- `src/lib/components/debts/DebtDetailModal.svelte` — `DebtSummaryPreview` in quick view
- `src/routes/debts/[id]/+page.svelte` — wired to `DebtDetailClient`
- `src/routes/debts/[id]/+page.server.ts` — nested `receivedPayments` on periods
- `src/lib/components/loans/LoanForm.svelte` — received payments, loan preview, contract preview
- `src/lib/components/loans/LoanContractDraftPreview.svelte` — new
- `src/lib/components/loans/LoanContractCustomizationForm.svelte` — new
- `src/lib/components/loans/LoanContractParticipantsEditor.svelte` — new
- `src/lib/components/loans/LoanContractDocumentBody.svelte` — new
- `src/lib/components/loans/loan-form-preview.ts` — preview/summary helpers
- `src/lib/components/loans/loan-form-allocations.ts` — existing loan / duplicate allocations
- `src/lib/components/loans/LoanDetailClient.svelte` — inline edit with `LoanForm`
- `src/routes/loans/[id]/+page.svelte` — loads investors/borrowers for edit form

## Files changed in parity pass (2026-09-09, session 2)

- `src/lib/components/common/ValidIdUpload.svelte` — new
- `src/lib/components/common/ESignatureUpload.svelte` — new
- `src/lib/components/borrowers/BorrowerForm.svelte` — new
- `src/lib/components/borrowers/BorrowerFormModal.svelte` — new
- `src/lib/components/loans/LoanForm.svelte` — required borrower + create modal
- `src/routes/borrowers/[id]/+page.svelte` — edit/delete via `DetailHeader`

## Files changed in parity pass (2026-09-09, session 1)

- `src/lib/components/loans/LoanForm.svelte` — multi-investor, duplicate, multiple interest, status calc
- `src/lib/components/loans/MultipleInterestManager.svelte` — new
- `src/lib/components/loans/LoanCreateModal.svelte` — wired to expanded form
- `src/routes/loans/+page.svelte` — create modal + duplicate in modal
- `src/routes/loans/new/+page.svelte` — duplicate query prefill
- `src/routes/debts/+page.svelte` — full filters, quick view, card pagination
- `src/lib/components/debts/DebtsTable.svelte` — sort + quick view actions
- `src/lib/components/debts/DebtCard.svelte` — quick view footer
- `src/lib/components/investors/InvestorsTable.svelte` — sortable columns
