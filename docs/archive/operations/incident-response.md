# Incident response

Short runbook for production incidents. Do not paste secrets, emails, or loan PII into tickets.

## Detect

- GitHub `cd-failure` issue or CD red badge
- `GET /api/health` not `ok: true`
- Vercel cron 401/500 or `integration_jobs` stuck `failed`
- Structured `[env]` / route error lines in Vercel logs (SHA + route, no PII)

## Contain

1. Confirm `x-vercel-id` is `sin1` and health status.
2. If a bad app deploy: Vercel rollback to the previous production deployment.
3. If PWA is serving a broken shell: set `PWA_DISABLED` / raise `PWA_MIN_VERSION`.
4. If an integration is looping: pause that cron or disable the feature flag; leave loan CRUD up.

## Recover

| Symptom           | Action                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Schema behind     | `bun run db:migrate:pending:vercel --yes` then confirm health                                                         |
| Bad additive SQL  | Fix-forward a new `db/migrations/*.sql` file                                                                          |
| Data corruption   | Restore to an isolated Neon branch or local Docker from `bun run backup:neon`; never restore onto live until verified |
| Cron unauthorized | Confirm `CRON_SECRET` on Vercel Production                                                                            |

## After

- Validate health, `/signin`, one loan list click, and the next cron run.
- Note SHA, rollback id, and what you changed in the CD issue or a short postmortem.
- Restore approver: workspace owner.
