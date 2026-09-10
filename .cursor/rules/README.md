# Cursor rules & skills — Kame Lends

Agent context for **SvelteKit 2 + Svelte 5 + Neon + Drizzle + Auth.js**.

## Always-on rules

| File                            | Purpose                                       |
| ------------------------------- | --------------------------------------------- |
| `project-context.mdc`           | Stack, migration layout, doc index            |
| `ai-usage.mdc`                  | Session hygiene, MCP discipline               |
| `documentation-maintenance.mdc` | Sync docs with code                           |
| `ui-minimal-copy.mdc`           | No extra UI prose                             |
| `human-copy.mdc`                | Production-grade copy                         |
| `git-commits.mdc`               | No AI attribution in commits                  |
| `no-prod-deploy.mdc`            | Block prod Neon/Vercel (unlock: **lendwave**) |
| `route-guides.mdc`              | Route docs in `docs/guides/routes/`           |

## Conditional rules (by glob)

| File             | Globs / topic                                       |
| ---------------- | --------------------------------------------------- |
| `tech-stack.mdc` | `src/**` — ban Next.js/client React (PDF exception) |
| `components.mdc` | shadcn-svelte, runes                                |
| `forms.mdc`      | superforms + Zod                                    |

## New developer setup

```bash
bun install
bun run setup:ai-tooling
```

| Step | Action                                                                  |
| ---- | ----------------------------------------------------------------------- |
| 1    | `bun run setup:ai-tooling` — symlinks + sync check                      |
| 2    | Open repo in Cursor / Claude Code / OpenCode                            |
| 3    | Neon MCP: OAuth via `https://mcp.neon.tech/mcp` on first use            |
| 4    | `uv tool install markitdown-mcp` (optional, for PDF/Office attachments) |

**Skills:** edit `.agent/skills/<name>/SKILL.md` — `.cursor/skills/` and `.claude/skills/` are symlinks.

**Drift check:** `bun run check:ai-tooling-sync`

## Domain skills

| Skill                         | Use for                                    |
| ----------------------------- | ------------------------------------------ |
| `loan-domain`                 | Loans, investors, interest periods, portal |
| `sveltekit-conventions`       | Routes, loaders, server/client split       |
| `drizzle-neon`                | Schema, migrations, Neon branches          |
| `auth-js-sveltekit`           | Google sign-in, route protection           |
| `pdf-export`                  | Server-only React-PDF                      |
| `google-calendar-integration` | Calendar sync                              |
| `documentation-maintenance`   | Same-change docs                           |
| `route-guides`                | Per-route specs                            |

## Related

- **`CLAUDE.md`** — Claude Code always-loaded context
- **`opencode.json`** — OpenCode instructions + MCP
- **`docs/workflow/done/sveltekit-migration.md`** — migration history
