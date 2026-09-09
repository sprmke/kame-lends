# SvelteKit conventions — Kame Lends

Use for routes, loaders, forms, and server code in `new-app/`.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `.svelte.ts` modules).
- **Vite** dev server (`bun run dev` in `new-app/`).
- **adapter-vercel** for production.

## File-based routes

Routes live under `new-app/src/routes/`:

| File                                   | Role                                      |
| -------------------------------------- | ----------------------------------------- |
| `+page.svelte`                         | Page UI                                   |
| `+page.server.ts`                      | `load`, form `actions`                    |
| `+layout.svelte` / `+layout.server.ts` | Shared shell and auth gates               |
| `+server.ts`                           | API endpoints (downloads, cron, webhooks) |
| `+error.svelte`                        | Error boundary                            |

Mirror legacy `app/` URLs when porting (e.g. `/loans/[id]` → `routes/loans/[id]/`).

## Server vs client

- DB, secrets, PDF generation, Google APIs: **server only** (`+page.server.ts`, `+server.ts`, `src/lib/server/`).
- Never import `@neondatabase/serverless` or service account keys into `.svelte` client bundles.

## Auth

- `@auth/sveltekit` in `hooks.server.ts` — see `auth-js-sveltekit` skill.
- Port `middleware.ts` route matrix into `hooks.server.ts` `sequence` handler.

## Data loading

- Prefer `+page.server.ts` `load` over client fetch for dashboard data.
- Use `depends()` and `invalidate()` when mutating via form actions.

## Navigation

- `<a href="...">` or `goto()` from `$app/navigation`.
- Page titles: set in `+layout.svelte` or per-page via `<svelte:head><title>…</title></svelte:head>`.

## Env vars

- SvelteKit public prefix: `PUBLIC_*` (replaces `NEXT_PUBLIC_*` at cutover).
- Private: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_*`, etc. — only in server modules.

## Do not

- Add Next.js App Router patterns (`app/`, `use client`, `next/navigation`).
- Use React components in `new-app/` except server-only PDF (`pdf-export` skill).
