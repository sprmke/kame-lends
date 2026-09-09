# Contract signing

**Route:** `/loans/[id]/sign`  
**Status:** Documented

## Behavior

Authenticated e-signature for a loan party. Google session email must match the invitation `partyEmail`. The server picks the matching slot (`borrower`, `lender`, `witness_1`, `witness_2`) from memberships.

Legacy `/sign/[token]` requires login and redirects to `/loans/[id]/sign`.

No expiry on new invitations. Tokens are not issued for new loans.

## APIs

| Method   | Path                      | Auth                        |
| -------- | ------------------------- | --------------------------- |
| GET/POST | `/api/loans/[id]/sign`    | Session + party email match |
| GET      | `/api/loans/[id]/signing` | Loan owner (admin panel)    |

## Implementation

- Page: `src/routes/loans/[id]/sign/`
- API: `src/routes/api/loans/[id]/sign/`
- Helpers: `src/lib/server/loan-signing-server.ts`, `src/lib/loan-signing.ts`
