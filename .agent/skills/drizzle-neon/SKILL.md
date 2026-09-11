# Drizzle + Neon — Kame Lends

Use for schema, queries, and migrations.

## Layout

| Path                          | Purpose                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/schema.ts` | Drizzle schema                                                                                    |
| `src/lib/server/db/index.ts`  | DB client — local URLs use `postgres.js`; Neon URLs use WebSocket `Pool` (reused on `globalThis`) |
| `drizzle.config.ts`           | Kit config (`schema` points at `src/lib/server/db/schema.ts`)                                     |
| `db/migrations/*.sql`         | Shipped SQL migrations (applied by `db:migrate:pending` / CD)                                     |

## Rules

- **Never edit shipped migrations** — add a new file under `db/migrations/`. Hooks enforce this.
- After changing `schema.ts`, add a matching hand-maintained SQL file under `db/migrations/`.
- Production applies pending files automatically on push to `main` (see `docs/architecture/deployment.md`).

## Neon targets

| Target            | Env / secret                                       | Use             |
| ----------------- | -------------------------------------------------- | --------------- |
| Local Docker      | `DATABASE_URL` → `127.0.0.1:5433`                  | Day-to-day dev  |
| Singapore QA      | `DATABASE_URL_PROD`                                | Hosted QA       |
| Vercel production | GitHub `DATABASE_URL` secret (= Vercel Production) | Live app via CD |

## Commands

```bash
bun run db:generate          # drizzle-kit generate (kit output; hand SQL still required)
bun run db:migrate:pending   # apply pending db/migrations/*.sql (journal: schema_migrations)
bun run db:studio
bun run db:local:start
bun run db:local:push        # always 127.0.0.1:5433 — never Neon
bun run db:local:sync-prod   # read-only pg_dump from DATABASE_URL_PROD → local restore
```

Local Postgres guide: `docs/archive/operations/local-development-database.md`.

## Query patterns

- Use Drizzle query builder; avoid raw SQL unless necessary.
- Transactions for multi-table writes (loan + investors + periods).
- Manila timezone for user-visible dates (`src/lib/date-utils.ts`).

## MCP

Neon MCP (`https://mcp.neon.tech/mcp`) can list branches and run read-only SQL — prefer QA/dev scope for exploration.
