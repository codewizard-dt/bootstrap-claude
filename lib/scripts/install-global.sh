#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"

# Stale global skill folders from the wiki rename (adr -> decision, prd -> req)
ORPHAN_SKILLS=(
  adr-create adr-finalize adr-next adr-walkthrough
  prd-create prd-finalize prd-extract-decisions prd-update prd-trash prd-compile
)

SKIP_MCPS=false
for arg in "$@"; do
  [ "$arg" = "--skip-mcps" ] && SKIP_MCPS=true
done

# 1. Ensure global MCP servers are installed (user scope, non-interactive)
#    Pass --skip-mcps when MCPs were already handled interactively by the caller.
if [ "$SKIP_MCPS" = false ]; then
  echo "Checking global MCP servers (user scope)..."
  "$SCRIPT_DIR/install-mcps.sh"
  echo ""
fi

# 2. Install hooks globally
GLOBAL_HOOKS_DIR="$HOME/.claude/hooks"
if [ -d "$TEMPLATE_DIR/lib/hooks" ]; then
  echo "Installing hooks globally (~/.claude/hooks/)..."
  mkdir -p "$GLOBAL_HOOKS_DIR"
  rsync -av --exclude='.DS_Store' "$TEMPLATE_DIR/lib/hooks/" "$GLOBAL_HOOKS_DIR/"
  echo ""
fi

# 3. Install skills globally
echo "Installing skills globally (~/.claude/skills/)..."

# Ensure the global skills directory exists
mkdir -p "$GLOBAL_SKILLS_DIR"

# Rsync skills from the template to ~/.claude/skills/
rsync -av --exclude='.DS_Store' "$TEMPLATE_DIR/lib/skills/" "$GLOBAL_SKILLS_DIR/"

# Detect stale skill folders from the wiki rename
ORPHAN_FOUND=()
for skill in "${ORPHAN_SKILLS[@]}"; do
  if [ -d "$GLOBAL_SKILLS_DIR/$skill" ]; then
    ORPHAN_FOUND+=("$GLOBAL_SKILLS_DIR/$skill")
  fi
done

if [ ${#ORPHAN_FOUND[@]} -gt 0 ]; then
  echo ""
  echo "Stale skill folders detected from the wiki rename:"
  for p in "${ORPHAN_FOUND[@]}"; do
    echo "  $p"
  done
  echo ""
  if [ -t 0 ]; then
    read -r -p "Delete these ${#ORPHAN_FOUND[@]} folder(s)? [y/N]: " REPLY
    case "$REPLY" in
      [yY])
        for p in "${ORPHAN_FOUND[@]}"; do
          rm -rf "$p"
        done
        echo "Removed."
        ;;
      *)
        echo "Skipped. To remove manually: rm -rf ~/.claude/skills/{adr-create,adr-finalize,adr-next,adr-walkthrough,prd-create,prd-finalize,prd-extract-decisions,prd-update,prd-trash,prd-compile}"
        ;;
    esac
  else
    echo "Non-interactive mode: skipping deletion. Remove manually if needed."
  fi
fi

echo "Global setup complete (MCPs + skills)."
