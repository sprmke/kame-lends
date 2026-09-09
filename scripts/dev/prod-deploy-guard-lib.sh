#!/usr/bin/env bash
# Shared prod-deploy guard for Cursor + Claude Code shell hooks.
# Source this file; do not execute directly.
#
# Unlock word: lendwave — user must include it in the same chat message and command string.

PROD_DEPLOY_UNLOCK_WORD="lendwave"

prod_deploy_is_unlocked() {
  local cmd="$1"
  local lower_cmd
  lower_cmd=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')
  [[ "$lower_cmd" == *"${PROD_DEPLOY_UNLOCK_WORD}"* ]]
}

# Returns 0 when the command should be blocked as a production mutation.
prod_deploy_is_blocked() {
  local cmd="$1"

  if prod_deploy_is_unlocked "$cmd"; then
    return 1
  fi

  # Safe without unlock — checked first so substrings do not false-positive.
  case "$cmd" in
    *backup:neon*|*backup-neon.sh*|*backup:neon:branches*|*create-neon-branches.sh*)
      return 1
      ;;
    *"drizzle-kit migrate"*|*"db:migrate"*)
      return 1
      ;;
    *"drizzle-kit studio"*|*"db:studio"*)
      return 1
      ;;
    *"drizzle-kit generate"*|*"db:generate"*)
      return 1
      ;;
    *"vite dev"*|*"bun run dev"*|*"svelte-kit sync"*)
      return 1
      ;;
    *"pg_dump"*)
      return 1
      ;;
    *neonctl*branches\ list*|*neonctl*projects\ list*)
      return 1
      ;;
  esac

  case "$cmd" in
    *"vercel --prod"*|*"vercel deploy --prod"*|*"vercel deploy -p"*)
      return 0
      ;;
    *"vercel deploy"*)
      # Non-prod preview deploys are OK; prod requires --prod (blocked above).
      [[ "$cmd" == *"--prod"* ]] && return 0
      return 1
      ;;
    *"db:push"*|*"drizzle-kit push"*)
      # Local-only push is safe when explicitly scoped to localhost.
      if [[ "$cmd" == *"127.0.0.1"* || "$cmd" == *"localhost"* ]]; then
        return 1
      fi
      # Block push without an explicit local/dev target (prod-shaped DATABASE_URL).
      if [[ "$cmd" == *"neon.tech"* || "$cmd" == *"DATABASE_URL"* ]]; then
        return 0
      fi
      # Bare drizzle-kit push / db:push against unknown target — block.
      return 0
      ;;
    *neonctl*branches\ delete*|*neonctl*branches\ reset*|*neonctl*projects\ delete*)
      return 0
      ;;
    *"DROP DATABASE"*|*"drop database"*)
      return 0
      ;;
    *"--db-url"*)
      [[ "$cmd" == *"127.0.0.1"* || "$cmd" == *"localhost"* ]] && return 1
      [[ "$cmd" == *"neon.tech"* ]] && return 0
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

prod_deploy_block_reason() {
  cat <<EOF
Blocked: this command can change production Neon data or deploy to Vercel production.

Development uses the dev Neon branch and preview deploys. Do not push schema, run destructive Neon commands, or deploy to prod until the team explicitly approves.

To authorize for this shell command only, the user must say the unlock word "${PROD_DEPLOY_UNLOCK_WORD}" in chat, then rerun with that word present in the command (e.g. LENDWAVE=${PROD_DEPLOY_UNLOCK_WORD} vercel --prod).

Safe without unlock: local dev (vite/svelte-kit), drizzle-kit generate/migrate/studio, backup:neon, pg_dump, neonctl branches list, read-only inspection.
EOF
}
