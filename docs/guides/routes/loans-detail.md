# Loan detail

**Route:** `/loans/[id]`  
**Status:** Documented

## Behavior

Full loan detail for any party with membership (owner, investor, borrower, witness), or a **group viewer** (party on another loan in a shared group) in read-only projected mode. On phone the back chevron and title live in `DetailHeader` content below the brand bar. DetailHeader actions render in MobileTopBar as frosted icon wells. Phone headers use `PageBackHeader`: chevron + Back label above a smaller title (`text-lg`), subtitle, and optional full-width Sign CTA.

- **Group viewer:** banner "Shared with you through a group · Read-only" with hub link. Contact/ID/receipt fields are redacted via `projectLoanForGroupViewer`. Payment, contract, and storage endpoints still require party `hasLoanViewAccess`.
- **Groups row (owner, when `SHOW_GROUPS_UI`):** **Groups** field in the Loan Details card (badges link to `/groups/[id]`, `-` when none). **Manage groups** is in the header ⋯ menu (below Duplicate); opens picker (`PUT /api/loans/[id]/groups`) with inline create. Create/edit loan form (`LoanFormGroupsField`) uses full-width selectable rows (color dot, name, optional count, checkbox on the right) plus a dashed **New group** button (`/groups?create=1`).

- Owner: edit, delete, **Contract Details** (⋯ menu → `max-w-5xl` modal: signing status with **Share link** (Web Share or clipboard), full contract setup tabs from edit form, **Save contract** + **Download contract**), payment tools.
- Investor / borrower / witness: read-only contract modal and **Download contract** (same PDF route as owner; `GET`/`POST /api/loans/[id]/contract require loan view access). On capable devices, contract PDF export uses Web Share when available, otherwise downloads. Signing still allowed for their slot. In Contract Details, their own pending signing row shows **Open** (`/loans/[id]/sign`). Borrower sees owner **payment methods** (bank, account number, QR) when configured. Contract Details paints title and footer immediately (`ResponsiveModal` `deferBody`off). Signing status mounts at once; the contract editor lazy-loads from`$effect` into `$state` after the shell paints (`createOverlayContentReady`). Do not `{#await import()}` in that modal body.
- **Contract signing:** Summary includes **Contacts signed** (`1/3`, `3/3`, etc.) when the loan has active signing invitations (`GET /api/loans/[id]/signing`). Amber until all parties sign; green when complete. Hidden for group read-only viewers.
- **Summary grid:** **Investors** and **Borrowers** counts sit on the same row (`0` or `1` borrower per loan).
- **Commission:** private per user. Only borrowers, investors, and witnesses on the loan see **Your Commission** (`LoanMyCommissionCard`, `GET` / `PATCH /api/loans/[id]/my-commission`). Loan managers and other parties do not see commission in the summary or elsewhere. **Add Commission** in the row ⋯ menu opens `LoanCommissionModal` (list and detail). `?commission=1` opens the same modal on loan detail. Rate mode shows principal and live preview; fixed mode omits principal. **Commissioned** list tab filters to loans where the viewer's `myCommission` is set; summary cards use `computePartyCommissionStats`.
- Sign CTA when the viewer has a pending signature slot (non-owner parties only; owners use Contract Details in the ⋯ menu). Shown below the subtitle as a full-width button on phone; on desktop it aligns with header actions. Hidden after the party has signed or when viewing as the loan owner. Saving a loan with a different borrower updates the contract signing slot to that borrower's email.
- After create, the form tries to download the contract PDF, then `?signing=1` opens the Contract Details modal. If PDF generation fails, the loan is still saved; download again from Contract Details.
- `?signing=1` opens Contract Details after create/save when the form redirects there. **Pending sign** on the loans list or calendar goes to `/loans/[id]/sign` instead.
- Contract PDF (`POST /api/loans/[id]/contract`) embeds JPEG/PNG valid IDs and signatures. WebP and unreadable images are left off the PDF so the file still downloads. The service worker does not intercept this POST when online.
- Create/edit loan form: **Contract Preview** collapsible uses tabs (Parties & signatures, Contract terms, Contract preview). The live document preview is only on the preview tab.
- **Payment form:** Fund Transfer and Add Received Payment open with one blank row (lender, amount, date, notes) and a required receipt field on that row. Save stays disabled until each row has a receipt. Once the amount and date are filled, a missing receipt is marked and the form scrolls to it. Each investor card's Principal Disbursement tab does the same for a new or preselected investor (**Add transaction** adds another blank row). Received Payments starts empty: **Add payment** adds a blank row. **Add receipts** under the rows still scans images and fills a blank row or appends more. Upload one or many screenshots (or a transaction-history screenshot): one transaction or payment per transfer, amount and date filled in, receipts attached to the row they belong to. Same date + same lender = one row (amounts summed, "N transfers merged"). A chat or other image that is not a receipt stays on the row being filled and shows a warning. It does not add an empty transaction or block save. A chat that states an amount is read as a transfer. Rows show AI warning badges (e.g. "Not a receipt", "Date is in the future", "Already recorded in …", "Double-check") and the AI summary. Row ⋯ menu: Merge with previous, Split receipts, Remove. **Add transfer**, **Add payment**, or **Add transaction** starts another blank row after the last one is removed. Transfers already saved on this loan are skipped with a toast. A new loan's Investors-card upload, before any investor is added and when AI is on, still adds the matched investors and sets an empty borrower from the receipt. With AI off, each receipt becomes a row to fill in by hand. Adding receipts to an existing row offers **Split into N** when they are separate transfers. A receipt is required on every principal disbursement, and on every received payment that has an amount, on create and on edit. Saving without one scrolls to that receipt, marks the upload, and disables Create or Update until a receipt is attached. A disbursement that already has a saved receipt does not ask for a new file when only the loan name changes. Blank received-payment rows with no amount are left off the save.
- **Refresh and payment controls:** saving a payment, Fund Transfer, or received payment re-runs the detail load (`invalidate('app:loans')`) so totals, status, and payment rows update without a manual reload. A single-interest loan with no scheduled periods shows **Record payment** on the summary card. Received payments have edit and remove (confirmation) controls; a general payment can change amount, date, receipt, and notes. Read-only viewers see neither control.
- **Investor privacy:** a non-admin viewer sees only their own investor allocation and payments. Other investors' capital, rates, and payment rows show "Investor details are private".
- **Detail page:** **Mark paid** (interest period) and **Consolidate** modals fill amount and date from the first receipt uploaded there. Confirm and Save stay disabled until a receipt is attached, and the missing receipt is marked in the form. Both include an optional Notes field, as do Fund Transfer, Add Received Payment, and each disbursement or received-payment row on the loan form.
- Receipts are stored on the `loan_investors` / `received_payments` row (`receipts` jsonb, first item mirrored on `receiptImageUrl` / `receiptExtractedData`) and survive loan edits. Optional `notes` on those same rows (migration `0032_payment_notes.sql`) is kept on edit. Loan detail shows the note under that disbursement or payment, and receipt thumbnails; tap a thumbnail to view. Group-only viewers do not see those notes (same redaction as receipts).
- **Additional fund transfer:** owners can record another principal disbursement for a lender on the same sent date as an existing one (`POST /api/loans/[id]/payments`). The Fund Transfer dialog no longer blocks same-day additional principal.
- Contract signatures: a party's signature on `/loans/[id]/sign` (drawn or **Saved** profile image when enabled) always wins on the PDF. Saved CRM e-signatures also appear without signing when the admin checks **Use saved signature** for that party in Contract Details (Parties & signatures tab). New contracts default that checkbox to off. Contract witnesses are optional: **Include witnesses** is off on new loans and regenerated defaults until the owner turns it on, or until the loan is in a group with default witnesses. Checking those groups on create or edit fills empty witness slots (two max, no duplicate person) and can auto-sign when the group and a saved signature allow it.
- **Desktop (`lg+`):** floating sidebar; list View / row click opens this content in `LoanDetailModal` with a `text-base font-medium` title and the same control chrome as the last Next.js app. Visual snapshots live in `e2e/visual-parity.spec.ts`.
- **Phone (`<lg`):** `LoanSummarySection` is a 2-column metric grid. When the tile count is odd, the last tile spans full width only while the grid is 2 columns (below `lg`). Desktop `lg+` stays 4 columns with no stretch. Edit and duplicate open a bottom sheet over the detail (`EditFormSheet` / `LoanCreateModal`). Cancel / submit scroll with the form.
- **Loading:** `LoanDetailSkeleton` mirrors the page: header, summary metric grid in a card, loan details card, investor sections, and witness rows. Inside `LoanDetailModal` the same body skeleton omits the page header because the dialog header already renders. Signing status uses the contract card with name/role rows while `/api/loans/[id]/signing` loads.
- **Status:** `Completed` when received payments cover principal + interest (same threshold as the investor Settled badge). A past due date does not keep the loan Overdue once the total is paid. Opening the page or list modal persists that status if the stored row is still Overdue. `POST /api/loans/check-overdue` does the same for the rest of the list. Owners can still mark an unpaid overdue loan complete from the header.

## Load

[`src/routes/loans/[id]/+page.server.ts`](../../../src/routes/loans/[id]/+page.server.ts)

- `loadLoanDetail` (`src/lib/server/loan-detail.ts`) loads the loan graph (including `groupLoans` for group badges and Manage groups) and session email together, then `computeLoanAccessContext` (`src/lib/loan-access-compute.ts`). View/edit follow that membership. No second access query. If the loan is fully paid and not yet `Completed`, the load writes `Completed` and invalidates the loan cache.
- `paymentMethods` loaded only when membership includes `borrower` (loan owner’s methods).
- Page load includes `loanContract`. List-modal `GET /api/loans/[id]` omits it unless `?include=contract` (edit, duplicate, or Contract Details). Responses strip leftover `data:image…` payloads; `storage:` refs remain.
- List-modal Contract Details fetches signing and contract JSON only while that modal is open. Those GETs plus loan detail share a 45s per-loan client cache.

`GET /api/loans/[id]` returns the same `paymentMethods` field for borrower viewers (used by the borrowed list modal).

## Permissions

| Membership | Payment methods on detail                           |
| ---------- | --------------------------------------------------- |
| Borrower   | Yes (owner’s methods; copy bank/account; larger QR) |
| Owner      | No (manage in Settings)                             |
| Investor   | No                                                  |
| Witness    | No                                                  |

No view access returns 404 and renders `+error.svelte` ("Loan not available"). `?edit=1` without admin rights returns 403 ("View only access") with a link to the read-only page. See [errors.md](./errors.md).

## Unlinked payments and legacy receipts

- A received payment with no interest period is allowed. The ledger applies it to the oldest open interest first, then principal (D-14).
- The investor interest section now shows the ledger-paid amount per period, including unlinked money, and a separate **Unlinked payments** block with date, amount, receipts, and notes.
- Legacy payments marked by the repair show a **NO RECEIPT ON FILE** placeholder image. It is a label, not evidence; the record and its audit trail are preserved.

## Implementation map (receipt scanning)

| Piece                                  | File                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Upload dropzone / Add receipts         | `src/lib/components/receipt-scan/ReceiptIntake.svelte`                               |
| Row AI notes / row ⋯ menu              | `ScanRowNotes.svelte`, `ScanRowActions.svelte` (same folder)                         |
| Shared lender / amount / date fields   | `src/lib/components/payments/PaymentEntryFields.svelte`                              |
| Optional notes                         | `src/lib/components/payments/PaymentNotesField.svelte`                               |
| Row upload field (+ Split into N)      | `src/lib/components/common/ReceiptUploadField.svelte`                                |
| Scan, group, rows, match, sanity rules | `src/lib/receipt-scan/*.ts`                                                          |
| Dialog wiring                          | `src/lib/components/loans/LoanQuickPaymentDialog.svelte`                             |
| Loan form wiring                       | `src/lib/components/loans/LoanForm.svelte` (`transactionAdapter`, `receivedAdapter`) |
| API                                    | `src/routes/api/ai/receipt-extraction/+server.ts`, `api/ai/status`                   |
| E2E                                    | `e2e/receipt-scan.spec.ts`                                                           |

## Money correctness (2026-11)

- Every total on the page comes from `buildLoanLedger` (via the loan detail payload / detail components). There is no separate interest formula in the UI.
- Recording a payment checks the period's expected interest from the engine (the investor's total capital for this loan, not one tranche).
- Reverting a paid period never deletes payments. If the period has linked payments the API returns **409**; delete the payment instead.
- Consolidating partial payments runs in one transaction and keeps prior receipts. The first linked payment is updated in place (its id survives); any extra rows are soft-deleted, not destroyed.
- A loan edit matches disbursements, periods, and payments by id in one transaction. Rows are never re-created, a soft-deleted row is never revived, and an id that no longer exists returns **409** ("changed or removed in another session") instead of inserting a duplicate.
- Removing an investor in the edit form soft-deletes their disbursement and its periods. Their payments block the save with **409** unless the removal is confirmed; with confirmation the payments are soft-deleted too.
- **Complete loan** requires a reason and writes `status_override`, `status_reason`, and `completed_at`. Clearing the override recomputes the derived status.
- Deleting a payment soft-deletes it and writes an audit event.
- The dashboard/cron status sweep uses the same rule: overdue starts the day after the due date.

## Ask Kame (2026-11)

On this page the launcher pins the loan as page context ("Viewing Loan #12") and swaps starters to explain-this-loan, next due, payment history, and simulate-a-rate. The assistant reads the same detail payload and ledger; it cannot edit the loan or record a payment. See [assistant.md](./assistant.md).
