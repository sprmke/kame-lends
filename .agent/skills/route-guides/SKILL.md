# Route guides — Kame Lends (SvelteKit)

Invoke for every route/page/section change in `src/`. Mirrors `.cursor/rules/route-guides.mdc`.

## Location

`docs/guides/routes/` — one guide per page/section, mirroring SvelteKit URLs under `src/routes/`.

Index: `docs/guides/routes/README.md`.

## Naming

| SvelteKit route   | Guide path                               |
| ----------------- | ---------------------------------------- |
| `/`               | `docs/guides/routes/index.md`            |
| `/dashboard`      | `docs/guides/routes/dashboard.md`        |
| `/loans`          | `docs/guides/routes/loans.md`            |
| `/loans/[id]`     | `docs/guides/routes/loans-detail.md`     |
| `/investors/[id]` | `docs/guides/routes/investors-detail.md` |
| `/sign/[token]`   | `docs/guides/routes/sign.md`             |

Use nested folders for deep trees if needed.

## Per-guide contents

- **Behavior** — what the page does
- **Load/actions** — `+page.server.ts` data and mutations
- **Validation** — Zod schemas, superforms
- **Permissions** — admin vs investor
- **Edge cases** — empty states, not-found, errors
- **Implementation map** — key Svelte and server file paths

## Template

Copy from `docs/guides/_template.md` when adding a route.

## When to skip

Typos or internal renames with no UX/API change.
