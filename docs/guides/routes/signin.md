# Sign in

**Route:** `/signin`  
**Status:** Documented

## Behavior

Google OAuth sign-in for workspace users. Signed-in visitors redirect to `callbackUrl` (default `/dashboard`).

Auth.js owns `/auth/*` (callback, session, csrf). This page is only the custom button.

Google must match an existing `users` email (admin or invited party). First login for an invited contact links the Google account to that row. An unknown Google account is rejected. An empty database still accepts the first Google user.

## Load / actions

[`src/routes/signin/+page.server.ts`](../../../src/routes/signin/+page.server.ts)

- Redirects if `locals.session.user` is set.
- Reads `callbackUrl` and Auth.js `error` (`AccessDenied`, `Configuration`, …).
- Named action `signIn` (not `default`).

## Validation

None on this page. Auth.js validates the Google callback.

## Permissions

Public. After sign-in, route protection in `src/hooks.server.ts` applies.

## Edge cases

- `AccessDenied`: Google email is not on the workspace.
- `Configuration` / adapter failures: short "Sign-in failed" line. The common local cause is an unusable `DATABASE_URL` (a placeholder exported in the shell, or a stale Neon socket), which makes every `account` / `session` query throw. Check the dev server log for `[auth] session lookup failed:` and `[db] Ignoring placeholder DATABASE_URL`.
- `redirect_uri_mismatch` is Google Cloud Console, not this page. Register the exact callback (`{origin}/auth/callback/google`) on the OAuth client.

## Implementation map

- UI: `src/routes/signin/+page.svelte`
- Auth config: `src/lib/server/auth.ts`
- Allow / deny: `src/lib/server/auth-sign-in.ts`
- Session hook: `src/hooks.server.ts`

## Host-facing knowledge

Sign in with the Google account whose email is already on the loan (admin, investor, borrower, or witness). A personal Gmail that was never added to a contact will not get in.
