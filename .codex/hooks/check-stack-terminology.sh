#!/usr/bin/env bash
# afterFileEdit hook: warn when legacy Next.js/React/tRPC terms appear in src/ edits.
# Never blocks edits. Server-only PDF may import React.

set -e
input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.file_path // empty')
else
  file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')
fi

if [[ -n "$file_path" && -f "$file_path" ]]; then
  case "$file_path" in
    */src/lib/server/pdf/*|src/lib/server/pdf/*)
      ;;
    */src/*|src/*)
      if rg -i -q "next/router|next/navigation|next/image|next-auth|from 'react'|from \"react\"|@radix-ui|react-hook-form|recharts|zustand|trpc" "$file_path"; then
        echo "Warning: legacy Next.js/React term in $file_path. src/ uses SvelteKit 2 + Svelte 5 (see .cursor/rules/tech-stack.mdc). React is allowed only in src/lib/server/pdf/." >&2
      fi
      ;;
  esac
fi

echo '{}'
