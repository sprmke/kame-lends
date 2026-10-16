#!/usr/bin/env bash
# Deploy production via Vercel CLI (used by GitHub Actions CD).
# Requires: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

# The CLI reads the team before the project. This token can deploy the project
# and still gets 403 on the team, so pull/build/deploy never start.
node scripts/deploy/vercel-api-prod.mjs
