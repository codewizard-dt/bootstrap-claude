# shellcheck shell=bash
# lib.sh — shared shell helpers for the bootstrap-claude setup scripts.
#
# Sourced, never executed. Source it with:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; . "$SCRIPT_DIR/lib.sh"
#
# HARD CONSTRAINT: must run on macOS default bash 3.2. No `local -n` namerefs,
# no associative arrays, no `${var,,}`. Functions return values by printing to
# stdout; diagnostics go to stderr.

# ---------------------------------------------------------------------------
# resolve_project_dir <path>
#
# Resolves <path> (e.g. "." or a relative path) to an absolute directory by
# cd-ing into it and printing pwd. On success prints the absolute path to
# stdout. On failure (unresolvable path or not a directory) prints an error to
# stderr and returns 1 — so callers can `PROJECT_DIR="$(resolve_project_dir "$1")" || exit 1`.
# ---------------------------------------------------------------------------
resolve_project_dir() {
  local resolved
  resolved="$(cd "$1" 2>/dev/null && pwd)" || {
    echo "Error: Cannot resolve path: $1" >&2
    return 1
  }
  if [ ! -d "$resolved" ]; then
    echo "Error: Directory does not exist: $resolved" >&2
    return 1
  fi
  printf '%s\n' "$resolved"
}

# ---------------------------------------------------------------------------
# mcp_installed <name>
#
# True when an MCP named <name> is registered at any scope visible to the
# current project.
# ---------------------------------------------------------------------------
mcp_installed() {
  claude mcp get "$1" &>/dev/null
}

# ---------------------------------------------------------------------------
# serena_installed <project_dir>
#
# True when Serena is already registered for <project_dir> (its project-scoped
# .mcp.json names "serena").
# ---------------------------------------------------------------------------
serena_installed() {
  [ -n "$1" ] && [ -f "$1/.mcp.json" ] && \
    grep -q '"serena"' "$1/.mcp.json" 2>/dev/null
}

# ---------------------------------------------------------------------------
# detect_installed_mcps <project_dir>
#
# Prints the space-separated names of the MCPs currently available to
# <project_dir>: "serena" (via its project .mcp.json) plus any of
# context7 / brave-search / playwright registered with `claude mcp`.
# Intended to be passed unquoted to build-mcp-guide.sh so it word-splits into
# separate arguments.
# ---------------------------------------------------------------------------
detect_installed_mcps() {
  local project_dir result mcp
  project_dir="$1"
  result=""
  if serena_installed "$project_dir"; then
    result="serena"
  fi
  for mcp in context7 brave-search playwright; do
    if mcp_installed "$mcp"; then
      result="${result:+$result }$mcp"
    fi
  done
  printf '%s\n' "$result"
}

# ---------------------------------------------------------------------------
# run_project_sync <project_dir> <script_dir>
#
# The shared setup/update sequence run identically by setup-project.sh and
# update-project.sh: install MCPs interactively, install skills+hooks globally,
# sync the wiki scaffold, merge the .gitignore, build the MCP-tools guide for
# the detected MCPs, then bootstrap Serena's project.yml. Prints the same
# section headers and blank-line separators the two scripts printed inline.
# ---------------------------------------------------------------------------
run_project_sync() {
  local project_dir script_dir installed_mcps
  project_dir="$1"
  script_dir="$2"

  echo "Checking MCP servers..."
  "$script_dir/install-mcps.sh" --interactive --project-dir "$project_dir"
  echo ""

  echo "Installing skills and hooks globally..."
  "$script_dir/install-global.sh" --skip-mcps
  echo ""

  echo "Syncing wiki scaffold..."
  "$script_dir/sync-wiki-scaffold.sh" "$project_dir"
  "$script_dir/merge-gitignore.sh" "$project_dir"
  echo ""

  echo "Building MCP tools guide..."
  installed_mcps="$(detect_installed_mcps "$project_dir")"
  # Unquoted on purpose: word-split the space-separated names into arguments.
  "$script_dir/build-mcp-guide.sh" "$project_dir" $installed_mcps
  echo ""

  echo "Bootstrapping Serena project.yml..."
  "$script_dir/bootstrap-serena.sh" "$project_dir"
  echo ""
}

# ---------------------------------------------------------------------------
# prompt_yn <prompt>
#
# Reads a yes/no answer. In a non-interactive terminal answers "no" (prints a
# note and returns 1). Returns 0 for y/Y*, 1 otherwise.
# ---------------------------------------------------------------------------
prompt_yn() {
  local prompt reply
  prompt="$1"
  if [ -t 0 ]; then
    read -r -p "$prompt" reply
  else
    echo "  Non-interactive terminal: skipping prompt, answering no."
    reply="n"
  fi
  case "$reply" in
    [yY]*) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# prompt_scope <name>
#
# Asks whether to register <name> at user (default) or project scope.
# Prints "user" or "project". Defaults to "user" in a non-interactive terminal.
# ---------------------------------------------------------------------------
prompt_scope() {
  local name reply
  name="$1"
  if [ -t 0 ]; then
    read -r -p "  Scope for $name — [u]ser (default) or [p]roject? " reply
  else
    reply="u"
  fi
  case "$reply" in
    [pP]*) echo "project" ;;
    *) echo "user" ;;
  esac
}
