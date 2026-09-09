# Mobile-native redesign (kame-lends)

**Status:** In progress (production hardening)  
**Repo:** kame-lends (SvelteKit at `src/`)  
**Updated:** 2026-09-09

## Goal

Make the phone experience feel like a native app: persistent bottom navigation, thumb-first actions, bottom sheets instead of centered desktop dialogs, safe-area-aware chrome, and consistent list/detail patterns. Desktop (`lg+`) keeps the sidebar + centered dialogs.

## Locked decisions

| Topic            | Choice                                                            |
| ---------------- | ----------------------------------------------------------------- |
| Shell breakpoint | `lg` (1024px)                                                     |
| Bottom tabs      | Up to 4 primary destinations from `src/lib/nav/app-nav.ts` + More |
| Overlays         | Sheet under `lg`; Dialog at `lg+` via `ResponsiveModal`           |
| List → detail    | Navigate to detail routes under `lg` for loans/debts/party lists  |
| Touch            | min 44×44px under `lg`                                            |
| Safe areas       | `viewport-fit=cover` + `env(safe-area-inset-*)`                   |
| PWA              | Light manifest + theme-color (no service worker)                  |

## Key modules

| Piece            | Path                                               |
| ---------------- | -------------------------------------------------- |
| Nav config       | `src/lib/nav/app-nav.ts`                           |
| Tab / top / more | `src/lib/components/layout/Mobile*.svelte`         |
| Sheet            | `src/lib/components/ui/sheet/*`                    |
| Responsive modal | `src/lib/components/common/ResponsiveModal.svelte` |
| Form chrome      | `src/lib/components/common/FormHeader.svelte`      |
| Safe-area CSS    | `src/lib/styles/mobile.css`                        |

## Production hardening notes

- `ResponsiveModal` locks sheet vs dialog while open (resize must not remount forms). Sheet breakpoint matches shell (`lg` / 1023).
- `FormHeader` `variant="embedded"` for modal/sheet forms; sticky actions use `lg` to match the tab shell.
- `DEFAULT_NAV_CAPABILITIES` is deny-by-default (`isAdminWorkspace: false`).
- List quick-view uses `isMobileShellViewport()` (`max-width: 1023px`).
- View mode and calendar day default use the same `lg` shell breakpoint.
- Page chrome: hide list `PageHeader` titles and detail Back under `lg`.

## Acceptance

- [x] Bottom tab bar under `lg` with More sheet
- [x] Safe-area utilities and viewport-fit=cover
- [x] ResponsiveModal for create/form/export/quick-pay/detail overlays
- [x] Loan/debt/party/investor-detail list open detail pages on phone
- [x] Sticky form actions on phone (page) / inline in sheets (embedded)
- [x] Light PWA manifest
- [x] Overlay presentation lock + FormHeader embedded variant
- [x] Unified `lg` breakpoint for shell, sheets, view mode, calendar, touch
- [x] De-duplicated mobile titles / back chrome
- [ ] Full route-guide set (partial: dashboard + loans notes)
- [ ] Device QA matrix signed off
