#!/usr/bin/env bash
# Stop stale Kame Lends dev listeners for THIS worktree so strictPort can bind.
# Never kills a listener owned by another worktree.
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
  for pid in $pids; do
    cwd="$(lsof -a -p "$pid" -d cwd 2>/dev/null | awk 'NR==2 { print $NF; exit }')"
    if [[ -z "$cwd" || ( "$cwd" != "$ROOT" && "$cwd" != "$ROOT"/* ) ]]; then
      echo "free-local-ports: :${port} belongs to another cwd (${cwd:-unknown}); leaving it."
      continue
    fi
    echo "free-local-ports: stopping PID ${pid} on :${port} (this worktree)"
    kill "$pid" 2>/dev/null || true
    sleep 0.3
    remaining=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
    for rpid in $remaining; do
      rcwd="$(lsof -a -p "$rpid" -d cwd 2>/dev/null | awk 'NR==2 { print $NF; exit }')"
      if [[ -n "$rcwd" && ( "$rcwd" == "$ROOT" || "$rcwd" == "$ROOT"/* ) ]]; then
        kill -9 "$rpid" 2>/dev/null || true
      fi
    done
  done
done
