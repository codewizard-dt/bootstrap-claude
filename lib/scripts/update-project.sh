#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

# 0. Detect legacy .docs/ artifact content (pre-wiki layout) and warn.
#    update never touches these files — migration is a separate, explicit step.
LEGACY_FAMILIES=(tasks uat adr prd bugs roadmaps)
LEGACY_FOUND=()
for fam in "${LEGACY_FAMILIES[@]}"; do
  dir="$PROJECT_DIR/.docs/$fam"
  if [ -d "$dir" ]; then
    count=$(find "$dir" -name '*.md' -type f | wc -l | tr -d ' ')
    if [ "$count" -gt 0 ]; then
      LEGACY_FOUND+=(".docs/$fam ($count file(s))")
    fi
  fi
done

if [ ${#LEGACY_FOUND[@]} -gt 0 ]; then
  echo "=================================================================="
  echo "  WARNING: legacy .docs/ artifact content detected"
  echo "=================================================================="
  for entry in "${LEGACY_FOUND[@]}"; do
    echo "  - $entry"
  done
  echo ""
  echo "  This project was bootstrapped with the old .docs/ layout."
  echo "  'update' will scaffold the new wiki/ structure but will NOT"
  echo "  touch these files. To migrate them into wiki/work/, run:"
  echo ""
  echo "    npx @codewizard-dt/bootstrap migrate"
  echo ""
  if [ -t 0 ]; then
    read -r -p "Continue with update anyway? [y/N]: " REPLY
    case "$REPLY" in
      [yY]) ;;
      *) echo "Aborted."; exit 0 ;;
    esac
  else
    echo "  Non-interactive mode: continuing with update."
  fi
  echo ""
fi

# 0b. Detect other legacy detritus (informational only — no auto-delete)
if [ -d "$PROJECT_DIR/.claude/commands" ]; then
  echo "Note: legacy .claude/commands/ directory found — slash commands are now"
  echo "      global skills. Remove manually when ready: rm -rf .claude/commands/"
  echo ""
fi
if [ -d "$PROJECT_DIR/.claude/skills" ]; then
  echo "Note: project-local .claude/skills/ found — skills are installed globally"
  echo "      to ~/.claude/skills/ now. Remove manually when ready: rm -rf .claude/skills/"
  echo ""
fi

# 1. Install MCPs interactively, then skills + hooks globally
echo "Checking MCP servers..."
"$SCRIPT_DIR/install-mcps.sh" --interactive --project-dir "$PROJECT_DIR"
echo ""
echo "Installing skills and hooks globally (~/.claude/skills/)..."
"$SCRIPT_DIR/install-global.sh" --skip-mcps
echo ""

# 2. Sync the wiki scaffold (copy-once) and guides (always refreshed)
echo "Syncing wiki scaffold..."
"$SCRIPT_DIR/sync-wiki-scaffold.sh" "$PROJECT_DIR"
"$SCRIPT_DIR/merge-gitignore.sh" "$PROJECT_DIR"
echo ""

# 3. Assemble mcp-tools.md guide for only the installed MCPs
echo "Building MCP tools guide..."
INSTALLED_MCPS=()
if [ -f "$PROJECT_DIR/.mcp.json" ] && grep -q '"serena"' "$PROJECT_DIR/.mcp.json" 2>/dev/null; then
  INSTALLED_MCPS+=("serena")
fi
for mcp in context7 brave-search playwright; do
  if claude mcp get "$mcp" &>/dev/null; then
    INSTALLED_MCPS+=("$mcp")
  fi
done
"$SCRIPT_DIR/build-mcp-guide.sh" "$PROJECT_DIR" "${INSTALLED_MCPS[@]+"${INSTALLED_MCPS[@]}"}"
echo ""

# 4. Bootstrap Serena project.yml (idempotent)
echo "Re-checking Serena project.yml bootstrap..."
"$SCRIPT_DIR/bootstrap-serena.sh" "$PROJECT_DIR"
echo ""

# Done
echo "============================="
echo "  Update complete!"
echo "============================="
