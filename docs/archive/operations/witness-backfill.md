# Witness contact backfill

One-shot data fix so the **Witnesses** filter on loan lists and `/witnesses` are populated from existing contract data.

## Problem

- Witness names live in `loan_contracts.customization` (`witness1Name`, `witness2Name`, etc.) and on `loan_signing_invitations.party_name`.
- The reusable `witnesses` table and `witness_id` links were added later, so historical loans often have no witness rows.
- The loan list witness filter reads `/api/witnesses?simple=true` and matches loans by `signingInvitations.witnessId`.

## Fix

```bash
# Preview (no writes)
bun run db:backfill:witnesses --dry-run

# Apply for all workspaces with loan contracts
bun run db:backfill:witnesses

# Single workspace owner
bun run db:backfill:witnesses --email=you@example.com
```

Uses `DATABASE_URL` from `.env.local`.

### Local Docker is empty?

```bash
bun run db:local:sync-prod
bun run db:backfill:witnesses --dry-run
```

Preview against Neon without syncing (read-only):

```bash
bun run db:backfill:witnesses --use-prod --dry-run
```

Apply on Neon prod (writes; backup first):

```bash
bun run backup:neon
bun run db:backfill:witnesses --use-prod
```

## Safety

| Target                            | Allowed                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| Local (`127.0.0.1` / `localhost`) | Yes                                                            |
| Neon dev branch                   | Yes                                                            |
| Neon production                   | Prefer backup first (`bun run backup:neon`); then `--use-prod` |

## What it updates

For each workspace owner (`loans.user_id`):

1. Reads witness fields from `loan_contracts.customization` and witness signing invitations.
2. Skips placeholder names (`Witness 1`, `Witness 2`, blank).
3. Creates deduplicated rows in `witnesses` (by normalized name + email within the workspace).
4. Sets `loan_signing_invitations.witness_id` and `witness1Id` / `witness2Id` in contract JSON.
5. Sets `witnesses.witness_user_id` when witness email matches an existing auth user (link only; does not create auth users).

Does not change loan amounts, payments, or contract prose.

## After running

1. Restart the dev server (in-memory caches).
2. Open `/loans` and confirm the Witnesses filter lists names.
3. Optional: open `/witnesses` to review merged contacts.
