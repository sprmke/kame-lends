---
name: data-repair
description: "Use before repairing production money data, writing a repair script, or reviewing the Data health card."
---

# Data repair

## Protocol

1. **Backup.** `bun run backup:neon` and record the dump path + SHA-256.
2. **Report.** Run `bun run db:health:money` (read-only) on a copy. Never start from a hypothesis.
3. **Copy.** Restore the snapshot into local Postgres (`bun run db:local:sync-prod`). Reproduce the anomaly there.
4. **Dry run.** `bun scripts/db/repair/money-repairs.ts --category=…` prints what would change.
5. **Approve.** Review counts and sample ids with the owner. Receipt-less payments are evidence; deleting them is a money decision, not a cleanup.
6. **Apply.** `--apply --backup-id=<id>`. The script runs in one transaction and writes `money_audit_events` with `reason = repair:<category>`.
7. **Re-run the report.** Attach before/after counts to the plan.
8. **Verify.** Spot-check one repaired loan against `buildLoanLedger`.

## Bans

- No one-click repair endpoints in Settings.
- No repair without a backup id.
- No hard deletes of payment rows.
- No automatic job that deletes unlinked payments.
- No production SQL from an agent session without explicit approval.

## Categories

`duplicate-period-dates`, `zero-capital-fixed`, `receiptless-created-payments` (report only). Add a new category only with a dry run, a transaction, an audit event, and a before/after report.
