#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATES="$SCRIPT_DIR/templates/wiki"

INTERACTIVE=false
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --interactive) INTERACTIVE=true ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
# bash 3.2 + set -u: expanding an empty array is an unbound-variable error
set -- ${POSITIONAL[@]+"${POSITIONAL[@]}"}

if [ $# -ne 1 ]; then
  echo "Usage: $0 [--interactive] <path-to-project>"
  exit 1
fi

PROJECT_DIR="$(resolve_project_dir "$1")" || exit 1

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
  "$PROJECT_DIR/wiki/guides"

# 2. COPY-ONCE: index.md, log.md, hot.md, .gitkeep files — project-owned after creation, never overwrite
#    Exclude conventions.md and lifecycle.md (those are always-refresh, handled in step 3).
rsync -av --ignore-existing \
  --exclude 'conventions.md' \
  --exclude 'lifecycle.md' \
  --exclude 'dashboard.html' \
  "$TEMPLATES/" "$PROJECT_DIR/wiki/"

# 3. ALWAYS-REFRESH: spec docs (conventions.md, lifecycle.md) and dashboard.html that remain template-owned; always overwrite
rsync -av "$TEMPLATES/conventions.md" "$PROJECT_DIR/wiki/conventions.md"
rsync -av "$TEMPLATES/dashboard.html" "$PROJECT_DIR/wiki/dashboard.html"
for fam in requirements decisions roadmaps tasks uat bugs; do
  rsync -av "$TEMPLATES/work/$fam/lifecycle.md" "$PROJECT_DIR/wiki/work/$fam/lifecycle.md"
done

# 4. GUIDES: tiered delivery into target wiki/guides/ (template-owned
#    infrastructure inside the wiki, same class as conventions.md/lifecycle.md).
#    REQUIRED — always refreshed (template-owned).
#    OPTIONAL — exists in target (new location OR legacy .docs/guides/) =>
#               refresh into wiki/guides/ (user opted in previously);
#               missing => prompt in interactive mode (default no), skip silently
#               otherwise. Opt out by deleting the file/dir (costs one default-no
#               prompt per interactive update).
#    mcp-tools.md is assembled per-project by build-mcp-guide.sh, and
#    deployment-strategy.md is delivered only by setup-deployment.sh
#    (`bootstrap deploy`) — neither is synced here.
GUIDES_SRC="$TEMPLATE_DIR/raw/guides"
GUIDES_DST="$PROJECT_DIR/wiki/guides"
LEGACY_GUIDES="$PROJECT_DIR/.docs/guides"

# Tier lists — plain space-separated words (bash 3.2: no associative arrays).
# Entries may be files or directories; names must not contain spaces.
REQUIRED_GUIDES="command-anti-patterns.md"
OPTIONAL_GUIDES="evals-framework.md type-checking-templates"

deliver_guide() {
  # $1 = guide name (file or dir under GUIDES_SRC)
  if [ -d "$GUIDES_SRC/$1" ]; then
    rsync -av "$GUIDES_SRC/$1/" "$GUIDES_DST/$1/"
  else
    rsync -av "$GUIDES_SRC/$1" "$GUIDES_DST/"
  fi
}

for guide in $REQUIRED_GUIDES; do
  deliver_guide "$guide"
done

for guide in $OPTIONAL_GUIDES; do
  if [ -e "$GUIDES_DST/$guide" ] || [ -e "$LEGACY_GUIDES/$guide" ]; then
    deliver_guide "$guide"
    echo "  $guide: refreshed (already present — previously opted in)."
  elif [ "$INTERACTIVE" = true ] && prompt_yn "  Install optional guide '$guide'? [y/N]: "; then
    deliver_guide "$guide"
  else
    echo "  $guide: skipped. Opt in any time: re-run 'npx @codewizard-dt/bootstrap update' and answer yes."
  fi
done

# 4b. LEGACY MIGRATION: guides used to live in .docs/guides/. Every
#     template-owned guide found there is removed (fresh copies now land in
#     wiki/guides/ above); deployment-strategy.md is MOVED to wiki/guides/
#     when `bootstrap deploy` has run (its build.yml marker exists) and
#     deleted otherwise. User-authored files in .docs/guides/ are untouched.
#     Also removes deprecated task-spec.md from either location (superseded by
#     wiki/work/tasks/lifecycle.md, which it actively contradicts).
if [ -d "$LEGACY_GUIDES" ]; then
  for legacy in command-anti-patterns.md evals-framework.md type-checking-templates mcp-tools.md task-spec.md; do
    if [ -e "$LEGACY_GUIDES/$legacy" ]; then
      rm -rf "${LEGACY_GUIDES:?}/$legacy"
      echo "  Migrated: removed .docs/guides/$legacy (guides now live in wiki/guides/)."
    fi
  done
  if [ -f "$LEGACY_GUIDES/deployment-strategy.md" ]; then
    if [ -f "$PROJECT_DIR/.github/workflows/build.yml" ]; then
      mv "$LEGACY_GUIDES/deployment-strategy.md" "$GUIDES_DST/deployment-strategy.md"
      echo "  Migrated: moved deployment-strategy.md to wiki/guides/ (deploy artifacts present)."
    else
      rm -f "$LEGACY_GUIDES/deployment-strategy.md"
      echo "  Removed deployment-strategy.md (deploy-only guide; delivered by 'npx @codewizard-dt/bootstrap deploy')."
    fi
  fi
  # Drop the legacy dirs when empty; scratch content (.docs/demo etc.) is kept.
  rmdir "$LEGACY_GUIDES" 2>/dev/null && echo "  Removed empty .docs/guides/." || true
  rmdir "$PROJECT_DIR/.docs" 2>/dev/null || true
fi
if [ -f "$GUIDES_DST/task-spec.md" ]; then
  rm -f "$GUIDES_DST/task-spec.md"
  echo "  Removed deprecated guide task-spec.md (superseded by wiki/work/tasks/lifecycle.md)."
fi

# 5. Ensure raw/ has a .gitkeep so git tracks the empty dir
touch -a "$PROJECT_DIR/raw/.gitkeep" 2>/dev/null || true

# 6. Deliver the wiki schema section to the target's CLAUDE.md (copy-once).
#    Sentinel: a line starting with "## LLM Wiki". Never re-appended once
#    present (in either CLAUDE.md or CLAUDE.local.md).
#    When a CLAUDE.md already exists WITHOUT the schema, the user chooses
#    interactively whether to modify it or write CLAUDE.local.md instead;
#    non-interactive runs default to CLAUDE.local.md (never touch a file we
#    didn't create without consent).
CLAUDE_TEMPLATE="$SCRIPT_DIR/templates/CLAUDE-wiki.md"
TARGET_CLAUDE="$PROJECT_DIR/CLAUDE.md"
TARGET_LOCAL="$PROJECT_DIR/CLAUDE.local.md"
# SCHEMA_FILE: where the wiki schema lives after this section — used by the
# .env-safety step below so both sections land in the same file.
SCHEMA_FILE="$TARGET_CLAUDE"
if [ -f "$CLAUDE_TEMPLATE" ]; then
  if [ -f "$TARGET_CLAUDE" ] && grep -q '^## LLM Wiki' "$TARGET_CLAUDE"; then
    echo "CLAUDE.md already has the LLM Wiki schema section, skipping."
  elif [ -f "$TARGET_LOCAL" ] && grep -q '^## LLM Wiki' "$TARGET_LOCAL"; then
    SCHEMA_FILE="$TARGET_LOCAL"
    echo "CLAUDE.local.md already has the LLM Wiki schema section, skipping."
  elif [ ! -f "$TARGET_CLAUDE" ]; then
    {
      echo "# CLAUDE.md"
      echo ""
      echo "This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository."
      echo ""
      cat "$CLAUDE_TEMPLATE"
    } > "$TARGET_CLAUDE"
    echo "CLAUDE.md created with the LLM Wiki schema section."
  else
    if [ "$INTERACTIVE" = true ] && prompt_yn "  Existing CLAUDE.md found. Append the LLM Wiki schema to it? [y/N] (no = write CLAUDE.local.md instead): "; then
      {
        echo ""
        echo "---"
        echo ""
        cat "$CLAUDE_TEMPLATE"
      } >> "$TARGET_CLAUDE"
      echo "LLM Wiki schema section appended to CLAUDE.md."
    else
      SCHEMA_FILE="$TARGET_LOCAL"
      if [ ! -f "$TARGET_LOCAL" ]; then
        {
          echo "# CLAUDE.local.md"
          echo ""
          echo "Machine-local guidance for Claude Code (claude.ai/code) in this repository — companion to CLAUDE.md."
          echo ""
          cat "$CLAUDE_TEMPLATE"
        } > "$TARGET_LOCAL"
      else
        {
          echo ""
          echo "---"
          echo ""
          cat "$CLAUDE_TEMPLATE"
        } >> "$TARGET_LOCAL"
      fi
      echo "LLM Wiki schema section written to CLAUDE.local.md (CLAUDE.md left untouched)."
    fi
  fi
fi

# 7. Ensure the .env safety policy sits at the TOP of the same file that holds
#    the wiki schema (copy-once) — CLAUDE.md, or CLAUDE.local.md when the user
#    declined to modify an existing CLAUDE.md above.
#    Sentinel: the distinctive policy line, checked in BOTH files so the policy
#    is never duplicated across them.
ENV_TEMPLATE="$SCRIPT_DIR/templates/CLAUDE-env-safety.md"
ENV_SENTINEL='never allowed to read or write to any'
if [ -f "$ENV_TEMPLATE" ] && [ -f "$SCHEMA_FILE" ]; then
  if { [ -f "$TARGET_CLAUDE" ] && grep -qF "$ENV_SENTINEL" "$TARGET_CLAUDE"; } \
    || { [ -f "$TARGET_LOCAL" ] && grep -qF "$ENV_SENTINEL" "$TARGET_LOCAL"; }; then
    echo "$(basename "$SCHEMA_FILE") already has the .env safety policy, skipping."
  else
    TMP_CLAUDE="$(mktemp)"
    {
      cat "$ENV_TEMPLATE"
      echo ""
      cat "$SCHEMA_FILE"
    } > "$TMP_CLAUDE"
    mv "$TMP_CLAUDE" "$SCHEMA_FILE"
    echo ".env safety policy prepended to top of $(basename "$SCHEMA_FILE")."
  fi
fi

echo "Wiki scaffold synced."
