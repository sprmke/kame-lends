---
title: "Production data repairs and release verification"
status: planned
tags: [data-repair, production, qa, integrations]
updated: 2026-11-16
stage: planned
kind: plan
---

# Goal

Close the pre-existing production data anomalies and finish the checks that need real external channels, now that the money-correctness code is merged and deployed.

# Scope

- Seven data-health items from `bun run db:health:money` on the production snapshot.
- External delivery checks: Google Calendar, Telegram, Web Push, email.
- One physical-device pass after release.
- No new features and no schema changes unless a repair proves one is needed.

# Ground rules

1. Back up production before any write. Record the dump path and SHA-256.
2. Dry run every repair. Never start from a hypothesis.
3. Receipt-less payments are evidence. Do not bulk delete them.
4. Status-only fixes go through the ledger, not ad-hoc SQL.
5. Every applied repair runs in one transaction and writes `money_audit_events` with `reason = repair:<category>`.
6. Re-run `bun run db:health:money` and attach before/after counts.

# Decisions

| Item                              | Count | Meaning                                                                  | Recommendation                                                                   |
| --------------------------------- | ----: | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Duplicate period dates            |     9 | Two periods share a due date on one allocation                           | Merge into the older period, move payments, delete the duplicate. Safe.          |
| Zero-capital fixed                |    13 | Agent allocation with no capital, interest stored as a fixed peso amount | Convert to a rate based on loan total unless the fixed amount was intentional.   |
| Receipt-less created payments     |    15 | Payment matches a period amount and due date but has no receipt          | Confirm whether cash was received. Keep and attach evidence, or soft-delete.     |
| Unlinked payments                 |     4 | Payment not tied to a period on a multi-interest allocation              | Allowed for principal repayments. Confirm, no action expected.                   |
| Completed but underpaid periods   |    13 | Period marked Completed with no linked payments (loan 19)                | Record the real payments if cash was received; otherwise let status recalculate. |
| Pending but overpaid periods      |     2 | Payments already cover the period, status still Incomplete               | Status sync marks them Completed. No money moves.                                |
| Overdue without an overdue period |     6 | Loan status is stale                                                     | Status sync recalculates from the ledger. No money moves.                        |

# Tasks

## P1 · Back up and reproduce

- Run `bun run backup:neon`; record the dump path and SHA-256.
- Restore the snapshot locally with `bun run db:local:sync-prod`.
- Run `bun run db:health:money` and save the before counts.

## P2 · Duplicate period dates (safe)

- Dry run: `bun scripts/db/repair/money-repairs.ts --category=duplicate-period-dates`
- Apply: `--apply --backup-id=<id>`
- The script reassigns payments to the keeper, deletes the duplicate period, and adds the unique period-date constraint when the table is clean.
- Verify: health check reaches 0 and `0042`'s constraint exists.

## P3 · Zero-capital fixed (needs approval)

- Review the 13 rows in Settings → Data health or with the dry run.
- Approve rows where interest should scale with principal.
- Apply: `--category=zero-capital-fixed --apply --backup-id=<id>`
- Verify one converted loan against `buildLoanLedger`.

## P4 · Receipt-less payments (manual)

- Print loan, investor, date, and amount for the 15 rows.
- Mark each as real (keep, attach receipt) or fake (soft-delete with reason).
- No bulk action.

## P5 · Unlinked payments (confirm only)

- Review the 4 rows. Expected to be legitimate principal repayments.
- No write unless a row is wrong.

## P6 · Status-only items (safe)

- Let the daily `/api/cron/loan-status` recalculate, or trigger it once with `CRON_SECRET`.
- Expected: pending-overpaid becomes Completed; stale Overdue loans clear.
- If cron cannot run, add a repair category that calls `syncLoanStatuses` and audits the change.

## P7 · Completed-underpaid periods (business call)

- Loan 19 has 13 periods marked Completed with no payments.
- If cash was received, record the payments. If not, let the status sync revert them.
- Do not waive silently. Use `status_reason` or `waived_amount` if the owner forgives the amount.

## P8 · External delivery checks

- Create a disposable test group and connect a test calendar.
- Verify calendar event dates and amounts equal the schedule.
- Connect Telegram and confirm reminder text and amounts.
- Enable Web Push on a test device and confirm the Manila-time reminder.
- Send one transactional email to a real inbox.
- Record results in `docs/workflow/qa/full-app-audit.md`.

## P9 · Device pass

- One owner pass on a real phone after deploy: dashboard, loans, loan edit, payment, bank loan, settings.
- Record findings here or in a new tracker row.

# Docs to update

- `docs/workflow/in-progress/full-app-audit-and-money-correctness.md`: before/after counts and the final status.
- `docs/architecture/money-model.md` only if a repair changes a definition.
- `docs/workflow/qa/full-app-audit.md`: integration results and device findings.

# Open questions

- Are the 13 zero-capital fixed rows intentional fixed agent deals, or old conversions?
- Were the 15 receipt-less payments real cash?
- Did loan 19's 13 completed periods receive cash outside the app?
- Which calendar and Telegram account should be the disposable test target?
