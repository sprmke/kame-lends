#!/usr/bin/env bash
# Link workspace investor contacts to the matching auth user (investor_user_id).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

load_env_var() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 1
  local line
  line="$(grep -E "^${key}=" "$file" | head -1 || true)"
  [[ -n "$line" ]] || return 1
  printf '%s' "${line#*=}" | tr -d '"'
}

USE_PROD=0
PASSTHROUGH=()
for arg in "$@"; do
  case "$arg" in
    --use-prod)
      USE_PROD=1
      ;;
    *)
      PASSTHROUGH+=("$arg")
      ;;
  esac
done

if [[ "$USE_PROD" -eq 1 ]]; then
  DATABASE_URL="$(load_env_var DATABASE_URL_PROD .env.local || true)"
  [[ -n "${DATABASE_URL:-}" ]] || {
    echo "ERROR: --use-prod requires DATABASE_URL_PROD in .env.local" >&2
    exit 1
  }
  export DATABASE_URL
  echo "Using DATABASE_URL_PROD (Neon)."
elif [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(load_env_var DATABASE_URL .env.local || true)"
  export DATABASE_URL
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set (.env.local or env)." >&2
  exit 1
fi

if [[ "$DATABASE_URL" == *"127.0.0.1"* || "$DATABASE_URL" == *"localhost"* ]]; then
  echo "Target: local Postgres ($DATABASE_URL)"
fi

exec bun scripts/db/backfill-investor-user-links.ts "${PASSTHROUGH[@]}"
