# CLAUDE.md

Guidance for Claude Code in **Kame Lends (PawnTracker)**. Mirrors `.cursor/rules/project-context.mdc` and doc-sync requirements.

## What this is

Loan management app: loans, investors, borrowers, debts, transactions, Google Calendar sync, investor portal. **SvelteKit 2** at repo root on branch `feat/sveltekit-migration` (legacy Next.js removed).

Stack: **SvelteKit 2 + Svelte 5 + Vite + Neon + Drizzle + Auth.js + Vercel**.

## Commands

```bash
bun install
bun run setup:ai-tooling      # once after clone
bun run check:ai-tooling-sync

bun run dev
bun run check
bun run test
bun run build

# Database
bun run db:generate
bun run db:migrate
bun run db:studio
bun run backup:neon
bun run backup:neon:branches
```

Prod deploy / schema push to Neon prod: blocked unless user says **`lendwave`** in the same message (`.cursor/rules/no-prod-deploy.mdc`).

## Architecture

```
src/routes/             # SvelteKit file routes
src/lib/                # Shared logic, components, server modules
src/lib/server/db/      # Drizzle schema + client
db/migrations/          # Shipped SQL migrations
```

Auth: `@auth/sveltekit` + Google + Drizzle adapter. Roles: `admin`, `investor`.

PDF: server-only `@react-pdf/renderer` in `+server.ts` routes — do not remove React from PDF path.

## Docs are the source of truth

Before claiming any material task done:

1. Follow **`documentation-maintenance`** skill.
2. Route/page changes → **`route-guides`** skill.
3. Update migration checkboxes in **`docs/workflow/in-progress/sveltekit-migration.md`**.

| Change                 | Update                                             |
| ---------------------- | -------------------------------------------------- |
| Architecture, API, env | `docs/PROJECT.md`                                  |
| Page UX in `new-app/`  | `docs/guides/routes/*.md`                          |
| Migration progress     | `docs/workflow/in-progress/sveltekit-migration.md` |

## AI session hygiene

See `.cursor/rules/ai-usage.mdc`: one task per chat, no subagent swarms, prefer Sonnet for implementation.

## Skills

Canonical: `.agent/skills/<name>/SKILL.md` (symlinked to `.claude/skills/`). Invoke `loan-domain`, `sveltekit-conventions`, `drizzle-neon`, `auth-js-sveltekit` for domain work.

## Don'ts

- Next.js patterns in `src/` (use SvelteKit).
- Edit shipped files in `db/migrations/` (add new migration).
- Prod Neon/Vercel deploy without **`lendwave`**.
- Client-side React in SvelteKit (except server-only PDF).
- Use kame-homes Supabase rules in this repo.

Index: `.claude/README.md` · Rules: `.cursor/rules/README.md`
