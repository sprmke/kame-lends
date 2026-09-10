# Claude Code tooling — Kame Lends

Mirrors `.cursor/rules/README.md`. `.mdc` rules are not auto-loaded — use **`CLAUDE.md`** and skills.

## Setup

```bash
bun install
bun run setup:ai-tooling
```

| Item           | Location                                           |
| -------------- | -------------------------------------------------- |
| One-shot setup | `bun run setup:ai-tooling`                         |
| Hooks          | `.claude/settings.json` → `.claude/hooks/`         |
| Shared skills  | `.agent/skills/` via symlinks in `.claude/skills/` |
| Drift check    | `bun run check:ai-tooling-sync`                    |

## Always loaded

| File        | Purpose                         |
| ----------- | ------------------------------- |
| `CLAUDE.md` | Stack, commands, doc-sync rules |

## Skills

Edit `.agent/skills/<name>/SKILL.md` — do not edit symlinked `.claude/skills/` paths.

Key domain skills: `loan-domain`, `sveltekit-conventions`, `drizzle-neon`, `auth-js-sveltekit`, `pdf-export`, `google-calendar-integration`.

## Hooks (`.claude/settings.json`)

| Script                        | Event             | Purpose                               |
| ----------------------------- | ----------------- | ------------------------------------- |
| `guard-shell.sh`              | PreToolUse / Bash | Deny prod deploy without **lendwave** |
| `guard-shipped-migrations.sh` | PreToolUse / Edit | Deny editing `db/migrations/*`        |

## MCP (`.mcp.json`)

`neon` (OAuth), `playwright`, `context7`, `markitdown` — shared with Cursor via `.cursor/mcp.json` symlink.

## Updating

- Skills: edit `.agent/skills/` only.
- Hooks: keep `.cursor/hooks/` and `.claude/hooks/` in sync conceptually.
- Run `bun run check:ai-tooling-sync` before committing tooling changes.
