# Investor portal link backfill

One-shot data fix so **Investments** (`/investments`) lists every loan where your login is tied to an investor contact, not just loans on the first linked contact.

## Problem

- **Loans** shows investor **names** on each loan record.
- **Investments** only includes loans whose investor contact has `investors.investor_user_id` set to your auth user id.
- Historical data often has many "Michael D. Manlulu" contacts with no portal link, or only one linked row.

## Fix

```bash
# Preview (no writes)
bun run db:backfill:investor-links --dry-run

# Link contacts in your workspace whose email matches your login email
bun run db:backfill:investor-links

# Also link Manlulu-named contacts in your workspace (when email differs)
bun run db:backfill:investor-links --include-name

# Single user
bun run db:backfill:investor-links --email=you@example.com
```

Uses `DATABASE_URL` from `.env.local`. The auth table is `"user"` (Auth.js), not `users`.

### Local Docker is empty?

If you see `relation "users" does not exist` or a schema message, local Postgres has no data yet:

```bash
bun run db:local:sync-prod          # read-only pull from Neon prod → local
bun run db:backfill:investor-links --dry-run
```

Preview against Neon without syncing (read-only):

```bash
bun run db:backfill:investor-links --use-prod --dry-run
```

Apply on Neon prod (writes; backup first):

```bash
bun run backup:neon
LENDWAVE=lendwave bun run db:backfill:investor-links --use-prod
```

## Safety

| Target                            | Allowed                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Local (`127.0.0.1` / `localhost`) | Yes                                                                                  |
| Neon dev branch                   | Yes                                                                                  |
| Neon production                   | Only with `LENDWAVE=lendwave` in the command string; run `bun run backup:neon` first |

Example prod (human-only unless unlocked in chat):

```bash
LENDWAVE=lendwave bun run db:backfill:investor-links
```

## After running

1. Restart the dev server (in-memory loan cache).
2. Open `/investments`; widen the date range if loans fall outside the current month (due-date filter).

## What it updates

For each user with an email, sets `investor_user_id` on investor contacts in **that user's workspace** (`investors.user_id`) when:

- contact email matches the user's login email (default), or
- with `--include-name`: contact name matches `%manlulu%` (case-insensitive)

Does not change loan amounts, payments, or ownership.
