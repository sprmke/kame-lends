#!/usr/bin/env bash
# preToolUse hook: deny editing existing shipped migrations under db/migrations/.
# Creating a new migration file is allowed.

set -e
input=$(cat)
if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.tool_input.path // .tool_input.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"path":"[^"]*"' | head -1 | sed 's/"path":"//;s/"$//')
fi

if [[ -f "$file_path" ]] &&
  [[ "$file_path" == *"/db/migrations/"* || "$file_path" == db/migrations/* ]]; then
  reason="Editing a shipped migration under db/migrations/ is not allowed — add a new migration file instead."
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg reason "$reason" '{permission: "deny", user_message: $reason, agent_message: $reason}'
  else
    printf '{"permission":"deny","user_message":"%s","agent_message":"%s"}' "$reason" "$reason"
  fi
else
  echo '{"permission":"allow"}'
fi
