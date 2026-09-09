# Auth.js + SvelteKit — Kame Lends

Use when touching sign-in, sessions, or route protection.

## Package

- `@auth/sveltekit` with Google provider.
- `@auth/drizzle-adapter` — tables: `users`, `accounts`, `sessions`, `verificationToken`.
- `role` column on `users`: `admin` | `investor`.

## Setup files (target)

- `src/lib/server/auth.ts` — Auth config (providers, adapter, callbacks).
- `src/hooks.server.ts` — `handleAuth` + route protection `sequence`.
- `src/routes/signin/+page.svelte` — Google sign-in UI (not under `/auth/*`; Auth.js owns that prefix).

## Port from legacy

Mirror `auth.ts` and `middleware.ts`:

| Legacy                    | SvelteKit                            |
| ------------------------- | ------------------------------------ |
| `auth.ts`                 | `src/lib/server/auth.ts`             |
| `middleware.ts`           | `hooks.server.ts`                    |
| `/api/auth/[...nextauth]` | Auth.js SvelteKit handler (built-in) |

## Session callback

Attach `user.id` and `role` to session — investor portal and admin gates depend on this.

## Public routes

- `/` landing (redirect authenticated users to dashboard)
- `/signin`
- `/auth/*` (Auth.js handlers)
- `/sign/[token]` public contract signing

## Env vars

- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

## Validation checkpoint

After porting, sign in on **dev Neon branch** as existing admin and investor users; confirm same `user.id`, role, and data access as the Next.js app.
