# PWA manual QA

## Install

- [ ] Chrome desktop: install banner or browser menu → opens standalone
- [ ] Android Chrome: install prompt works
- [ ] iOS 16.4+: Share → Add to Home Screen

## Offline

- [ ] Visit `/dashboard` online, go offline, reload → cached dashboard + offline banner
- [ ] Cold offline visit to never-opened route → `offline.html`
- [ ] POST while offline → error toast with offline message

## Update

- [ ] Deploy new build → `Update ready` prompt → Reload applies new SW

## Push

- [ ] Settings → enable device notifications → Send test
- [ ] Due/overdue cron or loan activity triggers notification (staging)

## Privacy

- [ ] Sign out → `kl-pages` / `kl-data` cleared (DevTools → Application)
- [ ] Switch Google account → prior user's cache purged

## Kill-switch

- [ ] Set `PWA_DISABLED=true` → SW unregisters on next check
