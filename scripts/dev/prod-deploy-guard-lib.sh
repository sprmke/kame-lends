#!/usr/bin/env bash
# Shared shell-safety guard for Cursor + Claude Code hooks.
# Source this file; do not execute directly.
#
# Production releases go through GitHub Actions CD on main
# (migrate → Vercel). This guard only blocks/asks for high-risk local shell.

# Returns 0 when the command should be blocked.
shell_guard_is_blocked() {
  local cmd="$1"

  case "$cmd" in
    *"rm -rf /"*|*"rm -rf /*"*|*"rm -rf ~"*)
      return 0
      ;;
    *neonctl*projects\ delete*|*neonctl*branches\ delete*|*neonctl*branches\ reset*)
      return 0
      ;;
    *"DROP DATABASE"*|*"drop database"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Returns 0 when the command should ask for confirmation.
shell_guard_needs_ask() {
  local cmd="$1"

  case "$cmd" in
    *"drop table"*|*"DROP TABLE"*)
      return 0
      ;;
    *"push --force"*|*"push -f "*|*"push -f"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

shell_guard_block_reason() {
  cat <<EOF
Blocked: this command is destructive (root/home delete, Neon project/branch delete, or DROP DATABASE).

Production app + schema changes should go through GitHub Actions CD on main (quality → migrate → Vercel). Prefer that path over one-off production shell mutations.
EOF
}

shell_guard_ask_reason() {
  cat <<EOF
This command may drop tables or force-push git history. Confirm with the user before running.
EOF
}
