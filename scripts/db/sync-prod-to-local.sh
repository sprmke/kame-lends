#!/usr/bin/env bash
# Pull Neon production data into local Docker Postgres (127.0.0.1:5433).
# READ-ONLY against the source. Writes only to local Postgres.
#
# Usage:
#   bun run db:local:sync-prod              # pg_dump from DATABASE_URL_PROD
#   bun run db:local:sync-prod --from-dump    # restore latest ~/Backups/kame-lends/*.dump
#   bun run db:local:sync-prod --from-dump /path/to/file.dump
#
# Dumps DATABASE_URL_PROD (Neon) read-only, restores into 127.0.0.1:5433 only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOCAL_URL='postgresql://kame_lends:kame_lends@127.0.0.1:5433/kame_lends'
LOCAL_DOCKER_URL='postgresql://kame_lends:kame_lends@host.docker.internal:5433/kame_lends'
BACKUP_ROOT="${KAME_LENDS_BACKUP_DIR:-$HOME/Backups/kame-lends}"

warn() { echo "WARN: $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 1; }

load_env_var() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 1
  local line
  line="$(grep -E "^${key}=" "$file" | head -1 || true)"
  [[ -n "$line" ]] || return 1
  printf '%s' "${line#*=}" | tr -d '"'
}

assert_local_target() {
  local url="$1"
  [[ "$url" == *"127.0.0.1"* || "$url" == *"localhost"* ]] || die "Refusing to restore: target is not local Postgres ($url)"
  [[ "$url" != *"neon.tech"* ]] || die "Refusing to restore: target looks like Neon"
}

assert_neon_source() {
  local url="$1"
  [[ "$url" == *"neon.tech"* ]] || die "Refusing to dump: DATABASE_URL_PROD must be a Neon URL"
  [[ "$url" != *"127.0.0.1"* && "$url" != *"localhost"* ]] || die "Refusing to dump: source must not be local"
}

run_pg_dump() {
  local source_url="$1"
  local out_file="$2"
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$source_url" --format=custom --no-owner --no-acl --file="$out_file"
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm \
      -e "DATABASE_URL=$source_url" \
      -v "$(dirname "$out_file"):/backup" \
      postgres:17 \
      pg_dump "$source_url" --format=custom --no-owner --no-acl --file="/backup/$(basename "$out_file")"
  else
    die "Install PostgreSQL client tools or Docker to run pg_dump."
  fi
}

run_psql() {
  local sql="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -c "$sql"
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm postgres:17 psql "$LOCAL_DOCKER_URL" -v ON_ERROR_STOP=1 -c "$sql"
  else
    die "Install PostgreSQL client tools or Docker to run psql."
  fi
}

wipe_local_schema() {
  echo "→ Wiping local schema (127.0.0.1:5433 only)..."
  run_psql "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO kame_lends; GRANT ALL ON SCHEMA public TO public;"
}

run_pg_restore() {
  local dump_file="$1"
  if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --no-owner --no-acl --dbname="$LOCAL_URL" "$dump_file"
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm \
      -v "$(dirname "$dump_file"):/backup:ro" \
      postgres:17 \
      pg_restore --no-owner --no-acl \
      --dbname="$LOCAL_DOCKER_URL" "/backup/$(basename "$dump_file")"
  else
    die "Install PostgreSQL client tools or Docker to run pg_restore."
  fi
}

ensure_local_db() {
  if ! docker compose ps --status running db 2>/dev/null | grep -q 'db'; then
    echo "Starting local Postgres (docker compose)..."
    docker compose up -d
    sleep 2
  fi
}

print_counts() {
  if command -v docker >/dev/null 2>&1; then
    docker run --rm postgres:17 psql "$LOCAL_DOCKER_URL" -At -c \
      "SELECT 'loans=' || count(*)::text FROM loans UNION ALL SELECT 'investors=' || count(*)::text FROM investors UNION ALL SELECT 'users=' || count(*)::text FROM \"user\";" \
      2>/dev/null || true
  fi
}

FROM_DUMP=""
DUMP_PATH=""
for arg in "$@"; do
  case "$arg" in
    --from-dump) FROM_DUMP=1 ;;
    --help|-h)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      if [[ -f "$arg" ]]; then
        DUMP_PATH="$arg"
        FROM_DUMP=1
      fi
      ;;
  esac
done

assert_local_target "$LOCAL_URL"
ensure_local_db

if [[ -n "$FROM_DUMP" ]]; then
  if [[ -z "$DUMP_PATH" ]]; then
    DUMP_PATH="$(ls -t "$BACKUP_ROOT"/kame-lends-neon-*.dump 2>/dev/null | head -1 || true)"
    [[ -n "$DUMP_PATH" ]] || die "No dump found under $BACKUP_ROOT. Run: bun run backup:neon or pass a .dump path."
  fi
  [[ -f "$DUMP_PATH" ]] || die "Dump file not found: $DUMP_PATH"
  echo "→ Restoring local Postgres from dump (read-only source file):"
  echo "  $DUMP_PATH"
  echo "  Target: $LOCAL_URL"
  wipe_local_schema
  run_pg_restore "$DUMP_PATH"
else
  SOURCE_URL="$(load_env_var DATABASE_URL_PROD .env.local || true)"
  [[ -n "${SOURCE_URL:-}" ]] || die "Set DATABASE_URL_PROD in .env.local to the Neon connection string."
  assert_neon_source "$SOURCE_URL"

  mkdir -p "$BACKUP_ROOT"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  DUMP_PATH="$BACKUP_ROOT/kame-lends-neon-${STAMP}.dump"

  echo "→ pg_dump from Neon prod (read-only) → $DUMP_PATH"
  if ! run_pg_dump "$SOURCE_URL" "$DUMP_PATH"; then
    die "pg_dump failed. If Neon reports a data-transfer quota error, restore the latest backup instead: bun run db:local:sync-prod --from-dump"
  fi
  echo "→ Restoring into local Postgres: $LOCAL_URL"
  wipe_local_schema
  run_pg_restore "$DUMP_PATH"
fi

echo "→ Applying schema drift (drizzle push to local only)..."
bash "$ROOT/scripts/db/local-db-push.sh"

echo "✓ Local Postgres now mirrors the restored snapshot."
print_counts | while read -r line; do [[ -n "$line" ]] && echo "  $line"; done
echo ""
echo "To use the local copy, set DATABASE_URL to DATABASE_URL_LOCAL and restart bun dev."
echo "Neon was not modified (dump is read-only; restore targets local only)."
