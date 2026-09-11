#!/usr/bin/env bash
# Apply one hand-maintained SQL file from db/migrations/ to DATABASE_URL.
# Usage: bun run db:apply:migration -- 0015_user_role_nullable.sql
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  echo "Usage: bun run db:apply:migration -- <filename.sql>" >&2
  exit 1
fi

PATH_FILE="db/migrations/$FILE"
if [[ ! -f "$PATH_FILE" ]]; then
  echo "Migration not found: $PATH_FILE" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" && -f .env.local ]]; then
  DATABASE_URL="$(
    node -e '
      const fs = require("fs");
      const dotenv = require("dotenv");
      const parsed = dotenv.parse(fs.readFileSync(".env.local"));
      const url = parsed.DATABASE_URL || "";
      process.stdout.write(url);
    '
  )"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Add it to .env.local or export it." >&2
  exit 1
fi

if [[ "$DATABASE_URL" == *"neon.tech"* ]]; then
  echo "Target looks like Neon hosted Postgres."
  echo "Review $PATH_FILE, back up first (bun run backup:neon), then confirm."
  read -r -p "Apply to this DATABASE_URL? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 1
  fi
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
else
  echo "psql is not installed and DATABASE_URL is not local Docker. Install psql or run the SQL in the Neon console." >&2
  exit 1
fi

echo "Done."
