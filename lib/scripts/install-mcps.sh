#!/usr/bin/env bash
set -euo pipefail

# install-mcps.sh [--interactive] [--project-dir <dir>]
#
# Without --interactive: installs all missing MCPs at user scope without prompting
#   (current install-global.sh behaviour — used by `bootstrap install`)
# With --interactive --project-dir <dir>: prompts for each missing MCP and asks scope
#   (used by setup-project.sh and update-project.sh)
#
# Serena is only offered when --project-dir is provided (it requires an absolute project path).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

INTERACTIVE=false
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interactive) INTERACTIVE=true; shift ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# mcp_installed, serena_installed, prompt_yn, prompt_scope live in lib.sh.

# mcp_add_scoped <scope> <claude-mcp-add-args...>
# Runs `claude mcp add --scope <scope> <args...>`. For project scope, cd into
# PROJECT_DIR first (project MCPs are written relative to cwd); if project scope
# is requested without a PROJECT_DIR, fall back to user scope.
mcp_add_scoped() {
  local scope="$1"; shift
  if [ "$scope" = "project" ] && [ -n "$PROJECT_DIR" ]; then
    ( cd "$PROJECT_DIR" && claude mcp add --scope project "$@" )
  else
    claude mcp add --scope user "$@"
  fi
}

# register_optional_mcp <name> <interactive-prompt> <adder-fn>
# Common wrapper for the optional MCPs (brave-search / context7 / playwright):
# skip if already installed; in interactive mode gate on a y/n prompt and ask
# for scope; otherwise install non-interactively at user scope. <adder-fn>
# performs the actual `claude mcp add` (including any API-key prompting) and
# receives the resolved scope ("user" | "project") as its only argument.
register_optional_mcp() {
  local name="$1" prompt="$2" adder="$3" scope
  if mcp_installed "$name"; then
    echo "  $name: already installed, skipping."
    return 0
  fi
  if [ "$INTERACTIVE" = true ]; then
    if prompt_yn "$prompt"; then
      scope="$(prompt_scope "$name")"
      "$adder" "$scope"
      echo "  $name MCP installed."
    fi
  else
    echo "  Installing $name MCP..."
    "$adder" user
    echo "  $name MCP installed."
  fi
}

# Per-MCP adders. Each takes the resolved scope as $1 and preserves the exact
# interactive vs non-interactive key-prompting behaviour of the original blocks.
_add_brave() {
  if [ "$INTERACTIVE" = true ]; then
    read -r -p "  BRAVE_API_KEY (get one at https://brave.com/search/api/): " BRAVE_API_KEY
  elif [ -z "${BRAVE_API_KEY:-}" ]; then
    echo -n "  Enter your Brave Search API key (get one at https://brave.com/search/api/): "
    read -r BRAVE_API_KEY
  fi
  mcp_add_scoped "$1" brave-search \
    --env "BRAVE_API_KEY=${BRAVE_API_KEY}" \
    -- npx -y @modelcontextprotocol/server-brave-search
}

_add_context7() {
  if [ "$INTERACTIVE" = true ]; then
    read -r -p "  CONTEXT7_API_KEY (optional — press Enter to skip; get one at https://context7.com/dashboard): " CONTEXT7_API_KEY
  elif [ -z "${CONTEXT7_API_KEY:-}" ]; then
    echo -n "  Enter your Context7 API key (optional — press Enter to skip, get one at https://context7.com/dashboard): "
    read -r CONTEXT7_API_KEY
  fi
  if [ -n "${CONTEXT7_API_KEY:-}" ]; then
    mcp_add_scoped "$1" --transport http \
      --header "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}" \
      context7 https://mcp.context7.com/mcp
  else
    mcp_add_scoped "$1" --transport http \
      context7 https://mcp.context7.com/mcp
  fi
}

_add_playwright() {
  mcp_add_scoped "$1" playwright -- npx @playwright/mcp@latest
}

# ---------------------------------------------------------------------------
# Serena (always project scope — only when --project-dir provided)
# ---------------------------------------------------------------------------
if [ -n "$PROJECT_DIR" ]; then
  if serena_installed "$PROJECT_DIR"; then
    echo "  serena: already registered for this project, skipping."
  elif [ "$INTERACTIVE" = true ]; then
    if prompt_yn "Install Serena MCP (code exploration & editing, always project scope)? [Y/n]: "; then
      ( cd "$PROJECT_DIR" && \
        claude mcp add --scope project serena -- \
          uvx --from git+https://github.com/oraios/serena \
          serena start-mcp-server --context claude-code --project "$PROJECT_DIR" )
      echo "  serena MCP registered."
    fi
  fi
  # Non-interactive with --project-dir: skip Serena — setup-project.sh previously
  # handled it explicitly; callers that want silent Serena setup do so themselves.
fi

# ---------------------------------------------------------------------------
# Optional MCPs (near-identical wrappers — see register_optional_mcp above)
# ---------------------------------------------------------------------------
register_optional_mcp brave-search \
  "Install Brave Search MCP (web research, requires API key)? [y/N]: " _add_brave

register_optional_mcp context7 \
  "Install Context7 MCP (library documentation lookups)? [y/N]: " _add_context7

register_optional_mcp playwright \
  "Install Playwright MCP (browser automation & UI testing)? [y/N]: " _add_playwright
