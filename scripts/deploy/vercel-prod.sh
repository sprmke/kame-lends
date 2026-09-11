#!/usr/bin/env bash
# Deploy production via Vercel CLI (used by GitHub Actions CD).
# Requires: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

echo "→ vercel pull (production)"
npx --yes vercel@41 pull --yes --environment=production --token "$VERCEL_TOKEN"

echo "→ vercel build (production)"
npx --yes vercel@41 build --prod --token "$VERCEL_TOKEN"

echo "→ vercel deploy --prebuilt --prod"
npx --yes vercel@41 deploy --prebuilt --prod --token "$VERCEL_TOKEN"

echo "✓ Production deploy complete."
