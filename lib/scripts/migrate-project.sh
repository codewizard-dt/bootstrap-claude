#!/usr/bin/env bash
set -euo pipefail

# Migrate a project bootstrapped with the legacy .docs/ layout to the LLM Wiki
# structure (wiki/knowledge/ + wiki/work/). The mechanical scaffold is done by
# sync-wiki-scaffold.sh; the semantic conversion (frontmatter synthesis, ID
# renames, link rewriting, family indexes) is performed by Claude using the
# prompt template at lib/prompts/migrate-wiki.md — same seam as setup-deployment.
#
# Safety: requires a clean git tree and runs on a fresh `wiki-migration` branch
# so the entire migration is one reviewable diff. Files are `git mv`d before
# editing, so history is preserved.
#
# Usage:
#   migrate-project.sh [--dry-run] <path-to-project> [additional context...]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../prompts/migrate-wiki.md"

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: prompt template not found at $TEMPLATE" >&2
  exit 1
fi

DRY_RUN=false
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
set -- "${POSITIONAL[@]}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 [--dry-run] <path-to-project> [additional context...]" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)" || {
  echo "Error: Cannot resolve path: $1" >&2
  exit 1
}
shift
EXTRA_CONTEXT="${*}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR" >&2
  exit 1
fi

# --- Preflight 1: legacy content must exist -------------------------------
LEGACY_FAMILIES=(tasks uat adr prd bugs roadmaps)
LEGACY_FOUND=()
for fam in "${LEGACY_FAMILIES[@]}"; do
  dir="$PROJECT_DIR/.docs/$fam"
  if [ -d "$dir" ]; then
    count=$(find "$dir" -name '*.md' -type f | wc -l | tr -d ' ')
    if [ "$count" -gt 0 ]; then
      LEGACY_FOUND+=("$fam:$count")
    fi
  fi
done

if [ ${#LEGACY_FOUND[@]} -eq 0 ]; then
  echo "Nothing to migrate: no legacy .docs/ artifact content found in $PROJECT_DIR."
  exit 0
fi

echo "Legacy .docs/ content found in $PROJECT_DIR:"
for entry in "${LEGACY_FOUND[@]}"; do
  fam="${entry%%:*}"
  count="${entry##*:}"
  echo "  .docs/$fam — $count markdown file(s)"
done
echo ""

# --- Dry run: inventory only, no changes, no branch ------------------------
if [ "$DRY_RUN" = true ]; then
  echo "DRY RUN — files that would migrate:"
  echo ""
  for fam in "${LEGACY_FAMILIES[@]}"; do
    dir="$PROJECT_DIR/.docs/$fam"
    [ -d "$dir" ] || continue
    find "$dir" -name '*.md' -type f | sort | while read -r f; do
      echo "  ${f#"$PROJECT_DIR/"}"
    done
  done
  echo ""
  echo "Target layout: wiki/work/{tasks,uat,decisions,requirements,bugs,roadmaps}/"
  echo "Run without --dry-run to migrate (requires clean git tree)."
  exit 0
fi

# --- Preflight 2: git repo, clean tree, fresh branch -----------------------
if ! git -C "$PROJECT_DIR" rev-parse --git-dir &>/dev/null; then
  echo "Error: $PROJECT_DIR is not a git repository." >&2
  echo "The migration relies on git mv to preserve file history. Run 'git init' and commit first." >&2
  exit 1
fi

if [ -n "$(git -C "$PROJECT_DIR" status --porcelain)" ]; then
  echo "Error: working tree is not clean. Commit or stash your changes first —" >&2
  echo "the migration must be the only thing in its diff." >&2
  exit 1
fi

if git -C "$PROJECT_DIR" show-ref --verify --quiet refs/heads/wiki-migration; then
  echo "Error: a 'wiki-migration' branch already exists." >&2
  echo "Delete or rename it first: git branch -D wiki-migration" >&2
  exit 1
fi

git -C "$PROJECT_DIR" switch -c wiki-migration
echo "Created and switched to branch: wiki-migration"
echo ""

# --- Scaffold first: wiki tree + CLAUDE.md schema + guides -----------------
"$SCRIPT_DIR/sync-wiki-scaffold.sh" "$PROJECT_DIR"
echo ""

# --- Run the Claude-driven migration ---------------------------------------
PROMPT="$(sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$TEMPLATE")"

if [ -n "$EXTRA_CONTEXT" ]; then
  PROMPT="$PROMPT

---

Additional context from the user:
$EXTRA_CONTEXT"
fi

echo "Migrating .docs/ content to wiki/ (this runs Claude and may take a few minutes)..."
cd "$PROJECT_DIR"
claude -p --dangerously-skip-permissions "$PROMPT"

echo ""
echo "============================="
echo "  Migration run complete"
echo "============================="
echo ""
echo "Next steps (changes are staged on branch 'wiki-migration', uncommitted):"
echo "  1. Review:       git status && git diff --staged"
echo "  2. Health-check: open Claude Code and run /wiki-lint"
echo "  3. Commit:       git add -A && git commit -m 'Migrate .docs/ to wiki structure'"
echo "  4. Merge:        switch back and merge wiki-migration when satisfied"
