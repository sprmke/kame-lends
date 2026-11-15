#!/usr/bin/env bash
# Lint-staged Prettier wrapper.
#
# Prettier 3 refuses an explicitly passed symlink, and this repo keeps command
# and skill symlinks for AI tooling. Filter those out and format the rest.
set -euo pipefail

files=()
for file in "$@"; do
	[[ -L "$file" ]] && continue
	files+=("$file")
done

if [[ ${#files[@]} -eq 0 ]]; then
	exit 0
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec "$ROOT/node_modules/.bin/prettier" --write "${files[@]}"
