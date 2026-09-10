# Pre-SvelteKit migration backup

Run these **before** any migration work on `feat/sveltekit-migration`.

## 1. Local pg_dump (read-only)

```bash
bun run backup:neon
```

Writes to `~/Backups/kame-lends/` (override with `KAME_LENDS_BACKUP_DIR`). Never commit dump files.

## 2. Neon branch snapshot

```bash
bun run backup:neon:branches
```

Or in [Neon Console](https://console.neon.tech): create branches from production:

| Branch                           | Purpose                                    |
| -------------------------------- | ------------------------------------------ |
| `pre-sveltekit-migration-backup` | Point-in-time restore                      |
| `dev-sveltekit-migration`        | SvelteKit QA (`.env.local` `DATABASE_URL`) |

**Do not** point `.env.local` at the production connection string during development.

## 3. Vercel settings snapshot

See [vercel-production-snapshot.md](./vercel-production-snapshot.md).

## 4. Env vars in password manager

Copy `.env.local` / production Vercel env names (not values in git) for rollback.
