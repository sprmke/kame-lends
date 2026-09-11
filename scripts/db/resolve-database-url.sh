#!/usr/bin/env bash
# Resolve which Postgres URL CLI scripts should use.
# Usage (source only):
#   source scripts/db/resolve-database-url.sh
#   resolve_database_url "${1:-app}"   # app | prod | vercel
#
# Targets:
#   app    — DATABASE_URL from .env.local (local Docker by default)
#   prod   — DATABASE_URL_PROD (Singapore Kame Lends Neon QA)
#   vercel — DATABASE_URL_VERCEL (US East 1 Pawn Tracker; live Vercel prod until cutover)

load_env_var() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 1
  local line
  line="$(grep -E "^${key}=" "$file" | head -1 || true)"
  [[ -n "$line" ]] || return 1
  printf '%s' "${line#*=}" | tr -d '"'
}

is_local_db_url() {
  [[ "$1" == *"127.0.0.1"* || "$1" == *"localhost"* ]]
}

db_url_host_label() {
  local url="$1"
  if is_local_db_url "$url"; then
    echo "local Docker Postgres (127.0.0.1:5433)"
    return
  fi
  if [[ "$url" == *"ap-southeast-1"* ]]; then
    echo "Neon Singapore (DATABASE_URL_PROD / Kame Lends QA)"
    return
  fi
  if [[ "$url" == *"us-east-1"* ]]; then
    echo "Neon US East 1 (Vercel production / Pawn Tracker)"
    return
  fi
  if [[ "$url" == *"neon.tech"* ]]; then
    echo "Neon hosted Postgres"
    return
  fi
  echo "Postgres"
}

resolve_database_url() {
  local target="${1:-app}"
  local env_file="${ROOT:-.}/.env.local"
  local url=""

  if [[ -n "${DATABASE_URL:-}" ]]; then
    url="$DATABASE_URL"
  elif [[ -f "$env_file" ]]; then
    url="$(load_env_var DATABASE_URL "$env_file" || true)"
  fi

  case "$target" in
    prod)
      if [[ -f "$env_file" ]]; then
        url="$(load_env_var DATABASE_URL_PROD "$env_file" || true)"
      fi
      ;;
    vercel)
      if [[ -f "$env_file" ]]; then
        url="$(load_env_var DATABASE_URL_VERCEL "$env_file" || true)"
      fi
      if [[ -z "$url" && -n "${DATABASE_URL:-}" ]]; then
        url="$DATABASE_URL"
      fi
      ;;
    app)
      # When DATABASE_URL points at local Docker, keep it (explicit local target).
      ;;
    *)
      echo "Unknown target: $target (use app, prod, or vercel)" >&2
      return 1
      ;;
  esac

  if [[ -z "$url" ]]; then
    echo "No database URL resolved for target '$target'." >&2
    case "$target" in
      prod) echo "Set DATABASE_URL_PROD in .env.local." >&2 ;;
      vercel) echo "Set DATABASE_URL_VERCEL in .env.local (copy from Vercel production env)." >&2 ;;
      *) echo "Set DATABASE_URL in .env.local or export DATABASE_URL." >&2 ;;
    esac
    return 1
  fi

  RESOLVED_DATABASE_URL="$url"
  RESOLVED_DATABASE_LABEL="$(db_url_host_label "$url")"
}
