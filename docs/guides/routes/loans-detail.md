# Loan detail

**Route:** `/loans/[id]`  
**Status:** Documented

## Behavior

Full loan detail for any party with membership (owner, investor, borrower, witness). On phone the back chevron and title live in `DetailHeader` content below the brand bar. DetailHeader actions render in MobileTopBar as frosted icon wells. Phone headers use `PageBackHeader`: chevron + Back label above a smaller title (`text-lg`), subtitle, and optional full-width Sign CTA.

- Owner: edit, delete, **Contract Details** (⋯ menu → `max-w-5xl` modal: signing status + copy links, full contract setup tabs from edit form, **Save contract** + **Download contract**), payment tools.
- Investor / borrower / witness: read-only contract modal and **Download contract** (same PDF route as owner; `GET`/`POST /api/loans/[id]/contract require loan view access). Signing still allowed for their slot. In Contract Details, their own pending signing row shows **Open** (`/loans/[id]/sign`) plus **Copy link**; other parties stay copy-only. Borrower sees owner **payment methods** (bank, account number, QR) when configured.
- **Profit (borrower + witness):** `LoanSummarySection` shows a Profit / Profit Rate cell for everyone, computed off the loan's principal via `calculateInterest`. The borrower gets a **Your Profit** card below the summary — the one field they may edit (rate-of-principal or fixed amount, `PATCH /api/loans/[id]/profit`). A **Witnesses** section lists everyone assigned to the loan via the `loan_witnesses` table (independent of e-signature `witness_1`/`witness_2` slots, so profit survives a witness swap); each witness may edit only their own row's profit (`PATCH /api/loans/[id]/witnesses/[witnessLoanId]`). The owner can add/remove witnesses and override any profit value; everyone else sees the section read-only except their own row.
- Sign CTA when the viewer has a pending signature slot (non-owner parties only; owners use Contract Details in the ⋯ menu). Shown below the subtitle as a full-width button on phone; on desktop it aligns with header actions. Hidden after the party has signed or when viewing as the loan owner. Saving a loan with a different borrower updates the contract signing slot to that borrower's email.
- After create, `?signing=1` opens the Contract Details modal automatically.
- Create/edit loan form: **Contract Preview** collapsible uses tabs (Parties & signatures, Contract terms, Contract preview). The live document preview is only on the preview tab.
- **Receipt scanning:** each investor funding transaction (create/edit form) and each "Add payment"/"Add received payment" entry (quick payment dialog) has an optional receipt upload (`ReceiptUploadField`). Uploading a screenshot/photo sends it to `POST /api/ai/receipt-extraction` (Gemini vision, multi-key rotation, Groq fallback — see `src/lib/server/ai/receipt-extraction.ts`) and prefills amount/date (and, for investor payments, auto-selects the lender by fuzzy name match) without overwriting fields the admin already typed. The image and the AI's extracted fields are stored as evidence on the `loan_investors`/`received_payments` row (`receiptImageUrl`/`receiptExtractedData`) and survive loan edits. Fully optional — with no `GEMINI_API_KEYS`/`GROQ_API_KEY` configured, the fields just report "not configured" and manual entry works as before.
- Contract signatures: a party's drawn signature on `/loans/[id]/sign` always wins on the PDF. Saved CRM e-signatures appear only when the admin checks **Use saved signature** for that party in Contract Details (Parties & signatures tab). New contracts default that checkbox to off.
- **Desktop (`lg+`):** floating sidebar; list View / row click opens this content in `LoanDetailModal` with a `text-base font-medium` title and the same control chrome as the last Next.js app. Visual snapshots live in `e2e/visual-parity.spec.ts`.
- **Phone (`<lg`):** `LoanSummarySection` is a 2-column metric grid. When the tile count is odd, the last tile spans full width only while the grid is 2 columns (below `lg`). Desktop `lg+` stays 4 columns with no stretch. Edit and duplicate open a bottom sheet over the detail (`EditFormSheet` / `LoanCreateModal`). Cancel / submit scroll with the form.
- **Loading:** `LoanDetailSkeleton` mirrors the page: header, summary metric grid in a card, payment-method tiles, signing party rows, and investor sections. Signing status uses the same card + identity rows while `/api/loans/[id]/signing` loads.

## Load

[`src/routes/loans/[id]/+page.server.ts`](../../../src/routes/loans/[id]/+page.server.ts)

- `getLoanAccessContext` gates view/edit.
- `paymentMethods` loaded only when membership includes `borrower` (loan owner’s methods).

`GET /api/loans/[id]` returns the same `paymentMethods` field for borrower viewers (used by the borrowed list modal).

## Permissions

| Membership | Payment methods on detail                           |
| ---------- | --------------------------------------------------- |
| Borrower   | Yes (owner’s methods; copy bank/account; larger QR) |
| Owner      | No (manage in Settings)                             |
| Investor   | No                                                  |
| Witness    | No                                                  |

No view access returns 404 and renders `+error.svelte` ("Loan not available"). `?edit=1` without admin rights returns 403 ("View only access") with a link to the read-only page. See [errors.md](./errors.md).
