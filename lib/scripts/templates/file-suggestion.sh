#!/usr/bin/env bash
# Custom @-autocomplete provider for Claude Code.
#
# Installed to ~/.claude/file-suggestion.sh by install-global.sh and registered
# under the "fileSuggestion" settings key. A custom command replaces the
# built-in picker entirely, which is the point: the built-in picker honours
# .git/info/exclude (and recent versions suggest only git-tracked files), so the
# machine-local excludes written by merge-gitignore.sh blind @-autocomplete on
# .serena/, raw/, and wiki/. This script re-includes exactly the paths listed
# under the bootstrap sentinel in .git/info/exclude — a user's other deliberately
# hidden entries stay hidden, and a project with no sentinel block gets plain
# `rg --files` behaviour.
#
# Contract (community-verified; not fully spelled out in the settings docs):
#   stdin   JSON object with a "query" field
#   env     CLAUDE_PROJECT_DIR
#   stdout  newline-separated project-relative paths (~15 useful)
#   exit    ALWAYS 0 — a non-zero exit or stderr chatter degrades the picker
#
# No jq/fzf dependency. rg is preferred; git ls-files and find are fallbacks.

# Every diagnostic from every tool below is swallowed: the picker consumes
# stdout only, and stray stderr is visible noise on every keystroke.
exec 2>/dev/null

SENTINEL='# bootstrap wiki & agent state (machine-local)'
MAX_RESULTS=15

# --- query -------------------------------------------------------------------
# Missing/empty/unparseable stdin degrades to list mode (empty query).
QUERY=''
if [ ! -t 0 ]; then
  STDIN_JSON=$(cat)
  QUERY=$(printf '%s' "$STDIN_JSON" | tr '\n' ' ' \
    | sed -n 's/.*"query"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

have_rg() { command -v rg >/dev/null 2>&1; }

# --- base listing ------------------------------------------------------------
# rg honours .gitignore and .git/info/exclude, so this is the built-in-equivalent
# view; the re-include pass below adds back the bootstrap-hidden dirs.
list_base() {
  if have_rg; then
    rg --files
    return 0
  fi

  tracked=$(git ls-files --cached --others --exclude-standard) \
    && [ -n "$tracked" ] \
    && { printf '%s\n' "$tracked"; return 0; }

  # Not a git repo (or git absent): walk the tree directly.
  find . -type f -not -path './.git/*' | sed 's|^\./||'
}

# --- sentinel-scoped re-inclusion -------------------------------------------
# Emit the lines between the bootstrap sentinel comment and the next comment
# line (or EOF) in .git/info/exclude — expected values are .serena/, raw/, wiki/.
sentinel_entries() {
  [ -f .git/info/exclude ] || return 0
  awk -v sentinel="$SENTINEL" '
    $0 == sentinel { in_block = 1; next }
    in_block && /^[[:space:]]*#/ { in_block = 0 }
    in_block { print }
  ' .git/info/exclude
}

list_reincluded() {
  sentinel_entries | while IFS= read -r entry; do
    dir=${entry%/}
    # Only re-include relative in-tree directories that actually exist here;
    # a sentinel path may name a dir this project does not have.
    case "$dir" in
      '' | /* | *..*) continue ;;
    esac
    [ -d "$dir" ] || continue

    if have_rg; then
      rg --files --no-ignore "$dir"
    else
      find "$dir" -type f | sed 's|^\./||'
    fi
  done
}

# --- matching ----------------------------------------------------------------
# Subsequence ("fuzzy") matching, because replacing the built-in picker replaces
# its matcher too, and a plain substring match is strictly worse than what it
# displaced: `@wikitasks` and `@wiki/tasks` both find nothing under -F, since
# neither appears contiguously in `wiki/work/tasks/...`. The query's characters
# must appear in order, not adjacently.
#
# Build an ERE with `.*` between each character. Escaping is per-character and
# happens *while* building, never as a separate pass — escaping first and then
# interleaving would split a backslash from the character it escapes.
fuzzy_pattern() {
  local q=$1 out='' i c
  for (( i = 0; i < ${#q}; i++ )); do
    c=${q:i:1}
    case $c in
      # ERE metacharacters, plus backslash. Anything else is literal.
      '.'|'['|']'|'('|')'|'{'|'}'|'*'|'+'|'?'|'|'|'^'|'$'|'\') out="$out\\$c" ;;
      *) out="$out$c" ;;
    esac
    out="$out.*"
  done
  printf '%s' "$out"
}

# Contiguous matches rank above merely-subsequence ones: `@tasks` should surface
# `wiki/work/tasks/` before a path that happens to contain t…a…s…k…s scattered.
# Both passes read the same candidate list from a temp file rather than running
# the (expensive) listing twice.
rank() {
  local candidates=$1 pattern
  if [ -z "$QUERY" ]; then
    cat -- "$candidates"
    return 0
  fi
  pattern=$(fuzzy_pattern "$QUERY")
  grep -iF -- "$QUERY" "$candidates"
  # Subsequence hits that are not already contiguous hits.
  grep -iE -- "$pattern" "$candidates" | grep -ivF -- "$QUERY"
}

# --- emit --------------------------------------------------------------------
# `head` truncating the pipe SIGPIPEs the upstream stages; the pipeline's status
# is head's (pipefail is deliberately not set) and their stderr is already gone.
CANDIDATES=$(mktemp -t file-suggestion) || exit 0
trap 'rm -f -- "$CANDIDATES"' EXIT

{
  list_base
  list_reincluded
} | sort -u > "$CANDIDATES"

rank "$CANDIDATES" | head -n "$MAX_RESULTS"

exit 0
