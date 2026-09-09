#!/usr/bin/env bash
# Apply schema.ts to the Docker Postgres on 127.0.0.1:5433 only. Never reads Neon from .env.local.
set -euo pipefail

LOCAL_URL='postgresql://kame_lends:kame_lends@127.0.0.1:5433/kame_lends'
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$ROOT"

if ! docker compose ps --status running db 2>/dev/null | grep -q 'db'; then
	echo "Local Postgres is not running. Start it with: bun run db:local:start" >&2
	exit 1
fi

echo "Pushing schema to local Postgres (127.0.0.1:5433). Neon / prod is not touched."
DATABASE_URL="$LOCAL_URL" bun run drizzle-kit push
