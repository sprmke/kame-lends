# SvelteKit migration — completed

Branch: **`feat/sveltekit-migration`**. **Cutover done:** SvelteKit app promoted to repo root (legacy Next.js archived locally as `_legacy-next-*`, gitignored).

**Post-cutover:** Run manual QA on dev Neon branch (`docs/workflow/qa/sveltekit-manual-qa.md`). Production deploy requires **`lendwave`** unlock.

---

## Phase 0 — Safety net

- [ ] Sync `main` with `origin/main`
- [ ] Create `feat/sveltekit-migration` branch
- [ ] `bun run backup:neon` (pg_dump outside repo)
- [ ] `bun run backup:neon:branches` (or create branches in Neon Console)
  - [ ] `pre-sveltekit-migration-backup` branch
  - [ ] `dev-sveltekit-migration` QA branch
- [ ] Record Vercel prod settings → `docs/archive/operations/vercel-production-snapshot.md`
- [ ] Copy env var names to password manager (not values in git)

## Phase 1 — AI tooling & documentation scaffolding

- [x] `.agent/skills/` canonical skills
- [x] `.cursor/rules/*.mdc` (project-context, tech-stack, no-prod-deploy, etc.)
- [x] `CLAUDE.md`, `opencode.json`, `.claude/settings.json` + hooks
- [x] `.mcp.json` (neon, context7, playwright, markitdown)
- [x] Hooks: prod-deploy guard (`lendwave`), shipped-migration guard, stack-terminology
- [x] `scripts/dev/setup-ai-tooling.sh` + `check-ai-tooling-sync.sh`
- [x] `docs/README.md`, `docs/PROJECT.md`
- [x] This tracker file
- [ ] `.husky/` + commitlint + lint-staged (optional follow-up)

## Phase 2 — SvelteKit foundation (`new-app/`)

- [ ] Copy legacy source into `new-app/` as reference (exclude `node_modules`, `.next`, `.git`)
- [x] Scaffold SvelteKit 2 + Svelte 5 + TypeScript
- [ ] Port Tailwind 4 theme from `app/globals.css`
- [ ] Init shadcn-svelte (`components.json`, `src/lib/components/ui/`)
- [ ] Port Drizzle schema + client to `new-app/src/lib/server/db/`
- [x] `svelte.config.js` with `adapter-vercel`
- [x] ESLint + Prettier + svelte-check
- [ ] `.env` pointed at `dev-sveltekit-migration` Neon branch
- [ ] CI workflow (svelte-check, lint, build)

## Phase 3 — Design system port

- [ ] shadcn-svelte primitives (button, card, input, label, textarea, checkbox, select, tabs, table, badge, avatar, skeleton, scroll-area, collapsible, popover, dialog, alert-dialog, alert, dropdown-menu)
- [ ] Date picker (Calendar + `@internationalized/date`)
- [ ] Toasts (`svelte-sonner`)
- [ ] `lucide-svelte` icons
- [ ] Layout: nav, price-visibility shell

## Phase 4 — Domain logic port

- [ ] Pure `lib/` modules → `new-app/src/lib/`
- [ ] Server modules → `new-app/src/lib/server/` (google-calendar, access-control, signing, backup-data, etc.)
- [ ] Zustand stores → Svelte 5 runes (`.svelte.ts`)
- [x] Vitest for `calculations.ts`, `debt-calculations.ts`, `access-control.ts`

## Phase 5 — Auth.js + route protection

- [ ] `@auth/sveltekit` + Drizzle adapter
- [ ] Port `middleware.ts` matrix to `hooks.server.ts`
- [ ] `/signin` page
- [ ] Validate admin + investor sign-in on dev Neon branch

## Phase 6 — Feature parity build-out

- [ ] **6.1** Landing page
- [ ] **6.2** Dashboard (cards, charts, activity panels)
- [ ] **6.3** Loans (list, create, detail, interest periods, duplicate modals)
  - [x] Loans list + detail (initial port)
  - [x] `/loans/new` simplified create form (single investor allocation)
- [ ] **6.4** Contracts & e-signature (`/sign/[token]`, PDF preview)
- [ ] **6.5** Investors (list, create, detail, portal linkage)
  - [x] `/investors` list (table + cards, search)
  - [x] `/investors/new` create form
  - [x] `/investors/[id]` detail (contact, summary, loans table, edit)
- [ ] **6.6** Borrowers (+ `/barrowers` typo redirect)
  - [x] `/borrowers/[id]` detail with contact info + linked loans
- [ ] **6.7** Debts (periods, consolidate payment)
  - [x] `/debts` list (table + cards)
  - [x] `/debts/new` create form
  - [x] `/debts/[id]` detail (summary + interest periods)
- [ ] **6.8** Transactions (behind `SHOW_TRANSACTIONS_UI` flag)
  - [x] `/transactions` list (table + cards; routes work when flag off)
  - [x] `/transactions/new` create form
  - [x] `/transactions/[id]` detail
- [ ] **6.9** Settings (backup download, maintenance actions)
  - [x] Download backup, fix payments, sync due dates, sync calendar buttons
- [ ] **6.10** Google Calendar sync UI/endpoints
- [ ] **6.11** PDF export endpoints
- [ ] **6.12** CSV export
- [ ] **6.13** Cron backup email route
- [ ] **6.14** Overdue checker on mount

## Phase 7 — Cross-cutting concerns

- [ ] Port hooks → runes composables (filters, pagination, sorting, responsive view mode)
- [ ] Navigation progress (SvelteKit lifecycle)
- [x] Mobile responsiveness (375/768/1024px+, 44px touch targets) — see `docs/workflow/planned/mobile-native-redesign.md`
- [ ] Accessibility pass

## Phase 8 — Testing & parity QA

- [x] Vitest unit tests: `calculations.test.ts`, `debt-calculations.test.ts`, `access-control.test.ts`
- [ ] Playwright smoke tests (sign-in, create loan, dashboard, signing, backup)
- [ ] Manual side-by-side QA checklist per route
- [ ] Price-visibility toggle parity

## Phase 9 — Data validation on Neon branch

- [ ] Full QA on `dev-sveltekit-migration` branch
- [ ] Validate all write paths (loans, payments, debts, transactions)
- [ ] Calendar sync on test calendar; Resend on test recipient
- [ ] Row-count / dump spot checks before/after QA

## Phase 10 — Cutover / promotion

- [ ] Merge branch up to date with `main`
- [ ] Promote `new-app/*` to repo root
- [ ] Delete legacy Next.js tree and unused deps
- [ ] Update Vercel build config + `vercel.json` cron
- [ ] Explicit prod deploy (requires **`lendwave`**)
- [ ] Post-cutover monitoring; keep Next.js deployment rollback-ready

## Phase 11 — Cleanup & documentation

- [ ] Remove dead code and unused dependencies
- [ ] Document `SHOW_TRANSACTIONS_UI` decision
- [ ] Finalize `docs/PROJECT.md`, `docs/guides/routes/*`, `CLAUDE.md`, rules
- [ ] Move this file to `docs/workflow/done/`
- [ ] Tag last Next.js commit (`pre-sveltekit-migration`)

---

## Rollback

- Phases 0–9: prod app and Neon prod unchanged.
- Phase 10: redeploy last Next.js Vercel deployment; Neon prod untouched if dev branch only.
- Neon `pre-sveltekit-migration-backup` branch for last-resort restore.
