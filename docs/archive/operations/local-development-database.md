# Local development database

Optional **Docker Postgres** for fast iteration. It is completely separate from Neon production.

## What is safe

| Action                                            | Touches prod?                                              |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `bun run db:local:start` / `db:local:stop`        | No — runs Docker on your machine only                      |
| `bun run db:local:push` / `db:local:migrate`      | No — `scripts/db/local-db-push.sh` → `127.0.0.1:5433` only |
| `bun run db:local:studio`                         | No — same hardcoded local URL                              |
| Pointing `.env.local` at `127.0.0.1:5433`         | No — app reads/writes local DB only                        |
| Performance code (pool driver, caches, streaming) | No — connection and read-path only; no schema wipes        |

## What can affect prod

Only if **`DATABASE_URL` points at Neon prod** and you run:

- `bun run db:push` (blocked without **`lendwave`** in the command)
- `bun run db:migrate` (applies pending SQL migrations — review files first)
- Normal app writes (loans, payments, overdue status updates)

Back up before prod schema work: `bun run backup:neon`.

## Quick start (empty local DB)

```bash
bun run db:local:start
bun run db:local:push
```

`db:local:push` applies `src/lib/server/db/schema.ts` to the empty local database. `db:local:migrate` is an alias. Do not paste shell comments on the same line as the command (e.g. `# only hits …` breaks `drizzle-kit`).

In `.env.local` (your choice — does not change Vercel prod env):

```env
DATABASE_URL=postgresql://kame_lends:kame_lends@127.0.0.1:5433/kame_lends
```

Restart `bun dev`.

Local Postgres starts **empty**. To load hosted Neon data without writing to Neon:

```bash
bun run db:local:start
# Keep DATABASE_URL_PROD on Neon. Then:
bun run db:local:sync-prod
```

`db:local:sync-prod` runs **read-only** `pg_dump` against `DATABASE_URL_PROD`, then `pg_restore` into `127.0.0.1:5433` only. Neon is not modified.

If Neon blocks pulls (data-transfer quota), restore the latest on-disk backup instead:

```bash
bun run db:local:sync-prod --from-dump
# or: bun run db:local:sync-prod --from-dump ~/Backups/kame-lends/kame-lends-neon-YYYYMMDD-HHMMSS.dump
```

Create a fresh snapshot (read-only): `bun run backup:neon` while `DATABASE_URL` points at Neon (writes to `~/Backups/kame-lends/`).

After restore, the script runs `db:local:push` so newer columns (e.g. multi-role links) exist without touching prod.

## Stop local Postgres

```bash
bun run db:local:stop
```

`docker compose down` keeps the volume. `docker compose down -v` deletes **local** data only.

## Exported DATABASE_URL wins over `.env.local`

`$env/dynamic/private` reads `process.env` first, and `bun dev` inherits the shell. If a terminal exported `DATABASE_URL` (for example a placeholder pasted from `.env.example`), the app ignores `.env.local` and every Auth.js query fails with `AdapterError` / `SessionTokenError`.

```bash
# in the terminal running the dev server
unset DATABASE_URL
```

Then restart `bun dev`. Placeholder values are now ignored with a `[db] Ignoring placeholder DATABASE_URL` warning, but a real wrong URL is still used as given.

## Switch back to Neon

Restore your Neon `DATABASE_URL` in `.env.local` and restart dev. Prod data is unchanged.
