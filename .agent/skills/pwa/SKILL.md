---
name: pwa
description: PWA installability, service worker caching, offline read-only mode, update/install prompts, and Web Push. Use when changing src/service-worker.ts, src/lib/pwa/**, static/manifest.webmanifest, push APIs, or any feature that affects offline or notifications.
---

# PWA — Kame Lends

Use when adding or changing features that touch installability, offline behavior, or push.

## Architecture

- **SW:** `src/service-worker.ts` (SvelteKit `$service-worker` build manifest)
- **Policy:** `src/lib/pwa/shared.ts` (importable by SW + Vitest)
- **Client glue:** `src/lib/pwa/register.ts`, `src/lib/components/pwa/PwaProvider.svelte`
- **Push server:** `src/lib/server/push/*`, routes under `src/routes/api/push/*`
- **Docs:** `docs/architecture/pwa.md`

## Caching strategy

| Request                                                | Strategy                                    |
| ------------------------------------------------------ | ------------------------------------------- |
| Precached `build` + `static` + `offline.html`          | Cache-first (`kl-app-{version}`)            |
| `/_app/immutable/*`                                    | Cache-first                                 |
| Navigation GET (HTML)                                  | Network-first → `kl-pages` → `offline.html` |
| `__data.json`                                          | Network-first → `kl-data` (normalized key)  |
| Allowlisted GET `/api/*`                               | Network-first → `kl-data`                   |
| POST/PUT/DELETE offline                                | Synthetic 503 JSON (`OFFLINE_ERROR_BODY`)   |
| `/auth`, `/signin`, `/api/push`, storage, export, cron | Never cache                                 |

## Adding offline-readable data

1. Confirm the screen is useful offline and PII tradeoff is acceptable.
2. Add GET path prefix to **`OFFLINE_API_READS`** in `shared.ts`.
3. Ensure the page SSR load or client fetch uses that GET while online first.
4. Update `docs/architecture/pwa.md` allowlist table.

## Adding a push notification kind

1. Add preference column or reuse an existing flag in **`user_push_preferences`**.
2. Send via **`sendPushToUser()`** with a stable **`fingerprint`** for dedupe.
3. Wire trigger (cron, job handler, or email fanout).
4. Document in `docs/architecture/pwa.md` and Settings route guide.

## Testing

```bash
bun run build && bun run preview
bun run test:e2e:pwa
bun run test:unit
```

SW is **off in `vite dev`** (`register.ts` bails when `dev`). Test with preview or production build.

## Pre-ship checklist

- [ ] No `$lib/server/*` imports from SW or `shared.ts`
- [ ] New static assets included in precache budget (`bun run build && node scripts/pwa/check-precache-budget.mjs`)
- [ ] Sign-out and account switch call **`purgeOfflineState()`**
- [ ] Push sends use log dedupe; VAPID env vars documented in `.env.example`
- [ ] Route guide updated if Settings or shell UX changed
