#!/usr/bin/env bash
# Drift prevention: .agent/skills must symlink to .cursor/skills and .claude/skills.
# Also verifies .cursor/mcp.json -> .mcp.json.
#
# Exit 1 on any violation.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

VIOLATIONS=0

fail() {
  echo "VIOLATION: $1"
  VIOLATIONS=$((VIOLATIONS + 1))
}

# --- 1. .agent/skills/<name> must have valid symlinks on both sides ---------

if [[ ! -d .agent/skills ]]; then
  fail ".agent/skills/ directory missing"
else
  for skill_dir in .agent/skills/*/; do
    [[ -d "$skill_dir" ]] || continue
    name="$(basename "$skill_dir")"
    target_real="$(cd "$skill_dir" && pwd -P)"

    for side in cursor claude; do
      link=".${side}/skills/${name}"
      if [[ ! -L "$link" ]]; then
        fail "$link is missing or not a symlink (expected -> ../../.agent/skills/${name})"
        continue
      fi
      if [[ ! -d "$link" ]]; then
        fail "$link is a dangling symlink"
        continue
      fi
      link_real="$(cd "$link" && pwd -P)"
      if [[ "$link_real" != "$target_real" ]]; then
        fail "$link resolves to $link_real, expected $target_real"
      fi
    done
  done
fi

# --- 2. .cursor/mcp.json must symlink to ../.mcp.json ---------------------

if [[ ! -f .mcp.json ]]; then
  fail ".mcp.json missing at repo root"
elif [[ ! -L .cursor/mcp.json ]]; then
  fail ".cursor/mcp.json is not a symlink (expected -> ../.mcp.json)"
else
  link_target="$(readlink .cursor/mcp.json)"
  resolved_real="$(cd .cursor && cd "$(dirname "$link_target")" 2>/dev/null && pwd -P)/$(basename "$link_target")"
  if [[ ! -f "$resolved_real" ]]; then
    fail ".cursor/mcp.json is a dangling symlink"
  elif [[ "$resolved_real" != "$ROOT/.mcp.json" ]]; then
    fail ".cursor/mcp.json symlink resolves to '${resolved_real}', expected '${ROOT}/.mcp.json'"
  fi
fi

# --- Result ------------------------------------------------------------------

if [[ "$VIOLATIONS" -gt 0 ]]; then
  echo ""
  echo "$VIOLATIONS AI tooling sync violation(s). Run: bun run setup:ai-tooling"
  exit 1
fi

echo "OK — .agent/skills symlinks and MCP config are in sync."
