# Loan detail

**Route:** `/loans/[id]`  
**Status:** Documented

## Behavior

Full loan detail for any party with membership (owner, investor, borrower, witness). On phone the back chevron and title live in `DetailHeader` content below the brand bar. DetailHeader actions render in MobileTopBar as frosted icon wells. Phone headers use `PageBackHeader`: chevron + Back label above a smaller title (`text-lg`), subtitle, and optional full-width Sign CTA.

- Owner: edit, delete, **Contract Details** (⋯ menu → `max-w-5xl` modal: signing status + copy links, full contract setup tabs from edit form, **Save contract** + **Download contract**), payment tools.
- Investor / borrower / witness: read-only contract modal and **Download contract** (same PDF route as owner; `GET`/`POST /api/loans/[id]/contract require loan view access). Signing still allowed for their slot. In Contract Details, their own pending signing row shows **Open** (`/loans/[id]/sign`) plus **Copy link**; other parties stay copy-only. Borrower sees owner **payment methods** (bank, account number, QR) when configured. The contract document mounts after the overlay shell paints (same `ResponsiveModal` defer as list overlays).
- **Profit (borrower + witness):** `LoanSummarySection` shows a Profit / Profit Rate cell for everyone, computed off the loan's principal via `calculateInterest`. The borrower gets a **Your Profit** card below the summary — the one field they may edit (rate-of-principal or fixed amount, `PATCH /api/loans/[id]/profit`). A **Witnesses** section lists everyone assigned to the loan via the `loan_witnesses` table (independent of e-signature `witness_1`/`witness_2` slots, so profit survives a witness swap); each witness may edit only their own row's profit (`PATCH /api/loans/[id]/witnesses/[witnessLoanId]`). The owner can add/remove witnesses and override any profit value; everyone else sees the section read-only except their own row.
- Sign CTA when the viewer has a pending signature slot (non-owner parties only; owners use Contract Details in the ⋯ menu). Shown below the subtitle as a full-width button on phone; on desktop it aligns with header actions. Hidden after the party has signed or when viewing as the loan owner. Saving a loan with a different borrower updates the contract signing slot to that borrower's email.
- After create, the form tries to download the contract PDF, then `?signing=1` opens the Contract Details modal. If PDF generation fails, the loan is still saved; download again from Contract Details.
- Contract PDF (`POST /api/loans/[id]/contract`) embeds JPEG/PNG valid IDs and signatures. WebP and unreadable images are left off the PDF so the file still downloads.
- Create/edit loan form: **Contract Preview** collapsible uses tabs (Parties & signatures, Contract terms, Contract preview). The live document preview is only on the preview tab.
- **Receipt scanning:** each investor funding transaction and received payment (create/edit form) and each Fund Transfer / Add Received Payment entry (quick payment dialog) can attach multiple receipt images (`ReceiptUploadField`, up to 10). Uploading a screenshot/photo sends it to `POST /api/ai/receipt-extraction` (Gemini vision, multi-key rotation, Groq fallback — see `src/lib/server/ai/receipt-extraction.ts`) and prefills amount/date (and, for investor payments, auto-selects the lender by fuzzy name match) without overwriting fields the admin already typed. Images and extracted fields are stored on the `loan_investors` / `received_payments` row (`receipts` jsonb, with the first item mirrored on `receiptImageUrl` / `receiptExtractedData`) and survive loan edits. Loan detail shows receipt thumbnails on disbursements and received payments; tap to view. Fully optional — with no `GEMINI_API_KEYS`/`GROQ_API_KEY` configured, the fields just report "not configured" and manual entry works as before.
- **Additional fund transfer:** owners can record another principal disbursement for a lender on the same sent date as an existing one (`POST /api/loans/[id]/payments`). The Fund Transfer dialog no longer blocks same-day additional principal.
- Contract signatures: a party's drawn signature on `/loans/[id]/sign` always wins on the PDF. Saved CRM e-signatures appear only when the admin checks **Use saved signature** for that party in Contract Details (Parties & signatures tab). New contracts default that checkbox to off.
- **Desktop (`lg+`):** floating sidebar; list View / row click opens this content in `LoanDetailModal` with a `text-base font-medium` title and the same control chrome as the last Next.js app. Visual snapshots live in `e2e/visual-parity.spec.ts`.
- **Phone (`<lg`):** `LoanSummarySection` is a 2-column metric grid. When the tile count is odd, the last tile spans full width only while the grid is 2 columns (below `lg`). Desktop `lg+` stays 4 columns with no stretch. Edit and duplicate open a bottom sheet over the detail (`EditFormSheet` / `LoanCreateModal`). Cancel / submit scroll with the form.
- **Loading:** `LoanDetailSkeleton` mirrors the page: header, summary metric grid in a card, payment-method tiles, signing party rows, and investor sections. Signing status uses the same card + identity rows while `/api/loans/[id]/signing` loads.
- **Status:** `Completed` when received payments cover principal + interest (same threshold as the investor Settled badge). A past due date does not keep the loan Overdue once the total is paid. Opening the page or list modal persists that status if the stored row is still Overdue. `POST /api/loans/check-overdue` does the same for the rest of the list. Owners can still mark an unpaid overdue loan complete from the header.

## Load

[`src/routes/loans/[id]/+page.server.ts`](../../../src/routes/loans/[id]/+page.server.ts)

- `loadLoanDetail` (`src/lib/server/loan-detail.ts`) loads the loan graph and session email together, then `computeLoanAccessContext` (`src/lib/loan-access-compute.ts`). View/edit follow that membership. No second access query. If the loan is fully paid and not yet `Completed`, the load writes `Completed` and invalidates the loan cache.
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
