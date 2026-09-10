#!/usr/bin/env bash
# afterFileEdit hook: format the edited file when Prettier is available.
set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

format_with_prettier() {
  local target="$1"
  if command -v bunx >/dev/null 2>&1; then
    bunx --bun prettier --write "$target" >/dev/null 2>&1 && return 0
  fi
  if command -v npx >/dev/null 2>&1; then
    npx --no-install prettier --write "$target" >/dev/null 2>&1 && return 0
  fi
  return 1
}

if [[ -n "$file_path" && -f "$file_path" ]]; then
  case "$file_path" in
    *.ts|*.tsx|*.js|*.jsx|*.svelte|*.json|*.md|*.mdc|*.css|*.html)
      format_with_prettier "$file_path" || true
      ;;
  esac
fi

echo '{}'
