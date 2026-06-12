#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATES="$SCRIPT_DIR/templates/wiki"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-project>"
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

echo "Syncing wiki scaffold into: $PROJECT_DIR"

# 1. Create all directories
mkdir -p \
  "$PROJECT_DIR/raw" \
  "$PROJECT_DIR/wiki" \
  "$PROJECT_DIR/wiki/knowledge/sources" \
  "$PROJECT_DIR/wiki/knowledge/concepts" \
  "$PROJECT_DIR/wiki/knowledge/entities/people" \
  "$PROJECT_DIR/wiki/knowledge/entities/organisations" \
  "$PROJECT_DIR/wiki/knowledge/entities/tools" \
  "$PROJECT_DIR/wiki/knowledge/entities/components" \
  "$PROJECT_DIR/wiki/work/requirements" \
  "$PROJECT_DIR/wiki/work/decisions" \
  "$PROJECT_DIR/wiki/work/roadmaps" \
  "$PROJECT_DIR/wiki/work/tasks" \
  "$PROJECT_DIR/wiki/work/uat" \
  "$PROJECT_DIR/wiki/work/uat/screenshots" \
  "$PROJECT_DIR/wiki/work/bugs" \
  "$PROJECT_DIR/.docs/guides"

# 2. COPY-ONCE: index.md, log.md, .gitkeep files — project-owned after creation, never overwrite
#    Exclude conventions.md and lifecycle.md (those are always-refresh, handled in step 3).
rsync -av --ignore-existing \
  --exclude 'conventions.md' \
  --exclude 'lifecycle.md' \
  "$TEMPLATES/" "$PROJECT_DIR/wiki/"

# 3. ALWAYS-REFRESH: spec docs that remain template-owned; always overwrite
rsync -av "$TEMPLATES/conventions.md" "$PROJECT_DIR/wiki/conventions.md"
for fam in requirements decisions roadmaps tasks uat bugs; do
  rsync -av "$TEMPLATES/work/$fam/lifecycle.md" "$PROJECT_DIR/wiki/work/$fam/lifecycle.md"
done

# 4. GUIDES: always refresh from raw/guides/ into target .docs/guides/
rsync -av "$TEMPLATE_DIR/raw/guides/" "$PROJECT_DIR/.docs/guides/"

# 5. Ensure raw/ has a .gitkeep so git tracks the empty dir
touch -a "$PROJECT_DIR/raw/.gitkeep" 2>/dev/null || true

# 6. Deliver the wiki schema section to the target's CLAUDE.md (copy-once).
#    Sentinel: a line starting with "## LLM Wiki". Never re-appended once present.
CLAUDE_TEMPLATE="$SCRIPT_DIR/templates/CLAUDE-wiki.md"
TARGET_CLAUDE="$PROJECT_DIR/CLAUDE.md"
if [ -f "$CLAUDE_TEMPLATE" ]; then
  if [ ! -f "$TARGET_CLAUDE" ]; then
    {
      echo "# CLAUDE.md"
      echo ""
      echo "This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository."
      echo ""
      cat "$CLAUDE_TEMPLATE"
    } > "$TARGET_CLAUDE"
    echo "CLAUDE.md created with the LLM Wiki schema section."
  elif ! grep -q '^## LLM Wiki' "$TARGET_CLAUDE"; then
    {
      echo ""
      echo "---"
      echo ""
      cat "$CLAUDE_TEMPLATE"
    } >> "$TARGET_CLAUDE"
    echo "LLM Wiki schema section appended to CLAUDE.md."
  else
    echo "CLAUDE.md already has the LLM Wiki schema section, skipping."
  fi
fi

echo "Wiki scaffold synced."
