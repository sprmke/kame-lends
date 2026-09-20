---
title: PWA — installable app, offline read, push
status: active
tags: [architecture, pwa, service-worker, offline, notifications]
updated: 2026-09-20
---

# PWA — installable app, offline read, push

Part of [`docs/PROJECT.md`](../PROJECT.md). Rollout tracker: [`docs/workflow/planned/pwa-offline-install-push.md`](../workflow/planned/pwa-offline-install-push.md).

## What ships

| Capability    | Behavior                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install       | `manifest.webmanifest`, shortcuts, screenshots; `runInstallAction` from `InstallPrompt`, sidebar/More `InstallAppNavButton`, Settings `InstallAppCard` (no Settings redirect) |
| Offline read  | Cached shell + visited pages + `__data.json` + allowlisted GET APIs                                                                                                           |
| Offline write | Blocked with 503 JSON toast (`You are offline. Connect to save changes.`)                                                                                                     |
| Update        | `UpdatePrompt` on SW waiting or SvelteKit `updated` store; never auto-reload                                                                                                  |
| Push          | Web Push for due/overdue reminders, loan activity, signing requests                                                                                                           |

Platform notes: desktop Chrome/Edge and Android are fully supported. iOS 16.4+ push requires Add to Home Screen first.

**Install taps:** Chromium runs `beforeinstallprompt` via `promptInstall`. iOS opens `InstallIosInstructionsModal` (Share → Add to Home Screen). Install entry points never navigate to Settings.

## Build wiring

- **`svelte.config.js`:** `serviceWorker.register: false`, deterministic `version.name` (`VERCEL_GIT_COMMIT_SHA` or `dev-local`; never `Date.now()` in one build), `pollInterval: 300_000`.
- **`src/service-worker.ts`:** hand-rolled fetch routing; `$service-worker` precache list (install uses per-URL `cache.add` so one 404 does not brick the worker). Non-GET offline: 503 JSON when `navigator.onLine` is false or network fails.
- **`src/lib/pwa/shared.ts`:** cache policy (worker-safe).
- **`src/hooks.client.ts` + `src/lib/pwa/offline-fetch.ts`:** patches `fetch`; dispatches `kl:offline-mutation` on blocked writes.
- **`src/lib/pwa/register.ts`:** registers SW when `import.meta.env.PROD` (preview + production; skipped in `bun dev`).
- **`PwaProvider.svelte`:** offline/online banner state, `kl:offline-mutation` → Sonner toast (same module graph as `<Toaster />`).
- **Precache budget:** `scripts/pwa/precache-budget.json` enforced after `build` in CI.
- **E2E:** `bun run test:e2e:pwa` (Playwright against `build && preview`); included in `ci:quality`.

## Cache table

| Cache              | Contents                                               |
| ------------------ | ------------------------------------------------------ |
| `kl-app-{version}` | Vite build assets, `static/`, `offline.html`           |
| `kl-pages`         | Successful navigation HTML                             |
| `kl-data`          | `__data.json` (normalized keys) + allowlisted GET APIs |
| `kl-fonts`         | Google Fonts CSS/files                                 |

**Never cached:** `/auth`, `/signin`, `/api/push`, `/api/storage`, `/api/export`, `/api/cron`, `/api/webhooks`, `/api/pwa`, `/api/e2e`, `/api/health`, `/api/ai`, `/api/backup`.

**Offline API allowlist (start):** `/api/loans`, `/api/party-profile/me`, `/api/payment-methods`.

## Push fanout

```
cron / loan mutation / signing email
  → sendPushToUser(userId, payload, { fingerprint, kind })
      → push_notification_log claim (dedupe)
      → push_subscriptions (active endpoints)
      → web-push (VAPID)
  → service worker push event → showNotification
```

**Triggers:**

- Daily: `GET /api/cron/reminders` (Vercel cron 01:00 UTC)
- Activity: `push.user.activity` job (parallel to Telegram activity)
- Signing: `sendSigningPushForEmails` from loan-created flow (runs even when Resend email is disabled)

**Env:** `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUBLIC_VAPID_PUBLIC_KEY`. Generate: `bun run pwa:generate-vapid-keys`.

## Kill-switch

`GET /api/pwa/version` → `{ disabled, minVersion }` (`cache-control: no-store`).

Set `PWA_DISABLED=true` or `PWA_MIN_VERSION` on Vercel to retire bad builds. SW checks on activate and throttled navigation; failed fetch does nothing.

`PWA_MIN_VERSION` is compared to the built `$service-worker` version with **string** `>` (same shape as `VERCEL_GIT_COMMIT_SHA` or `dev-local`). Use commit SHAs or monotonic build IDs; do not rely on semver ordering.

## Privacy tradeoff

Offline caches hold SSR HTML and JSON the signed-in user already fetched. Data is **not encrypted at rest**. `purgeOfflineState()` runs on sign-out and when `kl:uid` changes.

## Deploy checklist

1. Apply `db/migrations/0025_push_subscriptions.sql` (CD on `main`).
2. Set VAPID env vars on Vercel.
3. Verify install (Chrome desktop), offline revisit, update prompt, push test from Settings.
4. Optional: `bun run pwa:capture-screenshots` after preview for real install-dialog screenshots.
