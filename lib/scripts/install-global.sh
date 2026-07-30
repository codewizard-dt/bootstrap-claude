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

# 4. Merge the canonical permission deny list into ~/.claude/settings.json
echo ""
echo "Merging permissions deny list (~/.claude/settings.json)..."
node "$SCRIPT_DIR/merge-settings-deny.js"
echo ""

# 5. Install the @-autocomplete file suggestion picker and register it
echo "Installing file suggestion picker (~/.claude/file-suggestion.sh)..."
mkdir -p "$HOME/.claude"
cp "$SCRIPT_DIR/templates/file-suggestion.sh" "$HOME/.claude/file-suggestion.sh"
chmod +x "$HOME/.claude/file-suggestion.sh"

# The merge exits 0 on every outcome, so its message is the only way to tell a
# fresh registration from a no-op or a skip. Capture stdout+stderr together and
# echo it back; an outcome we don't recognise gets no follow-up line.
FILE_SUGGESTION_OUT="$(node "$SCRIPT_DIR/merge-settings-deny.js" --set-key fileSuggestion --set-value '{"type":"command","command":"~/.claude/file-suggestion.sh"}' 2>&1)"
if [ -n "$FILE_SUGGESTION_OUT" ]; then
  echo "$FILE_SUGGESTION_OUT"
fi
case "$FILE_SUGGESTION_OUT" in
  *'"fileSuggestion" set'*)
    echo "Restart Claude Code sessions to pick up the new file suggestion command."
    ;;
  *'already defines "fileSuggestion"'*)
    echo "Keeping your existing \"fileSuggestion\" — @-autocomplete for the bootstrap wiki dirs stays off."
    ;;
esac
echo ""

echo "Global setup complete (MCPs + hooks + skills + deny list + file suggestion)."
