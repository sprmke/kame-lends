# Loan detail

**Route:** `/loans/[id]`  
**Status:** Documented

## Behavior

Full loan detail for any party with membership (owner, investor, borrower, witness). On phone the back chevron and title live in `DetailHeader` content below the brand bar. DetailHeader actions render in MobileTopBar as frosted icon wells. Phone headers use `PageBackHeader`: chevron + Back label above a smaller title (`text-lg`), subtitle, and optional full-width Sign CTA.

- Owner: edit, delete, **Contract Details** (⋯ menu → `max-w-5xl` modal: signing status + copy links, full contract setup tabs from edit form, **Save contract** + **Download contract**), payment tools.
- Investor / borrower / witness: read-only. Signing still allowed for their slot. Borrower sees owner **payment methods** (bank, account number, QR) when configured.
- Sign CTA when the viewer has a pending signature slot (non-owner parties only; owners use Contract Details in the ⋯ menu). Shown below the subtitle as a full-width button on phone; on desktop it aligns with header actions. Hidden after the party has signed or when viewing as the loan owner.
- After create, `?signing=1` opens the Contract Details modal automatically.
- Create/edit loan form: **Contract Preview** collapsible uses tabs (Parties & signatures, Contract terms, Contract preview). The live document preview is only on the preview tab.
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
