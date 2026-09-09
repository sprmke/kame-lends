# Vercel production deploy (SvelteKit cutover)

**Status:** Config ready; **no production deploy executed** by migration agents.

## Before first SvelteKit production deploy

1. Complete manual QA on `dev-sveltekit-migration` Neon branch (`docs/workflow/qa/sveltekit-manual-qa.md`).
2. Run `bun run backup:neon` and confirm Neon backup branch exists.
3. In Vercel project settings:
   - **Framework preset:** SvelteKit (or Other → build command below)
   - **Build command:** `bun run build`
   - **Output:** SvelteKit adapter-vercel default
   - **Install:** `bun install`
4. Env vars: same names as `docs/archive/operations/vercel-production-snapshot.md`. Add `PUBLIC_APP_URL` if replacing `NEXT_PUBLIC_APP_URL`.
5. Google OAuth: add SvelteKit callback URL if path changed (Auth.js route under `/auth/...`).
6. Deploy Preview from `feat/sveltekit-migration` first; smoke-test sign-in and one loan read.
7. Production deploy only after explicit approval with unlock word **`lendwave`**.

## Rollback

Redeploy last successful **Next.js** deployment from Vercel. Neon prod unchanged if dev branch was used for migration QA.
