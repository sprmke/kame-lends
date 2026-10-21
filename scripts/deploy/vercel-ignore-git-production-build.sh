#!/usr/bin/env bash
# Vercel Ignored Build Step (vercel.json ignoreCommand).
#
# Exit codes are the opposite of a normal script:
#   0 = skip the build (Vercel marks the deployment CANCELED)
#   1 = continue the build
# https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
#
# Git pushes to main must not build Production. GitHub Actions CD is the only
# Production path (quality, then migrate, then deploy). Preview builds still run.
set -euo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"
env_name="${VERCEL_ENV:-}"

if [[ "$env_name" == "production" && "$ref" == "main" ]]; then
  echo "Skip Git production build on main. Releases: GitHub Actions workflow CD."
  exit 0
fi

echo "Proceed with Vercel build (ref=${ref:-unknown}, env=${env_name:-unknown})."
exit 1
