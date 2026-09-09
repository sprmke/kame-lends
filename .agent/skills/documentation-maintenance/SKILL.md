# Documentation maintenance — Kame Lends

Invoke before claiming any material change done. Mirrors `.cursor/rules/documentation-maintenance.mdc`.

## Same-change updates

| Change                                     | Update                                                        |
| ------------------------------------------ | ------------------------------------------------------------- |
| Architecture, routes, env, API, data model | `docs/PROJECT.md`                                             |
| Page/section UX in `new-app/`              | `docs/guides/routes/*.md` (+ `route-guides` skill)            |
| Migration progress                         | `docs/workflow/in-progress/sveltekit-migration.md` checkboxes |
| Ops runbooks                               | `docs/archive/operations/`                                    |
| Stack conventions                          | `.cursor/rules/project-context.mdc` if paths mislead agents   |

## Rules of thumb

- Small accurate edits over full rewrites.
- New env var or route → row in `docs/PROJECT.md`.
- Fix contradictions immediately; docs are source of truth alongside code.

## Exempt

Typos, rename-only refactors with no behavior/API/UX change.

## Claude Code

`.mdc` files are not auto-loaded — read this skill or `CLAUDE.md` § Docs are the source of truth.
