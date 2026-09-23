# Contract signing

**Route:** `/loans/[id]/sign`  
**Status:** Documented

## Behavior

Authenticated e-signature for a loan party. Google session email must match the invitation `partyEmail`. The server picks the matching slot (`borrower`, `lender`, `witness_1`, `witness_2`) from memberships. When the loan owner changes the borrower or lender on a saved loan, `syncSigningInvitationsForLoan` updates the matching invitation name and email (and clears an unsigned signature if the email changed).

After loan create (`POST /api/loans`), parties with emails receive a branded Resend email with a **Sign contract** button pointing at this page (`buildAuthenticatedSigningUrl`). Sign-in uses Google with the same address as the invitation.

A signature submitted on this page is stored on the contract invitation and takes priority over any saved CRM e-signature on the PDF.

When the signer has a profile e-signature (`/settings` or party profile), the sign page shows **Draw** and **E-signature**. **E-signature** submits the profile image; **Draw** uses the pad. Without a profile e-signature, only the draw pad is shown (with a short note pointing to Settings).

Saved profile signatures also appear on the contract PDF without signing when the owner enabled **Use saved signature** in Contract Details and the party has not signed on this page yet.

Legacy `/sign/[token]` requires login and redirects to `/loans/[id]/sign`.

No expiry on new invitations. Tokens are not issued for new loans.

Access failures render `+error.svelte`, not a bare 404: no signature slot for the account returns 403 ("You can't sign this contract"), an unknown or invisible loan returns 404 ("Contract not available"), and an unknown token on `/sign/[token]` returns 404 ("Signing link not found"). See [errors.md](./errors.md).

### Layout

- Uses `DashboardPage` shell padding like other authenticated routes.
- Shared `PageBackHeader`: Back link above the page title when the tab has browser history (`history.length > 1`, e.g. navigated from `/loans` or `/loans/[id]`). Hidden on a fresh landing (bookmark or direct URL). Back uses `history.back()`. Title uses `text-lg` on phone, `text-xl` on desktop. Role badge sits inline with the title.
- Phone (`<lg`): contract preview stacks above signature and consent. Contract body uses page scroll (no inner `max-height` on the preview). Submit stays in the consent card (scrolls with content; no fixed bottom bar). Tab dock clearance comes from `pb-mobile-tab` on the app shell.
- Desktop (`xl+`): two-column layout (contract left, signature + consent sticky right). Contract preview expands naturally (no inner scroll region). When a profile e-signature exists, **Draw** / **E-signature** toggle above the pad or preview. Signature hint text wraps; **Clear Signature** sits below the hint in draw mode. Consent checkbox label uses `text-sm` (same as body copy). Full-width submit in the consent card.

## APIs

| Method   | Path                      | Auth                                                                                                                                                                                                           |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET/POST | `/api/loans/[id]/sign`    | Session + party email match                                                                                                                                                                                    |
| GET      | `/api/loans/[id]/signing` | Any loan party with view access. Admin syncs missing invitations; parties read existing rows only. Response includes `viewerInvitationId` for the logged-in party's slot (used for Contract Details **Open**). |
| GET/POST | `/api/sign/[token]`       | Token only (no session). Kept for existing links. Rate-limited. Prefer authenticated `/loans/[id]/sign`.                                                                                                       |

## Implementation

- Page: `src/routes/loans/[id]/sign/`
- API: `src/routes/api/loans/[id]/sign/`
- Helpers: `src/lib/server/loan-signing-server.ts`, `src/lib/loan-signing.ts`
