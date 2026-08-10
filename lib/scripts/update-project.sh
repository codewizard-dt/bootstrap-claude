#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-project>"
  exit 1
fi

PROJECT_DIR="$(resolve_project_dir "$1")" || exit 1

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
  # --- update.legacyDocsAck ------------------------------------------------
  # Sticky by hand rather than via prompt_yn_sticky, because this key must
  # never persist `false` from THIS prompt. Two reasons:
  #
  #   1. A recorded `false` would abort every future `update` at the exit 0
  #      below — silently, with no prompt left to change your mind with.
  #   2. The key is an ACKNOWLEDGEMENT ("I know about the legacy .docs/, stop
  #      warning me"), not a policy. Answering yes migrates nothing; it only
  #      stops this warning from blocking every subsequent update.
  #
  # `false` is still honoured on READ: /bootstrap-config can set it
  # deliberately, and "always stop me on this project" must keep working. It
  # is only never WRITTEN here — the decline path below records nothing.
  #
  # The non-interactive branch CONTINUES (as it always has). prompt_yn_sticky
  # answers no when there is no tty, so dropping it in wholesale would abort
  # every headless update on a legacy project.
  LEGACY_ACK="$(prefs_get "update.legacyDocsAck" "$PROJECT_DIR")"
  case "$LEGACY_ACK" in
    true)
      echo "  update.legacyDocsAck: using remembered answer (yes) — change with /bootstrap-config"
      ;;
    false)
      echo "  update.legacyDocsAck: honouring recorded answer (no) — change with /bootstrap-config"
      echo "Aborted."
      exit 0
      ;;
    *)
      if has_tty; then
        # Used as an if-condition, never bare: a `no` returns 1 and would abort
        # this script under `set -euo pipefail`.
        if prompt_yn "Continue with update anyway? [y/N]: "; then
          prefs_set "update.legacyDocsAck" "$PROJECT_DIR" true
        else
          echo "Aborted."
          exit 0
        fi
      else
        echo "  Non-interactive mode: continuing with update."
      fi
      ;;
  esac
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

# Shared setup/update sequence: MCPs, skills+hooks, wiki scaffold, MCP guide, Serena.
run_project_sync "$PROJECT_DIR" "$SCRIPT_DIR"

# Done
echo "============================="
echo "  Update complete!"
echo "============================="
