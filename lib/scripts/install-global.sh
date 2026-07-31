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

# Local/offline-safe steps (1-5) run first so hooks, skills, and settings
# always land; the network-dependent MCP install runs last (step 6), guarded
# so a failure cannot abort the script under `set -euo pipefail`.

# 1. Install hooks globally
GLOBAL_HOOKS_DIR="$HOME/.claude/hooks"
if [ -d "$TEMPLATE_DIR/lib/hooks" ]; then
  echo "Installing hooks globally (~/.claude/hooks/)..."
  mkdir -p "$GLOBAL_HOOKS_DIR"
  rsync -av --exclude='.DS_Store' "$TEMPLATE_DIR/lib/hooks/" "$GLOBAL_HOOKS_DIR/"
  echo ""
else
  echo "Warning: $TEMPLATE_DIR/lib/hooks not found — hook scripts NOT installed" >&2
fi

# 2. Install skills globally
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

# 3. Merge the canonical permission deny list into ~/.claude/settings.json
echo ""
echo "Merging permissions deny list (~/.claude/settings.json)..."
node "$SCRIPT_DIR/merge-settings-deny.js"
echo ""

# 4. Merge the canonical hook wiring into ~/.claude/settings.json so the
#    scripts installed in step 1 are actually registered (no more manual
#    paste from lib/hooks/README.md).
echo "Merging hooks wiring (~/.claude/settings.json)..."
# The merge exits 0 on every outcome, so its message is the only way to tell
# a fresh/changed wiring from a no-op. Capture stdout+stderr together and
# echo it back; only nudge a restart when something actually changed.
HOOKS_WIRING_OUT="$(node "$SCRIPT_DIR/merge-settings-hooks.js" 2>&1)"
if [ -n "$HOOKS_WIRING_OUT" ]; then
  echo "$HOOKS_WIRING_OUT"
fi
case "$HOOKS_WIRING_OUT" in
  *'hooks wiring: created'*|*' applied'*)
    echo "Restart Claude Code sessions to activate hook changes."
    ;;
esac
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

# 6. Ensure global MCP servers are installed (user scope, non-interactive) —
#    LAST because it is the only network-dependent step, and guarded so a
#    failure warns instead of aborting the local installs above.
#    Pass --skip-mcps when MCPs were already handled interactively by the caller.
if [ "$SKIP_MCPS" = false ]; then
  echo "Checking global MCP servers (user scope)..."
  if ! "$SCRIPT_DIR/install-mcps.sh"; then
    echo "Warning: MCP install failed — hooks, skills, and settings were installed; re-run 'bootstrap install' to retry MCPs." >&2
  fi
  echo ""
fi

echo "Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + MCPs)."
