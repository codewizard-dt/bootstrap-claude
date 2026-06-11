#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Packed copy of the repo .gitignore (dotfiles are never included in npm packages)
TEMPLATE_GITIGNORE="$SCRIPT_DIR/templates/gitignore"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-project>" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)" || {
  echo "Error: Cannot resolve path: $1"
  exit 1
}

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR"
  exit 1
fi

TARGET="$PROJECT_DIR/.gitignore"

# No target → copy wholesale
if [ ! -f "$TARGET" ]; then
  cp "$TEMPLATE_GITIGNORE" "$TARGET"
  echo ".gitignore: copied to $PROJECT_DIR"
  exit 0
fi

# Snapshot existing lines for exact-match lookups during the merge loop
EXISTING=$(mktemp)
cp "$TARGET" "$EXISTING"
trap 'rm -f "$EXISTING"' EXIT

added=0
pending=""  # comment/blank lines buffered until we know the next content line is new

while IFS= read -r line || [ -n "$line" ]; do
  trimmed="${line#"${line%%[![:space:]]*}"}"   # leading-whitespace stripped

  if [ -z "$trimmed" ] || [[ "$trimmed" == \#* ]]; then
    # Blank or comment line — hold in buffer; only flush if a new content line follows
    pending+="${line}"$'\n'
  else
    # Content line
    if grep -qFx -- "$line" "$EXISTING"; then
      # Already present — discard buffered headers (their section is already represented)
      pending=""
    else
      # New line — pre-flight the file on first append, then flush buffer + add line
      if [ "$added" -eq 0 ] && [ -s "$TARGET" ]; then
        # Ensure target ends with a newline before we start appending
        [[ $(tail -c1 "$TARGET") ]] && printf '\n' >> "$TARGET"
      fi
      if [ -n "$pending" ]; then
        printf '%s' "$pending" >> "$TARGET"
        pending=""
      fi
      printf '%s\n' "$line" >> "$TARGET"
      echo "  + $line"
      added=$((added + 1))
    fi
  fi
done < "$TEMPLATE_GITIGNORE"

if [ "$added" -eq 0 ]; then
  echo ".gitignore: already up to date in $PROJECT_DIR"
else
  echo ".gitignore: $added line(s) merged into $PROJECT_DIR"
fi
