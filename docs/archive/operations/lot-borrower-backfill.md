# Lot Title borrower backfill

One-shot data fix. Lot Title loans with no borrower and no assigned witness are set to the borrower **Precious Natividad** in the same workspace.

## Filter

A loan is updated only when all of these are true:

- `loans.type` is `Lot Title`
- `loans.borrower_id` is null
- no `loan_witnesses` row
- no witness signing invitation with a `witness_id`, or with a name other than the placeholders `Witness 1` / `Witness 2`

The borrower row is matched by name inside that loan's workspace. Two borrowers with the same name in one workspace abort the run.

## Backup

Hosted Neon (the only branch is named `production`, and it is the Vercel database) before any hosted write:

```bash
bun run backup:neon
```

Dump path: `~/Backups/kame-lends/kame-lends-neon-<timestamp>.dump`

## Run

```bash
# Preview local Docker
bun run db:assign:lot-borrower --dry-run

# Apply local Docker
bun run db:assign:lot-borrower

# Preview hosted Neon
bun run db:assign:lot-borrower --use-hosted --dry-run

# Apply hosted Neon (backup first)
bun run db:assign:lot-borrower --use-hosted
```

Uses `DATABASE_URL` from `.env.local`. `--use-hosted` (alias `--use-prod`) uses `DATABASE_URL_PROD`.

This is not a file under `db/migrations/`. Production CD would run that on every environment, including databases that do not have this borrower.
