#!/usr/bin/env bash
# Read-only Neon Postgres backup (custom format). Writes OUTSIDE the repo.
# Usage: bun run backup:neon   (loads .env.local for DATABASE_URL)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '"')"
  export DATABASE_URL
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Add it to .env.local or export it."
  exit 1
fi

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
