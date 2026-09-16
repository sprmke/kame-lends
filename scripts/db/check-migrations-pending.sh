#!/usr/bin/env bash
# Exit 1 when db/migrations/*.sql has files not recorded in schema_migrations,
# or when required app columns are missing. Used by CD after migrate and locally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/db/resolve-database-url.sh
source "$ROOT/scripts/db/resolve-database-url.sh"

TARGET="app"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod|--target=prod) TARGET="prod"; shift ;;
    --vercel|--target=vercel) TARGET="vercel"; shift ;;
    --app|--target=app) TARGET="app"; shift ;;
    *)
      echo "Unexpected argument: $1" >&2
      echo "Usage: bun run db:migrate:check [--prod|--vercel]" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${DATABASE_URL:-}" && "$TARGET" == "app" ]]; then
  RESOLVED_DATABASE_URL="$DATABASE_URL"
  RESOLVED_DATABASE_LABEL="$(db_url_host_label "$DATABASE_URL")"
else
  resolve_database_url "$TARGET"
fi

export DATABASE_URL="$RESOLVED_DATABASE_URL"

echo "Migration check: $RESOLVED_DATABASE_LABEL"

query_psql() {
  local sql="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "$sql"
  elif command -v docker >/dev/null 2>&1; then
    printf '%s\n' "$sql" | docker run --rm -i -e DATABASE_URL postgres:17 \
      sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -f -'
  else
    echo "psql is not installed." >&2
    exit 1
  fi
}

PENDING=0
for path in db/migrations/*.sql; do
  [[ -f "$path" ]] || continue
  file="$(basename "$path")"
  exists="$(query_psql "SELECT 1 FROM schema_migrations WHERE filename = '${file//\'/\'\'}' LIMIT 1;" | tr -d '[:space:]')"
  if [[ "$exists" != "1" ]]; then
    echo "  pending: $file"
    PENDING=$((PENDING + 1))
  fi
done

MISSING=0
for spec in "loan_investors:profit_type" "loan_investors:profit_value"; do
  table="${spec%%:*}"
  column="${spec##*:}"
  has="$(query_psql "
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${table}'
        AND column_name = '${column}'
    ) THEN '1' ELSE '0' END;
  " | tr -d '[:space:]')"
  if [[ "$has" != "1" ]]; then
    echo "  missing column: ${table}.${column}"
    MISSING=$((MISSING + 1))
  fi
done

if [[ "$PENDING" -gt 0 || "$MISSING" -gt 0 ]]; then
  echo "Migration check failed ($PENDING pending file(s), $MISSING missing column(s))."
  exit 1
fi

echo "Migration check OK."
