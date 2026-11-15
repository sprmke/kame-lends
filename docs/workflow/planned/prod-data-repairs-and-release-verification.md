---
title: "Production data repairs and release verification"
status: planned
tags: [data-repair, production, qa, integrations]
updated: 2026-11-16
stage: planned
kind: plan
---

# Goal

Close the remaining production data anomalies and finish the checks that need real external channels, now that the money-correctness code is deployed.

# Scope

- Four data items: duplicate period dates, zero-capital fixed rows, receipt-less payments, unlinked payments.
- Status drift is already zero and is monitored by the ledger-based health check.
- External delivery: Google Calendar, Telegram, Web Push, email.
- One physical-device pass after the repairs.

# Ground rules

1. Back up production before any write. Record the dump path and SHA-256.
2. Dry run every repair against production with `--source=prod`.
3. Receipt-less payments are evidence. Do not bulk delete them.
4. Every applied repair runs in one transaction and writes `money_audit_events` with `reason = repair:<category>`.
5. Re-run `bun scripts/db/money-health-report.ts --source=prod` and attach before/after counts.

# Decisions

| Item                          | Count | Meaning                                                                  | Recommendation                                                                                                      |
| ----------------------------- | ----: | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Duplicate period dates        |     9 | Two periods share a due date on one allocation                           | Merge into the older period, move payments, delete the duplicate. Safe; the repair also adds the unique constraint. |
| Zero-capital fixed            |    13 | Agent allocation with no capital, interest stored as a fixed peso amount | Convert to the equivalent rate on the loan total. The repaired amount is preserved.                                 |
| Receipt-less created payments |    15 | Payment matches a period amount and due date but has no receipt          | Confirm whether cash was received. Keep and attach evidence, or soft-delete.                                        |
| Unlinked payments             |     4 | Payment not tied to a period on a multi-interest allocation              | Allowed for principal repayments. Confirm, no action expected.                                                      |
| Status drift                  |     0 | Stored period/loan status vs the ledger                                  | Nothing to do. The daily sweep and health report now share one rule.                                                |

# Tasks

## P1 · Back up and dry run

- Run `bun run backup:neon`; record the dump path and SHA-256.
- `bun scripts/db/repair/money-repairs.ts --category=duplicate-period-dates --source=prod`
- `bun scripts/db/repair/money-repairs.ts --category=zero-capital-fixed --source=prod`
- `bun scripts/db/repair/money-repairs.ts --category=receiptless-created-payments --source=prod`
- `bun scripts/db/repair/money-repairs.ts --category=unlinked-payments --source=prod`

## P2 · Apply the two safe repairs

```bash
bun scripts/db/repair/money-repairs.ts \
  --category=duplicate-period-dates \
  --source=prod --apply --backup-id=<id>

bun scripts/db/repair/money-repairs.ts \
  --category=zero-capital-fixed \
  --source=prod --apply --backup-id=<id>
```

- Verify the unique period-date constraint exists after the duplicate repair.
- Spot-check one converted agent loan: interest amount must not change.

## P3 · Receipt-less payments (manual)

- Review the 15 rows in the dry-run output: loan, investor, period, amount, date.
- Mark each as real (keep, attach receipt) or fake (soft-delete with a reason).
- No bulk action.

## P4 · Unlinked payments (confirm only)

- Review the 4 rows. Expected to be legitimate principal repayments.
- No write unless a row is wrong.

## P5 · External delivery checks

- Create a disposable test group and connect a test calendar.
- Verify calendar event dates and amounts equal the schedule.
- Connect Telegram and confirm reminder text and amounts.
- Enable Web Push on a test device and confirm the Manila-time reminder.
- Send one transactional email to a real inbox.
- Record results in `docs/workflow/qa/full-app-audit.md`.

## P6 · Device pass

- One owner pass on a real phone after the repairs: dashboard, loans, loan edit, payment, bank loan, settings.
- Record findings here or in a new tracker row.

# Docs to update

- `docs/workflow/in-progress/full-app-audit-and-money-correctness.md`: before/after counts and the final status.
- `docs/architecture/money-model.md` only if a repair changes a definition.
- `docs/workflow/qa/full-app-audit.md`: integration results and device findings.

# Open questions

- Were the 15 receipt-less payments real cash?
- Are the 4 unlinked payments principal repayments?
- Which calendar and Telegram account should be the disposable test target?
