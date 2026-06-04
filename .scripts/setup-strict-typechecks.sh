#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   setup-strict-typechecks.sh                        # all languages
#   setup-strict-typechecks.sh typescript python      # space-separated
#   setup-strict-typechecks.sh "typescript, python"   # comma-separated

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../.claude/prompt-template/setup-strict-typechecks.md"

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: prompt template not found at $TEMPLATE" >&2
  exit 1
fi

PROMPT="$(cat "$TEMPLATE")"

if [ $# -gt 0 ]; then
  # Normalize: join args, split on commas/spaces, rejoin as "lang1, lang2"
  LANGS="$(printf '%s ' "$@" | tr ',' ' ' | tr -s ' ' | sed 's/^ //;s/ $//;s/ /, /g')"
  PROMPT="${PROMPT}

---

**Language constraint**: Configure ONLY the following language(s): ${LANGS}. Skip all other languages entirely."
fi

claude --dangerously-skip-permissions "$PROMPT"
