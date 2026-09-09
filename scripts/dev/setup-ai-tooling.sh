#!/usr/bin/env bash
# One-shot team dev setup: Cursor + Claude Code + OpenCode rules/skills/hooks/MCP parity.
# Idempotent — safe to re-run after clone or when symlinks break.
#
# Prod deploy unlock word for shell hooks: lendwave (see .cursor/rules/no-prod-deploy.mdc)
#
# Usage: bun run setup:ai-tooling [options]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

for arg in "$@"; do
  case "$arg" in
    -h | --help)
      cat <<'EOF'
Usage: bun run setup:ai-tooling

Project-scoped AI tooling for Cursor, Claude Code, and OpenCode:
  - .cursor/mcp.json symlink -> .mcp.json
  - .agent/skills -> .cursor/skills + .claude/skills symlinks
  - .opencode/commands -> .claude/commands symlinks (when commands exist)
  - check-ai-tooling-sync verification

Manual (once per machine, not scripted):
  - Neon MCP: OAuth via https://mcp.neon.tech/mcp (or NEON_API_KEY for API-key mode)
  - uv tool install markitdown-mcp  (or ensure markitdown-mcp on PATH)

Re-run anytime: bun run setup:ai-tooling
Drift check:      bun run check:ai-tooling-sync
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)"
      exit 1
      ;;
  esac
done

info() { printf '→ %s\n' "$*"; }
ok() { printf '✓ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }

link_relative() {
  local link="$1" target="$2"
  local dir
  dir="$(dirname "$link")"
  mkdir -p "$dir"

  if [[ -L "$link" ]]; then
    if [[ "$(readlink "$link")" == "$target" ]]; then
      return 0
    fi
    rm "$link"
  elif [[ -e "$link" ]]; then
    echo "ERROR: $link exists and is not a symlink — remove manually"
    exit 1
  fi
  ln -s "$target" "$link"
  ok "Linked $link -> $target"
}

# --- 1. MCP symlink ---------------------------------------------------------

info "MCP config"
if [[ ! -f .mcp.json ]]; then
  echo "ERROR: .mcp.json missing at repo root"
  exit 1
fi
link_relative ".cursor/mcp.json" "../.mcp.json"

# --- 2. Team skills (.agent/skills -> both tool folders) --------------------

info "Team skills (.agent/skills symlinks)"
if [[ ! -d .agent/skills ]]; then
  echo "ERROR: .agent/skills missing — incomplete checkout?"
  exit 1
fi

for skill_dir in .agent/skills/*/; do
  [[ -d "$skill_dir" ]] || continue
  name="$(basename "$skill_dir")"
  for side in cursor claude; do
    link=".${side}/skills/${name}"
    if [[ ! -L "$link" ]] || [[ ! -d "$link" ]]; then
      link_relative "$link" "../../.agent/skills/${name}"
    fi
  done
done
ok "Team skill symlinks verified"

# --- 3. OpenCode commands (-> .claude/commands) -----------------------------

info "OpenCode command symlinks"
mkdir -p .opencode/commands
if [[ -d .claude/commands ]]; then
  for cmd in .claude/commands/*.md; do
    [[ -e "$cmd" ]] || continue
    name="$(basename "$cmd")"
    link_relative ".opencode/commands/${name}" "../../.claude/commands/${name}"
  done
  ok "OpenCode command symlinks verified"
else
  warn ".claude/commands/ not present yet — skip command symlinks"
fi

# --- 4. Optional external tools (warn only) ---------------------------------

info "Optional external tools"
if command -v markitdown-mcp >/dev/null 2>&1; then
  ok "markitdown-mcp on PATH ($(command -v markitdown-mcp))"
else
  warn "markitdown-mcp not on PATH — install: uv tool install markitdown-mcp"
fi

# --- 5. Verify parity -------------------------------------------------------

info "Running check-ai-tooling-sync"
bash "$ROOT/scripts/dev/check-ai-tooling-sync.sh"

cat <<'EOF'

AI tooling setup complete.

Committed in repo:
  • Rules:     .cursor/rules/*.mdc + CLAUDE.md (+ opencode.json instructions)
  • Skills:    .agent/skills/ (symlinked to .cursor/skills + .claude/skills)
  • Hooks:     .cursor/hooks.json + .claude/settings.json
  • MCP:       .mcp.json (Cursor via .cursor/mcp.json symlink)

Re-run anytime: bun run setup:ai-tooling
Drift check:      bun run check:ai-tooling-sync
EOF
