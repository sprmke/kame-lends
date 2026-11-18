---
title: "Neon transfer cost guards"
status: in-progress
tags: [neon, ops, security, cost, backup]
updated: 2026-11-19
stage: for-testing
kind: plan
---

# Neon network-transfer control and abuse guards

## Goal

Stop a low-traffic production app from burning Neon public network transfer. Prove which idle services drive egress, cut those paths, and add security / cost guards so bots or accidental ops cannot force expensive Neon usage again.

## Scope

### In

- Inventory + egress telemetry for cron and high-cost APIs
- Slim / reschedule backup cron; strip receipt blobs from backup payloads
- Exclude receipt image columns from default payment SELECTs except explicit detail paths
- Harden rate limits and public/cron abuse paths; Neon usage alert + ops guardrails
- Docs: PROJECT.md, deployment notes, settings route guide

### Out

- Migrating historical receipts to R2 in this plan
- Changing Neon vendor or rewriting Auth.js
- Paying for enterprise observability products

## Approach

1. **Measure** structured `approxBytes` logs on crons and backup/export (no PII).
2. **Cut idle transfer** — weekly owner-only thin backup; lean payment SELECTs.
3. **Guards** — rate-limit `/api/health` and backup tighter; fail-closed rate store in production; Neon consumption alert; `--confirm-prod` on dump/repair scripts.
4. **Docs / verify** after Neon paid plan restores compute.

## Root cause (evidence)

| Finding            | Proof                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| Outage symptom     | `/signin?error=Configuration` + `/api/health` `db: unavailable`            |
| Neon error         | SQLSTATE `53000` quota exceeded                                            |
| Meter that tripped | Network transfer 5.92 GB (compute and storage were fine)                   |
| Primary idle hog   | Daily `/api/cron/backup` pulling full graphs + receipt blobs per CRM owner |

## Tasks

- [x] Egress logging helper + wire crons / `/api/backup`
- [x] Weekly owner-only slim backup cron; strip receipt columns from `backup-data`
- [x] Shared lean payment columns; load receipt fields only when UI needs them
- [x] Rate-limit health + tighter backup; fail-closed store in production
- [x] Neon project transfer weekly alert + `--confirm-prod` script guards
- [x] Docs: PROJECT, deployment, settings guide
- [x] Verify: Neon compute accepts connections; `/api/health` ok (`connected`, 0 pending); unit tests pass
- [ ] Manual: Google sign-in on production after deploy; confirm weekly backup cron schedule in Vercel
- [ ] Ops: set `NEON_API_KEY` + `NEON_PROJECT_ID` on Vercel Production for transfer alerts

## Docs to update

- `docs/PROJECT.md`
- `docs/architecture/deployment.md`
- `docs/guides/routes/settings.md`
- `.env.example` for Neon alert vars

## Open questions

None.
