# Mobile-native redesign (kame-lends)

**Status:** In progress  
**Repo:** kame-lends (SvelteKit at `src/`)  
**Updated:** 2026-09-09

## Goal

Make the phone experience feel like a native app: persistent bottom navigation, thumb-first actions, bottom sheets instead of centered desktop dialogs, safe-area-aware chrome, and consistent list/detail patterns. Desktop (`lg+`) keeps the sidebar + centered dialogs.

## Locked decisions

| Topic            | Choice                                                            |
| ---------------- | ----------------------------------------------------------------- |
| Shell breakpoint | `lg` (1024px)                                                     |
| Bottom tabs      | Up to 4 primary destinations from `src/lib/nav/app-nav.ts` + More |
| Overlays         | Sheet below `md`; Dialog at `md+` via `ResponsiveModal`           |
| List → detail    | Navigate to detail routes under `lg` for loans/debts              |
| Touch            | min 44×44px under `md`                                            |
| Safe areas       | `viewport-fit=cover` + `env(safe-area-inset-*)`                   |
| PWA              | Light manifest + theme-color (no service worker)                  |

## Key modules

| Piece            | Path                                               |
| ---------------- | -------------------------------------------------- |
| Nav config       | `src/lib/nav/app-nav.ts`                           |
| Tab / top / more | `src/lib/components/layout/Mobile*.svelte`         |
| Sheet            | `src/lib/components/ui/sheet/*`                    |
| Responsive modal | `src/lib/components/common/ResponsiveModal.svelte` |
| Safe-area CSS    | `src/lib/styles/mobile.css`                        |

## Acceptance

- [x] Bottom tab bar under `lg` with More sheet
- [x] Safe-area utilities and viewport-fit=cover
- [x] ResponsiveModal for create/form overlays
- [x] Loan/debt open detail pages on phone
- [x] Sticky form actions on phone
- [x] Light PWA manifest
- [ ] Full route-guide set (partial)
- [ ] Device QA matrix signed off
