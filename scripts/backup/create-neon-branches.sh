#!/usr/bin/env bash
# Create Neon branches for migration safety (read-only snapshot + QA dev branch).
# Requires: neonctl authenticated (npx neonctl auth) or NEON_API_KEY + NEON_PROJECT_ID.
#
# This script only CREATES branches; it does not delete or mutate prod data.
set -euo pipefail

BACKUP_BRANCH="${NEON_BACKUP_BRANCH_NAME:-pre-sveltekit-migration-backup}"
DEV_BRANCH="${NEON_DEV_BRANCH_NAME:-dev-sveltekit-migration}"

info() { printf '→ %s\n' "$*"; }
ok() { printf '✓ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }

if ! command -v neonctl >/dev/null 2>&1; then
  if npx neonctl --version >/dev/null 2>&1; then
    NEON="npx neonctl"
  else
    warn "neonctl not found. Create branches manually in Neon Console:"
    warn "  1. Branch from prod: $BACKUP_BRANCH (restore point)"
    warn "  2. Branch from prod: $DEV_BRANCH (QA for SvelteKit; use its DATABASE_URL in .env.local)"
    exit 0
  fi
else
  NEON="neonctl"
fi

info "Creating backup branch: $BACKUP_BRANCH"
$NEON branches create --name "$BACKUP_BRANCH" || warn "Branch may already exist: $BACKUP_BRANCH"

info "Creating QA dev branch: $DEV_BRANCH"
$NEON branches create --name "$DEV_BRANCH" || warn "Branch may already exist: $DEV_BRANCH"

ok "Done. Copy the connection string for '$DEV_BRANCH' into .env.local (never prod during migration)."
