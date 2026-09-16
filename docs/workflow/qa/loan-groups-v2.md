# Loan Groups v2 — manual QA

**Flag:** keep `SHOW_GROUPS_UI = false` until this checklist passes on QA, then flip.

## Setup

1. `bun run db:migrate:pending` (includes `0020_loan_groups_v2.sql`)
2. Optional: `bun run db:backfill:group-members`
3. Service account env set; Telegram env optional
4. Temporarily set `SHOW_GROUPS_UI = true` locally for UI QA

## Owner flows

- [ ] Create group via wizard (investor start + rule + access preview)
- [ ] Bulk add from `/loans` selection (when bulk bar is enabled)
- [ ] Chip bar filters `/loans` (All / group / Ungrouped); badges on cards
- [ ] Hub tabs: Overview, Loans, People, Settings
- [ ] Remove loan shows access preview; party loses access
- [ ] Calendar provisions and ACL shares to member emails
- [ ] Telegram connect link binds chat; Send test works
- [ ] Delete group deletes calendar job and revokes access

## Party flows

- [ ] Member sees Groups in nav/dock after joining
- [ ] Can open sibling loan read-only; no email/ID/receipts
- [ ] Payment/contract/storage APIs return 403/404
- [ ] Role pages (`/investments` etc.) stay role-scoped

## Cron / jobs

- [ ] `GET /api/cron/groups` without bearer → 401
- [ ] With `Authorization: Bearer $CRON_SECRET` drains jobs and sends reminders once (dedupe)

## Prod audit (done 2026-09-15)

Neon production had 0 groups / 0 group loans / 0 members. Migration backfill is a no-op.
