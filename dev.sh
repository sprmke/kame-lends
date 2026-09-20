#!/usr/bin/env bash
# Local dev: Docker Postgres (:5433) + Vite (:3200).
#
# Usage:
#   ./dev.sh              Full local stack (default). Starts Docker Postgres,
#                         bootstraps schema if empty, applies pending SQL, then Vite.
#                         Exports DATABASE_URL to 127.0.0.1:5433 for this process.
#   ./dev.sh --ui-only    Vite only. Uses DATABASE_URL from .env.local (Neon or Docker).
#   SKIP_DOCKER=1 ./dev.sh
#                         Same as --ui-only
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:${HOME}/.bun/bin:${PATH}"

LOCAL_DATABASE_URL='postgresql://kame_lends:kame_lends@127.0.0.1:5433/kame_lends'

UI_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --ui-only) UI_ONLY=1 ;;
    -h | --help)
      cat <<'EOF'
Usage:
  ./dev.sh              Docker Postgres :5433 + schema bootstrap + Vite :3200
  ./dev.sh --ui-only    Vite only (DATABASE_URL from .env.local)
EOF
      exit 0
      ;;
  esac
done

if [[ "${SKIP_DOCKER:-}" == "1" ]]; then
  UI_ONLY=1
fi

ensure_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  echo "Docker daemon is not running."
  if [[ "$(uname -s)" == "Darwin" ]] && [[ -d /Applications/Docker.app ]]; then
    echo "Starting Docker Desktop…"
    open -a Docker
    for _ in $(seq 1 60); do
      if docker info >/dev/null 2>&1; then
        echo "Docker is ready."
        return 0
      fi
      sleep 2
    done
  fi
  echo "Cannot connect to Docker. Start Docker Desktop, then re-run ./dev.sh" >&2
  echo "Or run Vite against hosted Neon: ./dev.sh --ui-only" >&2
  exit 1
}

wait_for_postgres() {
  echo "Waiting for Postgres on 127.0.0.1:5433…"
  for _ in $(seq 1 60); do
    if docker compose exec -T db pg_isready -U kame_lends -d kame_lends >/dev/null 2>&1; then
      echo "Postgres is ready."
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready on 127.0.0.1:5433." >&2
  exit 1
}

session_table_exists() {
  local rel
  rel="$(
    docker compose exec -T db psql -U kame_lends -d kame_lends -At -c \
      "SELECT COALESCE(to_regclass('public.session')::text, '')"
  )"
  [[ -n "${rel//[[:space:]]/}" ]]
}

if [[ "$UI_ONLY" == "1" ]]; then
  echo "Vite only (no Docker). DATABASE_URL comes from .env.local."
  echo "Starting http://localhost:3200 …"
  exec bun run dev
fi

ensure_docker

echo "Starting local Postgres (Docker :5433)…"
docker compose up -d
wait_for_postgres

if ! session_table_exists; then
  echo "Empty local DB (no Auth.js session table). Pushing schema.ts…"
  bun run db:local:push
fi

echo "Applying pending db/migrations/*.sql to local Postgres…"
DATABASE_URL="$LOCAL_DATABASE_URL" bun run db:migrate:pending --yes

export DATABASE_URL="$LOCAL_DATABASE_URL"
echo "DATABASE_URL for this process: 127.0.0.1:5433 (does not change .env.local)"
echo "Starting http://localhost:3200 …"
exec bun run dev
