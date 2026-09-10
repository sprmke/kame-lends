# Drizzle + Neon — Kame Lends

Use for schema, queries, and migrations.

## Layout

| Path                          | Purpose                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `src/lib/server/db/schema.ts` | Drizzle schema                                                           |
| `src/lib/server/db/index.ts`  | DB client — local URLs use `postgres.js`; Neon URLs use WebSocket `Pool` |
| `drizzle.config.ts`           | Kit config (`schema` points at `src/lib/server/db/schema.ts`)            |
| `db/migrations/*.sql`         | Shipped SQL migrations                                                   |

## Rules

- **Never edit shipped migrations** — add a new file under `db/migrations/`. Hooks enforce this.
- Use `drizzle-kit generate` then `drizzle-kit migrate` for schema changes.

## Neon branches

- **Prod branch**: do not push schema without **lendwave**.
- **Singapore `production` branch**: hosted QA (`DATABASE_URL_PROD`). Do not treat as Vercel prod until cutover.
- Backups: `bun run backup:neon`, `bun run backup:neon:branches`.

## Commands

```bash
bun run db:generate   # drizzle-kit generate
bun run db:migrate    # drizzle-kit migrate
bun run db:studio     # drizzle-kit studio
bun run db:local:start
bun run db:local:push   # always 127.0.0.1:5433 — never Neon
bun run db:local:sync-prod   # read-only pg_dump from DATABASE_URL_PROD → local restore
bun run db:local:sync-prod --from-dump   # restore latest ~/Backups/kame-lends/*.dump
```

Local Postgres guide: `docs/archive/operations/local-development-database.md`. Use `db:local:push` (not `db:migrate`) for a fresh Docker database.

`db:push` is blocked against prod-shaped URLs unless unlock word **lendwave** is in the command (see `no-prod-deploy.mdc`).

## Query patterns

- Use Drizzle query builder; avoid raw SQL unless necessary.
- Transactions for multi-table writes (loan + investors + periods).
- Manila timezone for user-visible dates (`src/lib/date-utils.ts`).

## MCP

Neon MCP (`https://mcp.neon.tech/mcp`) can list branches and run read-only SQL — prefer dev branch scope.
