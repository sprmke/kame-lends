# Contract signing

**Route:** `/loans/[id]/sign`  
**Status:** Documented

## Behavior

Authenticated e-signature for a loan party. Google session email must match the invitation `partyEmail`. The server picks the matching slot (`borrower`, `lender`, `witness_1`, `witness_2`) from memberships.

Legacy `/sign/[token]` requires login and redirects to `/loans/[id]/sign`.

No expiry on new invitations. Tokens are not issued for new loans.

Access failures render `+error.svelte`, not a bare 404: no signature slot for the account returns 403 ("You can't sign this contract"), an unknown or invisible loan returns 404 ("Contract not available"), and an unknown token on `/sign/[token]` returns 404 ("Signing link not found"). See [errors.md](./errors.md).

### Layout

- Uses `DashboardPage` shell padding like other authenticated routes.
- Shared `PageBackHeader`: Back link above the page title when the tab has browser history (`history.length > 1`, e.g. navigated from `/loans` or `/loans/[id]`). Hidden on a fresh landing (bookmark or direct URL). Back uses `history.back()`. Title uses `text-lg` on phone, `text-xl` on desktop. Role badge sits inline with the title.
- Phone (`<lg`): contract preview stacks above signature and consent. Contract body uses page scroll (no inner `max-height` on the preview). Submit stays in the consent card (scrolls with content; no fixed bottom bar). Tab dock clearance comes from `pb-mobile-tab` on the app shell.
- Desktop (`xl+`): two-column layout (contract left, signature + consent sticky right). Contract preview expands naturally (no inner scroll region). Signature hint text wraps; **Clear Signature** sits below the hint. Consent checkbox label uses `text-sm` (same as body copy). Full-width submit in the consent card.

## APIs

| Method   | Path                      | Auth                                                                                               |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| GET/POST | `/api/loans/[id]/sign`    | Session + party email match                                                                        |
| GET      | `/api/loans/[id]/signing` | Any loan party with view access. Admin syncs missing invitations; parties read existing rows only. |

## Implementation

- Page: `src/routes/loans/[id]/sign/`
- API: `src/routes/api/loans/[id]/sign/`
- Helpers: `src/lib/server/loan-signing-server.ts`, `src/lib/loan-signing.ts`
