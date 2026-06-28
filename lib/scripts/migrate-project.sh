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

# --- Detect git repo (used by both dry-run and live paths) -----------------
if git -C "$PROJECT_DIR" rev-parse --git-dir &>/dev/null; then
  IS_GIT=true
else
  IS_GIT=false
fi

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
  if [ "$IS_GIT" = true ]; then
    echo "Run without --dry-run to migrate (requires clean git tree)."
  else
    echo "Run without --dry-run to migrate (no git repo — will use plain mv)."
  fi
  exit 0
fi

# --- Preflight 2: git-specific checks (skipped when no git repo) -----------
if [ "$IS_GIT" = true ]; then
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
else
  echo "Note: no git repository detected — migration will use plain 'mv' instead of 'git mv'."
  echo "      File history will not be preserved. Consider 'git init && git add -A && git commit' first."
  echo ""
fi

# --- Scaffold first: wiki tree + CLAUDE.md schema + guides -----------------
"$SCRIPT_DIR/sync-wiki-scaffold.sh" "$PROJECT_DIR"
echo ""

# --- Run the Claude-driven migration ---------------------------------------
PROMPT="$(sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$TEMPLATE")"

# When there is no git repo, prepend an override block so Claude uses plain
# mv/rm instead of git mv/git rm throughout the migration.
if [ "$IS_GIT" = false ]; then
  PROMPT="ENVIRONMENT NOTE (overrides every git-specific instruction below):
This project has NO git repository. Adapt all git commands:
- Use the Bash 'mv' command instead of 'git mv' for ALL file moves. The rule still applies: move first, edit second.
- Use the Bash 'rm -f' command instead of 'git rm' for ALL deletions.
- Skip 'git log' for dates — use today's date for both created: and updated: frontmatter fields.
- Skip 'git add -A' — there is no staging area.
- You are NOT on a wiki-migration branch. Work directly in the project directory.

---

$PROMPT"
fi

if [ -n "$EXTRA_CONTEXT" ]; then
  PROMPT="$PROMPT

---

Additional context from the user:
$EXTRA_CONTEXT"
fi

TOTAL_FILES=0
for fam in "${LEGACY_FAMILIES[@]}"; do
  dir="$PROJECT_DIR/.docs/$fam"
  [ -d "$dir" ] || continue
  count=$(find "$dir" -name '*.md' -type f | wc -l | tr -d ' ')
  TOTAL_FILES=$((TOTAL_FILES + count))
done

echo "Migrating .docs/ content to wiki/ ($TOTAL_FILES files — Claude is running, this may take a few minutes)..."
echo ""

# Heartbeat to stderr — fallback for when Claude is silent between tool calls
(
  START=$SECONDS
  while true; do
    sleep 15
    ELAPSED=$((SECONDS - START))
    printf "  [%dm%02ds] still running...\n" $((ELAPSED / 60)) $((ELAPSED % 60)) >&2
  done
) &
HEARTBEAT_PID=$!

# Scratch dir for the FIFO + display filter, under the project being migrated.
# Absolute path so it survives the `cd "$PROJECT_DIR"` below; created if absent.
TMP_DIR="$PROJECT_DIR/tmp"
mkdir -p "$TMP_DIR"
# Keep the scratch files out of the migration diff (Claude runs `git add -A`).
printf '*\n' > "$TMP_DIR/.gitignore"

# FIFO lets us pipe Claude's stream-json through a display filter while
# still capturing Claude's PID for the watchdog.
CLAUDE_FIFO=$(mktemp -u "$TMP_DIR/claude-migrate.XXXXXX")
mkfifo "$CLAUDE_FIFO"

# Write display filter to a temp file to avoid heredoc/redirect ambiguity.
# No `.py` suffix: macOS mktemp only randomizes trailing X's, so a suffix after
# them is treated literally and collides on the second run.
DISPLAY_SCRIPT=$(mktemp "$TMP_DIR/claude-display.XXXXXX")
cat > "$DISPLAY_SCRIPT" << 'PYEOF'
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        ev = json.loads(line)
        if ev.get('type') == 'assistant':
            for b in ev.get('message', {}).get('content', []):
                if b.get('type') == 'text' and b.get('text'):
                    print(b['text'], end='', flush=True)
                elif b.get('type') == 'tool_use':
                    name = b.get('name', '?')
                    inp = b.get('input', {})
                    detail = inp.get('command', inp.get('file_path', inp.get('path', '')))
                    label = name + (': ' + detail if detail else '')
                    print('  [' + label + ']', flush=True)
    except Exception:
        pass
PYEOF

# Start display filter — opens FIFO for reading (blocks until Claude connects)
python3 -u "$DISPLAY_SCRIPT" < "$CLAUDE_FIFO" &
DISPLAY_PID=$!

cd "$PROJECT_DIR"

CLAUDE_EXIT=0
CLAUDE_STDERR=$(mktemp "$TMP_DIR/claude-stderr.XXXXXX")
CLAUDE_MIGRATION=1 claude -p --verbose --dangerously-skip-permissions --strict-mcp-config \
  --output-format stream-json < /dev/null "$PROMPT" > "$CLAUDE_FIFO" 2>"$CLAUDE_STDERR" &
CLAUDE_PID=$!

# Watchdog: kill Claude if it exceeds 30 minutes (hangs / idle loop)
TIMEOUT_SECS=1800
(sleep "$TIMEOUT_SECS"; echo "" >&2; echo "  [timeout] Migration exceeded ${TIMEOUT_SECS}s — killing Claude." >&2; kill "$CLAUDE_PID" 2>/dev/null) &
WATCHDOG_PID=$!

trap 'kill "$HEARTBEAT_PID" "$WATCHDOG_PID" "$CLAUDE_PID" "$DISPLAY_PID" 2>/dev/null; wait "$HEARTBEAT_PID" "$WATCHDOG_PID" "$DISPLAY_PID" 2>/dev/null || true; rm -f "$CLAUDE_FIFO" "$DISPLAY_SCRIPT" "${CLAUDE_STDERR:-}"' EXIT

wait "$CLAUDE_PID" || CLAUDE_EXIT=$?
kill "$WATCHDOG_PID" 2>/dev/null; wait "$WATCHDOG_PID" 2>/dev/null
kill "$HEARTBEAT_PID" 2>/dev/null; wait "$HEARTBEAT_PID" 2>/dev/null
wait "$DISPLAY_PID" 2>/dev/null || true  # let the filter flush remaining output
rm -f "$CLAUDE_FIFO" "$DISPLAY_SCRIPT"

if [ "$CLAUDE_EXIT" -ne 0 ]; then
  # Filter known telemetry noise (Safe-chain, DataDog) — these cause non-zero
  # exit codes but don't indicate migration failure.
  REAL_ERRORS=""
  if [ -f "$CLAUDE_STDERR" ]; then
    REAL_ERRORS=$(grep -v "^Safe-chain:" "$CLAUDE_STDERR" 2>/dev/null || true)
  fi
  if [ -n "$REAL_ERRORS" ]; then
    echo "Error: Claude exited with code $CLAUDE_EXIT" >&2
    echo "--- Claude stderr ---" >&2
    echo "$REAL_ERRORS" >&2
    echo "--------------------" >&2
    rm -f "$CLAUDE_STDERR"
    exit "$CLAUDE_EXIT"
  fi
  # Only telemetry noise — migration succeeded despite non-zero exit code
fi
rm -f "$CLAUDE_STDERR"

echo ""
echo "============================="
echo "  Migration run complete"
echo "============================="
echo ""
if [ "$IS_GIT" = true ]; then
  echo "Next steps (changes are on branch 'wiki-migration', uncommitted):"
  echo "  1. Review:       git status && git diff"
  echo "  2. Health-check: open Claude Code and run /wiki-lint"
  echo "  3. Commit:       git add -A && git commit -m 'Migrate .docs/ to wiki structure'"
  echo "  4. Merge:        switch back and merge wiki-migration when satisfied"
else
  echo "Next steps:"
  echo "  1. Review:       check wiki/work/ to verify all files landed correctly"
  echo "  2. Health-check: open Claude Code and run /wiki-lint"
fi
