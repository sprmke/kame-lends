#!/usr/bin/env bash
# Capture anonymized payload / TTFB baselines. Do not point at production with cookies
# that would download PII into CI logs. Use a QA origin and a test session.
set -euo pipefail

BASE="${1:-http://localhost:3200}"

time_path() {
  local path="$1"
  local out
  out="$(curl -sS -o /tmp/kl-baseline-body -w "%{http_code} %{time_total} %{size_download}" "${BASE}${path}")"
  echo "${path} ${out}"
}

echo "Baseline against ${BASE} (no auth cookies; public routes only by default)"
time_path "/api/health"
time_path "/signin"
time_path "/api/pwa/version"
echo "For authenticated routes, pass a cookie file: curl -b cookies.txt ${BASE}/loans"
echo "Record p95 TTFB and body size in docs/workflow/planned/production-readiness-and-optimization.md P0-8."
