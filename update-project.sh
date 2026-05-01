#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-project>"
  exit 1
fi

# Resolve relative paths (e.g., ".") to absolute by cd-ing into the dir and printing pwd.
# If the path doesn't exist or can't be resolved, cd fails and we catch it with ||.
PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)" || {
  echo "Error: Cannot resolve path: $1"
  exit 1
}

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR"
  exit 1
fi

echo "Updating project: $PROJECT_DIR"
echo ""

# 1. Sync .claude/skills/ and .docs/
echo "Syncing .claude/skills/ and .docs/ scaffold..."
"$TEMPLATE_DIR/sync-docs-scaffold.sh" "$PROJECT_DIR"
echo ""

# 2. Bootstrap Serena project.yml (idempotent)
echo "Re-checking Serena project.yml bootstrap..."
"$TEMPLATE_DIR/bootstrap-serena.sh" "$PROJECT_DIR"
echo ""

# Done
echo "============================="
echo "  Update complete!"
echo "============================="
