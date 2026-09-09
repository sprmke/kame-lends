# Loan detail

**Route:** `/loans/[id]`  
**Status:** Documented

## Behavior

Full loan detail for any party with membership (owner, investor, borrower, witness).

- Owner: edit, delete, signing panel, payment tools.
- Investor: own allocation/payment edits when allowed.
- Borrower / witness: read-only. Borrower sees owner **payment methods** (bank, account number, QR) when configured.
- Sign CTA when the viewer has an open signature slot.

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
