#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <absolute-path-to-project>"
  exit 1
fi

PROJECT_DIR="$1"

if [[ "$PROJECT_DIR" != /* ]]; then
  echo "Error: Path must be absolute (start with /)"
  exit 1
fi

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR"
  exit 1
fi

echo "Updating project: $PROJECT_DIR"
echo ""

# 1. Sync .claude/commands/
echo "Syncing .claude/commands/..."
mkdir -p "$PROJECT_DIR/.claude/commands"
rsync -av "$TEMPLATE_DIR/.claude/commands/" "$PROJECT_DIR/.claude/commands/"
echo ""

# 2. Sync .docs/
echo "Syncing .docs/..."
mkdir -p "$PROJECT_DIR/.docs"
rsync -av "$TEMPLATE_DIR/.docs/" "$PROJECT_DIR/.docs/"
echo ""

# Done
echo "============================="
echo "  Update complete!"
echo "============================="
