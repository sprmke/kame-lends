#!/usr/bin/env bash
# Apply one hand-maintained SQL file from db/migrations/.
#
# Usage:
#   bun run db:apply:migration -- 0017_loan_witnesses_profit_receipts.sql
#     → DATABASE_URL from .env.local (usually local Docker)
#   bun run db:apply:migration:prod -- 0017_loan_witnesses_profit_receipts.sql
#     → DATABASE_URL_PROD (Singapore Neon QA)
#   bun run db:apply:migration:vercel -- 0017_loan_witnesses_profit_receipts.sql
#     → DATABASE_URL_VERCEL (live Vercel prod, US East 1 until cutover)
#
# One-off override:
#   DATABASE_URL='postgresql://...@....neon.tech/...' bun run db:apply:migration -- 0017_....sql
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/db/resolve-database-url.sh
source "$ROOT/scripts/db/resolve-database-url.sh"

TARGET="app"
FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod|--target=prod)
      TARGET="prod"
      shift
      ;;
    --vercel|--target=vercel)
      TARGET="vercel"
      shift
      ;;
    --app|--target=app)
      TARGET="app"
      shift
      ;;
    --)
      shift
      FILE="${1:-}"
      break
      ;;
    *)
      if [[ -z "$FILE" ]]; then
        FILE="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$FILE" ]]; then
  echo "Usage: bun run db:apply:migration [--prod|--vercel] -- <filename.sql>" >&2
  exit 1
fi

PATH_FILE="db/migrations/$FILE"
if [[ ! -f "$PATH_FILE" ]]; then
  echo "Migration not found: $PATH_FILE" >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" && "$TARGET" == "app" ]]; then
  RESOLVED_DATABASE_URL="$DATABASE_URL"
  RESOLVED_DATABASE_LABEL="$(db_url_host_label "$DATABASE_URL")"
else
  resolve_database_url "$TARGET"
fi

export DATABASE_URL="$RESOLVED_DATABASE_URL"

echo "Target: $RESOLVED_DATABASE_LABEL"
echo "Migration: $PATH_FILE"

if [[ "$DATABASE_URL" == *"neon.tech"* ]]; then
  echo "Review the SQL file and confirm backup (bun run backup:neon or a Vercel-target dump)."
  read -r -p "Apply to this Neon database? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 1
  fi
elif is_local_db_url "$DATABASE_URL"; then
  echo "Applying to local Docker only. Live Vercel prod is unchanged."
fi

echo "Applying $PATH_FILE"

if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$PATH_FILE"
elif [[ "$DATABASE_URL" == *"127.0.0.1:5433"* || "$DATABASE_URL" == *"localhost:5433"* ]]; then
  if ! docker compose ps --status running db 2>/dev/null | grep -q 'db'; then
    echo "Local Postgres is not running. Start it with: bun run db:local:start" >&2
    exit 1
  fi
  docker compose exec -T db psql -U kame_lends -d kame_lends -v ON_ERROR_STOP=1 -f - <"$PATH_FILE"
elif command -v docker >/dev/null 2>&1; then
  echo "→ psql (docker postgres:17)"
  docker run --rm -i -e DATABASE_URL postgres:17 \
    sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -' <"$PATH_FILE"
else
  echo "psql is not installed and Docker is unavailable. Install psql or run the SQL in the Neon console." >&2
  exit 1
fi

# Record in schema_migrations so db:migrate:pending stays in sync.
RECORD_SQL="$(cat <<SQL
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text
);
INSERT INTO schema_migrations (filename, checksum)
VALUES ('${FILE//\'/\'\'}', '$(
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$PATH_FILE" | awk '{print $1}'; else sha256sum "$PATH_FILE" | awk '{print $1}'; fi
)')
ON CONFLICT (filename) DO UPDATE SET applied_at = now(), checksum = EXCLUDED.checksum;
SQL
)"

if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$RECORD_SQL" >/dev/null
elif [[ "$DATABASE_URL" == *"127.0.0.1:5433"* || "$DATABASE_URL" == *"localhost:5433"* ]]; then
  docker compose exec -T db psql -U kame_lends -d kame_lends -v ON_ERROR_STOP=1 -c "$RECORD_SQL" >/dev/null
elif command -v docker >/dev/null 2>&1; then
  printf '%s\n' "$RECORD_SQL" | docker run --rm -i -e DATABASE_URL postgres:17 \
    sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -' >/dev/null
fi

echo "Done."
