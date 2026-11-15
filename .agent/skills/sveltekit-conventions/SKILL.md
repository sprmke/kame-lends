---
name: sveltekit-conventions
description: "Use for routes, loaders, forms, and server code in `src/`."
---

# SvelteKit conventions — Kame Lends

Use for routes, loaders, forms, and server code in `src/`.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `.svelte.ts` modules).
- **Vite** dev server (`bun run dev` at repo root).
- **adapter-vercel** for production.

## File-based routes

Routes live under `src/routes/`:

| File                                   | Role                                      |
| -------------------------------------- | ----------------------------------------- |
| `+page.svelte`                         | Page UI                                   |
| `+page.server.ts`                      | `load`, form `actions`                    |
| `+layout.svelte` / `+layout.server.ts` | Shared shell and auth gates               |
| `+server.ts`                           | API endpoints (downloads, cron, webhooks) |
| `+error.svelte`                        | Error boundary                            |

Keep existing URL paths (e.g. `/loans/[id]` → `src/routes/loans/[id]/`).

## Server vs client

- DB, secrets, PDF generation, Google APIs: **server only** (`+page.server.ts`, `+server.ts`, `src/lib/server/`).
- Never import `@neondatabase/serverless` or service account keys into `.svelte` client bundles.

## Auth

- `@auth/sveltekit` in `hooks.server.ts` — see `auth-js-sveltekit` skill.

## Data loading

- Prefer `+page.server.ts` `load` over client fetch for dashboard data.
- Use `depends()` and `invalidate()` when mutating via form actions.

## Navigation

- `<a href="...">` or `goto()` from `$app/navigation`.
- Page titles: set in `+layout.svelte` or per-page via `<svelte:head><title>…</title></svelte:head>`.

## Env vars

- Public prefix: `PUBLIC_*`.
- Private: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_*`, etc. — only in server modules.

## Do not

- Add Next.js App Router patterns (`app/`, `use client`, `next/navigation`).
- Use React components in `src/` except server-only PDF (`pdf-export` skill).

## Money routes (2026-11)

- Every mutating route parses its body with a schema in `src/lib/schemas/` before any write.
- Never trust client `status`, totals, or derived fields. Compute them on the server with `buildLoanLedger` / `deriveLoanStatus`.
- Use `parseIdParam` (`src/lib/server/route-params.ts`) instead of `parseInt(params.id)` and return 400 on a bad id.
- Use `publicJsonError` for all 5xx responses; never return `error.message`.
- Authorization helpers return 403/404 consistently; do not mix 401 for ownership.
- Long reads that feed money screens should call `loadLoanLedger` once, not re-query per row.
