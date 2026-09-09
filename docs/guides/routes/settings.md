# Settings

**Route:** `/settings`  
**Status:** Documented

## Behavior

Account summary (name, email, role).

Admin workspace owners also get:

- **Payment methods** — bank name, account number, optional QR image. Borrowers see these on loan detail only.
- **Data & maintenance** — sync/calendar tools when those controls are available.

## Load

[`src/routes/settings/+page.server.ts`](../../../src/routes/settings/+page.server.ts)

- Requires session.
- Loads `isAdminWorkspace` via `getNavCapabilities`.
- When admin workspace: loads the user’s payment methods.

## Mutations

CRUD via `/api/payment-methods` and `/api/payment-methods/[id]` (session user owns rows only).

## Permissions

Any signed-in user can open Settings. Payment methods and maintenance tools are admin-workspace only.
