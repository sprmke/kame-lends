# Auth.js + SvelteKit — Kame Lends

Use when touching sign-in, sessions, or route protection.

## Package

- `@auth/sveltekit` with Google provider (`allowDangerousEmailAccountLinking`).
- `@auth/drizzle-adapter` — tables: `users`, `accounts`, `sessions`, `verificationToken`.
- `role` column on `users`: `admin` | `investor` | `borrower` | `witness` (label only; access is membership-based). One email maps to one user who can be linked as any party.
- Sign-in allows existing emails only (`src/lib/server/auth-sign-in.ts`). Unknown Google accounts are not auto-created. Empty workspace accepts the first user.

## Setup files

- `src/lib/server/auth.ts` — Auth config (providers, adapter, callbacks).
- `src/hooks.server.ts` — `handleAuth` + route protection `sequence`.
- `src/routes/signin/+page.svelte` — Google sign-in UI (not under `/auth/*`; Auth.js owns that prefix).
- Form actions use **named** actions (`signIn`, `signOut`), not `default` — SvelteKit 2 rejects `?/default`.

## Session callback

Attach `user.id` and `role` to session — investor portal and admin gates depend on this.

## Public routes

- `/` landing (redirect authenticated users to dashboard)
- `/signin`
- `/auth/*` (Auth.js handlers)
- `/sign/[token]` public contract signing (legacy token path)

## Env vars

- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

## Validation checkpoint

Sign in on the **dev Neon branch** as existing admin and investor users; confirm `user.id`, role, and data access.
