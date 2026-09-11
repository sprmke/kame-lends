#!/usr/bin/env bash
# Apply all pending hand-maintained SQL files under db/migrations/ in filename order.
# Tracks applied files in public.schema_migrations (created automatically).
#
# Usage:
#   bun run db:migrate:pending              # DATABASE_URL from .env.local
#   bun run db:migrate:pending --yes        # non-interactive (CI)
#   bun run db:migrate:pending --prod --yes
#   bun run db:migrate:pending --vercel --yes
#   DATABASE_URL='postgresql://…' bun run db:migrate:pending --yes
#
# Bootstrap: if schema_migrations is empty but the DB already looks current
# (loans.profit_type exists), record every migration file present on disk as
# applied without re-running older patches. Fresh databases run every file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/db/resolve-database-url.sh
source "$ROOT/scripts/db/resolve-database-url.sh"

TARGET="app"
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod|--target=prod) TARGET="prod"; shift ;;
    --vercel|--target=vercel) TARGET="vercel"; shift ;;
    --app|--target=app) TARGET="app"; shift ;;
    --yes|-y) YES=1; shift ;;
    --)
      shift
      break
      ;;
    *)
      echo "Unexpected argument: $1" >&2
      echo "Usage: bun run db:migrate:pending [--prod|--vercel] [--yes]" >&2
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

echo "Target: $RESOLVED_DATABASE_LABEL"
echo "Mode: apply pending db/migrations/*.sql"

if [[ "$DATABASE_URL" == *"neon.tech"* && "$YES" -ne 1 ]]; then
  echo "Review pending migrations, then confirm."
  read -r -p "Apply pending migrations to this Neon database? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

run_psql() {
  local sql="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$sql"
  elif [[ "$DATABASE_URL" == *"127.0.0.1:5433"* || "$DATABASE_URL" == *"localhost:5433"* ]]; then
    if ! docker compose ps --status running db 2>/dev/null | grep -q 'db'; then
      echo "Local Postgres is not running. Start it with: bun run db:local:start" >&2
      exit 1
    fi
    docker compose exec -T db psql -U kame_lends -d kame_lends -v ON_ERROR_STOP=1 -c "$sql"
  elif command -v docker >/dev/null 2>&1; then
    printf '%s\n' "$sql" | docker run --rm -i -e DATABASE_URL postgres:17 \
      sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -'
  else
    echo "psql is not installed and Docker is unavailable." >&2
    exit 1
  fi
}

run_psql_file() {
  local file="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  elif [[ "$DATABASE_URL" == *"127.0.0.1:5433"* || "$DATABASE_URL" == *"localhost:5433"* ]]; then
    docker compose exec -T db psql -U kame_lends -d kame_lends -v ON_ERROR_STOP=1 -f - <"$file"
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm -i -e DATABASE_URL postgres:17 \
      sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -' <"$file"
  else
    echo "psql is not installed and Docker is unavailable." >&2
    exit 1
  fi
}

query_psql() {
  local sql="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "$sql"
  elif [[ "$DATABASE_URL" == *"127.0.0.1:5433"* || "$DATABASE_URL" == *"localhost:5433"* ]]; then
    docker compose exec -T db psql -U kame_lends -d kame_lends -v ON_ERROR_STOP=1 -At -c "$sql"
  elif command -v docker >/dev/null 2>&1; then
    printf '%s\n' "$sql" | docker run --rm -i -e DATABASE_URL postgres:17 \
      sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -f -'
  else
    echo "psql is not installed and Docker is unavailable." >&2
    exit 1
  fi
}

file_checksum() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    sha256sum "$file" | awk '{print $1}'
  fi
}

run_psql "$(cat <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text
);
SQL
)"

PENDING=0
FILE_COUNT=0
for path in db/migrations/*.sql; do
  [[ -f "$path" ]] || continue
  FILE_COUNT=$((FILE_COUNT + 1))
done

if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "No migration files found."
  exit 0
fi

APPLIED_COUNT="$(query_psql "SELECT count(*) FROM schema_migrations;" | tr -d '[:space:]')"
if [[ "$APPLIED_COUNT" == "0" ]]; then
  HAS_CURRENT="$(query_psql "
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'loans'
        AND column_name = 'profit_type'
    ) THEN '1' ELSE '0' END;
  " | tr -d '[:space:]')"

  if [[ "$HAS_CURRENT" == "1" ]]; then
    echo "Empty migration journal on a current schema — bootstrapping applied history."
    for path in db/migrations/*.sql; do
      [[ -f "$path" ]] || continue
      file="$(basename "$path")"
      checksum="$(file_checksum "$path")"
      run_psql "INSERT INTO schema_migrations (filename, checksum) VALUES ('${file//\'/\'\'}', '${checksum}') ON CONFLICT (filename) DO NOTHING;"
      echo "  recorded $file"
    done
    echo "Bootstrap complete. Future pushes will apply only new files."
    exit 0
  fi
fi

for path in db/migrations/*.sql; do
  [[ -f "$path" ]] || continue
  file="$(basename "$path")"
  exists="$(query_psql "SELECT 1 FROM schema_migrations WHERE filename = '${file//\'/\'\'}' LIMIT 1;" | tr -d '[:space:]')"
  if [[ "$exists" == "1" ]]; then
    continue
  fi

  PENDING=$((PENDING + 1))
  echo "→ Applying $file"
  run_psql_file "$path"
  checksum="$(file_checksum "$path")"
  run_psql "INSERT INTO schema_migrations (filename, checksum) VALUES ('${file//\'/\'\'}', '${checksum}');"
  echo "✓ Applied $file"
done

if [[ "$PENDING" -eq 0 ]]; then
  echo "No pending migrations."
else
  echo "Done. Applied $PENDING migration(s)."
fi
