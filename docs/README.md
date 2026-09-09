# Kame Lends documentation

Index for architecture, route guides, and workflow docs.

## Start here

| Doc                                                                                                      | Purpose                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [`PROJECT.md`](./PROJECT.md)                                                                             | Architecture, API inventory, env vars |
| [`guides/routes/README.md`](./guides/routes/README.md)                                                   | Per-page behavior specs               |
| [`workflow/in-progress/sveltekit-migration.md`](./workflow/in-progress/sveltekit-migration.md)           | SvelteKit migration checklist         |
| [`archive/operations/pre-migration-backup.md`](./archive/operations/pre-migration-backup.md)             | Neon backup before migration          |
| [`archive/operations/vercel-production-snapshot.md`](./archive/operations/vercel-production-snapshot.md) | Vercel prod settings snapshot         |

## Route guides

Per-page specs mirror `src/routes/` under **`guides/routes/`**. Index: [`guides/routes/README.md`](./guides/routes/README.md).

## Workflow

| Folder                  | Purpose                           |
| ----------------------- | --------------------------------- |
| `workflow/in-progress/` | Active migration and feature work |
| `workflow/planned/`     | Future plans                      |
| `archive/`              | Historical ops and reference      |

## AI tooling

- Rules: `.cursor/rules/README.md`
- Skills: `.agent/skills/`
- Setup: `bun run setup:ai-tooling`
