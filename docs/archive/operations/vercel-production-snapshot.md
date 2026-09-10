# Vercel production snapshot (pre-SvelteKit cutover)

Captured at migration start on branch `feat/sveltekit-migration`.

## Project

- **App:** PawnTracker / kame-lends
- **Framework (at snapshot):** Next.js 15 App Router (since replaced by SvelteKit at repo root)
- **Production URL:** `https://pawn-tracker.vercel.app` (public URL now `PUBLIC_APP_URL` in `.env.example`)

## Build (Next.js at snapshot)

| Setting | Value                          |
| ------- | ------------------------------ |
| Install | `bun install` or `npm install` |
| Build   | `next build`                   |
| Output  | Next.js default                |
| Dev     | `next dev --turbopack`         |

## Cron (`vercel.json`)

| Path               | Schedule                      |
| ------------------ | ----------------------------- |
| `/api/cron/backup` | `0 6 * * *` (06:00 UTC daily) |

## Environment variable names (production)

Must remain available after cutover (values unchanged unless noted):

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`
- `NEXT_PUBLIC_APP_URL` → may become `PUBLIC_APP_URL` in SvelteKit (document in cutover PR)
- `NEXT_PUBLIC_CONTRACT_DISPUTE_VENUE` → `PUBLIC_CONTRACT_DISPUTE_VENUE`
- `RESEND_API_KEY`
- `BACKUP_EMAIL`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`

## Target SvelteKit build (Phase 10)

| Setting   | Value                                                                 |
| --------- | --------------------------------------------------------------------- |
| Build     | `cd new-app && bun run build` (after promotion: root `bun run build`) |
| Adapter   | `@sveltejs/adapter-vercel`                                            |
| Cron path | `/api/cron/backup` (unchanged schedule)                               |

## Rollback

Redeploy the last successful **Next.js** production deployment from Vercel dashboard. Neon prod is unchanged if migration used dev branch only.
