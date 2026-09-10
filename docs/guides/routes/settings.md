# Settings

**Route:** `/settings`  
**Status:** Documented

## Behavior

Account summary card (title **Account**, name / email / role in a compact grid). Page title is Settings. On phone the title lives in `PageHeader` below the brand bar; the subtitle hides under `lg`. Light/Dark theme is in the desktop sidebar and phone More sheet only (not on this page).

All signed-in users get:

- **Payment methods** — bank name, account number, optional QR image (up to 10). Each user manages their own rows. Borrowers on a loan see the **loan owner's** methods on loan detail only.

Party users (linked investor, borrower, or witness contact rows) also get:

- **Identity documents** — valid ID and e-signature. Saves sync across all CRM rows linked to the signed-in user. Used for contract signing and admin contact records.

Admin workspace owners also get:

- **Data & maintenance** — sync/calendar/backup tools (full-width stacked actions on phone). Calendar sync/clear opens a bottom sheet under `lg` (dropdown at `lg+`).

## Load

[`src/routes/settings/+page.server.ts`](../../../src/routes/settings/+page.server.ts)

- Requires session.
- Loads `isAdminWorkspace` via `getNavCapabilities`.
- Loads the signed-in user’s payment methods. If `payment_methods` is missing on the connected database, Settings still renders with an empty list.
- When the user has linked party CRM rows: loads valid ID and e-signature via `loadPartyUserIdentityDocuments`.

## Mutations

CRUD via `/api/payment-methods` and `/api/payment-methods/[id]` (session user owns rows only).

Valid ID and e-signature via `GET` / `PUT` `/api/party-profile/me` (updates all investor/borrower/witness rows linked to the session user).

## Permissions

Any signed-in user can open Settings and manage their own payment methods. Party users with linked CRM rows can also manage valid ID and e-signature. Data & maintenance tools are admin-workspace only.

## Implementation map

| Piece              | Path                                                               |
| ------------------ | ------------------------------------------------------------------ |
| Page               | `src/routes/settings/+page.svelte`                                 |
| Payment methods UI | `src/lib/components/settings/PaymentMethodsManager.svelte`         |
| Identity documents | `src/lib/components/settings/PartyIdentityDocumentsManager.svelte` |
