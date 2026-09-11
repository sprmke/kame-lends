#!/usr/bin/env bash
# beforeShellExecution hook: allow/deny shell commands.
# Reads JSON with "command" from stdin; outputs JSON with permission fields.

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/dev/prod-deploy-guard-lib.sh
source "$ROOT/scripts/dev/prod-deploy-guard-lib.sh"

input=$(cat)
if command -v jq >/dev/null 2>&1; then
  command_str=$(echo "$input" | jq -r '.command // empty')
else
  command_str=$(echo "$input" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"$//' | sed 's/\\"/"/g')
fi

permission="allow"
user_message=""
agent_message=""

if shell_guard_is_blocked "$command_str"; then
  permission="deny"
  user_message="Blocked: destructive shell command (system delete or Neon project/branch delete)."
  agent_message=$(shell_guard_block_reason)
elif shell_guard_needs_ask "$command_str"; then
  permission="ask"
  user_message="Confirm before running this potentially destructive command."
  agent_message=$(shell_guard_ask_reason)
fi

if command -v jq >/dev/null 2>&1; then
  jq -n \
    --arg permission "$permission" \
    --arg user_message "$user_message" \
    --arg agent_message "$agent_message" \
    '{permission: $permission, user_message: $user_message, agent_message: $agent_message}'
else
  echo "{\"permission\": \"$permission\", \"user_message\": \"$user_message\", \"agent_message\": \"$agent_message\"}"
fi
