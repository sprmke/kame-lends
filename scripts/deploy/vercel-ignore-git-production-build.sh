#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand).
# Skip Git-triggered Production builds on main so GitHub Actions CD owns releases
# (quality → migrate → vercel deploy --prebuilt). Preview builds still run.
set -euo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"
env_name="${VERCEL_ENV:-}"

if [[ "$env_name" == "production" && "$ref" == "main" ]]; then
  echo "Skip Git production build on main. Releases: GitHub Actions workflow CD."
  exit 1
fi

echo "Proceed with Vercel build (ref=${ref:-unknown}, env=${env_name:-unknown})."
exit 0
