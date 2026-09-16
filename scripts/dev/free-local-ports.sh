#!/usr/bin/env bash
# Stop stale Kame Lends dev listeners so strictPort can bind.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

read -r DEV_PORT E2E_PORT < <(
  node --input-type=module -e "
    import { LOCAL_DEV_PORT, E2E_DEV_PORT } from './scripts/dev/local-dev-port.mjs';
    console.log(LOCAL_DEV_PORT, E2E_DEV_PORT);
  "
)
PORTS=("$DEV_PORT" "$E2E_PORT")

for port in "${PORTS[@]}"; do
  pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -z "$pids" ]]; then
    continue
  fi
  echo "free-local-ports: stopping PID(s) on :${port} — ${pids//$'\n'/ }"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 0.3
  remaining=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$remaining" ]]; then
    # shellcheck disable=SC2086
    kill -9 $remaining 2>/dev/null || true
  fi
done
