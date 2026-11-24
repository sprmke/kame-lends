# Orca worktrees

One checkout per task, each with its own Vite port, sharing one local Postgres.

## Ports

| Checkout                                          | Port                                                 |
| ------------------------------------------------- | ---------------------------------------------------- |
| Primary (`Projects/personal-projects/kame-lends`) | `3200`                                               |
| Other Orca worktrees                              | Sticky `3201`-`3299`, derived from the worktree path |

```bash
bun run ui          # this worktree's Vite, writes .local/vite-port
bun run ui:port     # print the port only
```

`./dev.sh --ui-only` uses the same launcher. A collision bumps to the next free
port in the range and never kills a listener owned by another worktree.

## Orca setup

Repo root [`orca.yaml`](../../orca.yaml):

- `scripts.setup` → `bun install` + copy `.env.local` from `ORCA_ROOT_PATH` when missing
- `defaultTabs` → opens a **UI** tab that runs `bun run ui`
- `scripts.archive` → stops only this worktree's Vite

In Orca: **Settings → Projects → kame-lends → Worktree hooks → Advanced →
Command source** → **orca.yaml only**.

The Docker Postgres on `:5433` is shared. Start it once with `./dev.sh`; a
worktree's UI tab must not start a second Postgres.

## Local test login

`/signin` shows **Use local test account** under `vite dev` when `DATABASE_URL`
points at `127.0.0.1` or `localhost`:

- Account: `E2E_USER_EMAIL`, default `e2e@example.com` (role `admin`)
- Data: `./dev.sh` runs `scripts/db/seed-e2e.ts`; or run
  `DATABASE_URL=postgresql://kame_lends:kame_lends@127.0.0.1:5433/kame_lends bun run seed:dev`
- The button is disabled in builds and against a hosted database

If `./dev.sh` reports `port is already allocated` on `5433`, another Docker
project owns that port. Stop that project or point `DATABASE_URL` at a free
local port; the login check accepts any loopback port.

## Verify

1. `./dev.sh` → Postgres, migrations, seed, Vite.
2. Open the printed URL, go to `/signin`, click **Use local test account**.
3. The dashboard loads with the seeded E2E loan and investor.
4. `bun run ui` in a second worktree gets a different port and reuses the same DB.
