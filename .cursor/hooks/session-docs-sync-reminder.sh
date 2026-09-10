#!/usr/bin/env bash
# SessionStart: remind agents that docs must update in the same change as code.
set -uo pipefail

MSG='DOCS SYNC (mandatory): Material code/behavior changes must update matching docs in the SAME change. Route/page UX in src/ -> docs/guides/routes/* (route-guides skill). API/env/architecture -> docs/PROJECT.md. Canonical: .cursor/rules/documentation-maintenance.mdc · CLAUDE.md.'

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

escaped=$(escape_for_json "$MSG")
printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
