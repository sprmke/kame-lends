#!/usr/bin/env bash
# Read-only Neon Postgres backup (custom format). Writes OUTSIDE the repo.
# Usage:
#   bun run backup:neon
#     Uses DATABASE_URL_PROD from .env.local (or DATABASE_URL when it points at Neon).
#   DATABASE_URL='postgresql://...@....neon.tech/...' bun run backup:neon
#     One-off backup (e.g. legacy Pawn Tracker us-east-1 before project delete).
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

is_local_db_url() {
  [[ "$1" == *"127.0.0.1"* || "$1" == *"localhost"* ]]
}

is_neon_db_url() {
  [[ "$1" == *"neon.tech"* ]]
}

if [[ -z "${DATABASE_URL:-}" && -f .env.local ]]; then
  DATABASE_URL="$(load_env_var DATABASE_URL .env.local || true)"
fi

if [[ -n "${DATABASE_URL:-}" ]] && is_local_db_url "$DATABASE_URL" && [[ -f .env.local ]]; then
  PROD_URL="$(load_env_var DATABASE_URL_PROD .env.local || true)"
  if [[ -n "${PROD_URL:-}" ]]; then
    echo "→ Using DATABASE_URL_PROD from .env.local (DATABASE_URL is local Docker)."
    DATABASE_URL="$PROD_URL"
  fi
fi

if [[ -z "${DATABASE_URL:-}" && -f .env.local ]]; then
  DATABASE_URL="$(load_env_var DATABASE_URL_PROD .env.local || true)"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: Set DATABASE_URL_PROD in .env.local or export a Neon DATABASE_URL."
  exit 1
fi

if ! is_neon_db_url "$DATABASE_URL"; then
  echo "ERROR: backup:neon expects a Neon URL (*.neon.tech). Got a non-Neon host."
  exit 1
fi

export DATABASE_URL

BACKUP_ROOT="${KAME_LENDS_BACKUP_DIR:-$HOME/Backups/kame-lends}"
mkdir -p "$BACKUP_ROOT"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_ROOT/kame-lends-neon-${STAMP}.dump"

run_pg_dump() {
  pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$OUT"
}

if command -v pg_dump >/dev/null 2>&1; then
  echo "→ pg_dump (local) → $OUT"
  run_pg_dump
elif command -v docker >/dev/null 2>&1; then
  echo "→ pg_dump (docker postgres:17) → $OUT"
  docker run --rm \
    -e DATABASE_URL \
    -v "$BACKUP_ROOT:/backup" \
    postgres:17 \
    pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="/backup/$(basename "$OUT")"
else
  echo "ERROR: Install PostgreSQL client tools or Docker to run pg_dump."
  exit 1
fi

echo "✓ Backup saved: $OUT"
echo "  Restore (dev only): pg_restore --clean --if-exists --no-owner --dbname=\$TARGET_URL $OUT"
