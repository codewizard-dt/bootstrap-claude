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

INTERACTIVE=false
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interactive) INTERACTIVE=true; shift ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Check if an MCP is registered (any scope visible to the current project)
mcp_installed() {
  claude mcp get "$1" &>/dev/null
}

serena_installed() {
  [ -n "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/.mcp.json" ] && \
    grep -q '"serena"' "$PROJECT_DIR/.mcp.json" 2>/dev/null
}

prompt_yn() {
  local prompt="$1"
  local reply
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

prompt_scope() {
  local name="$1"
  local reply
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

# ---------------------------------------------------------------------------
# Serena (always project scope — only when --project-dir provided)
# ---------------------------------------------------------------------------
if [ -n "$PROJECT_DIR" ]; then
  if serena_installed; then
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
# Brave Search
# ---------------------------------------------------------------------------
if mcp_installed "brave-search"; then
  echo "  brave-search: already installed, skipping."
else
  if [ "$INTERACTIVE" = true ]; then
    if prompt_yn "Install Brave Search MCP (web research, requires API key)? [y/N]: "; then
      scope=$(prompt_scope "brave-search")
      read -r -p "  BRAVE_API_KEY (get one at https://brave.com/search/api/): " BRAVE_API_KEY
      if [ "$scope" = "project" ] && [ -n "$PROJECT_DIR" ]; then
        ( cd "$PROJECT_DIR" && \
          claude mcp add --scope project brave-search \
            --env "BRAVE_API_KEY=${BRAVE_API_KEY}" \
            -- npx -y @modelcontextprotocol/server-brave-search )
      else
        claude mcp add --scope user brave-search \
          --env "BRAVE_API_KEY=${BRAVE_API_KEY}" \
          -- npx -y @modelcontextprotocol/server-brave-search
      fi
      echo "  brave-search MCP installed."
    fi
  else
    echo "  Installing brave-search MCP..."
    if [ -z "${BRAVE_API_KEY:-}" ]; then
      echo -n "  Enter your Brave Search API key (get one at https://brave.com/search/api/): "
      read -r BRAVE_API_KEY
    fi
    claude mcp add --scope user brave-search \
      --env "BRAVE_API_KEY=${BRAVE_API_KEY}" \
      -- npx -y @modelcontextprotocol/server-brave-search
    echo "  brave-search MCP installed."
  fi
fi

# ---------------------------------------------------------------------------
# Context7
# ---------------------------------------------------------------------------
if mcp_installed "context7"; then
  echo "  context7: already installed, skipping."
else
  if [ "$INTERACTIVE" = true ]; then
    if prompt_yn "Install Context7 MCP (library documentation lookups)? [y/N]: "; then
      scope=$(prompt_scope "context7")
      read -r -p "  CONTEXT7_API_KEY (optional — press Enter to skip; get one at https://context7.com/dashboard): " CONTEXT7_API_KEY
      if [ "$scope" = "project" ] && [ -n "$PROJECT_DIR" ]; then
        if [ -n "${CONTEXT7_API_KEY:-}" ]; then
          ( cd "$PROJECT_DIR" && \
            claude mcp add --scope project --transport http \
              --header "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}" \
              context7 https://mcp.context7.com/mcp )
        else
          ( cd "$PROJECT_DIR" && \
            claude mcp add --scope project --transport http \
              context7 https://mcp.context7.com/mcp )
        fi
      else
        if [ -n "${CONTEXT7_API_KEY:-}" ]; then
          claude mcp add --scope user --transport http \
            --header "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}" \
            context7 https://mcp.context7.com/mcp
        else
          claude mcp add --scope user --transport http \
            context7 https://mcp.context7.com/mcp
        fi
      fi
      echo "  context7 MCP installed."
    fi
  else
    echo "  Installing context7 MCP..."
    if [ -z "${CONTEXT7_API_KEY:-}" ]; then
      echo -n "  Enter your Context7 API key (optional — press Enter to skip, get one at https://context7.com/dashboard): "
      read -r CONTEXT7_API_KEY
    fi
    if [ -n "${CONTEXT7_API_KEY:-}" ]; then
      claude mcp add --scope user --transport http \
        --header "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}" \
        context7 https://mcp.context7.com/mcp
    else
      claude mcp add --scope user --transport http \
        context7 https://mcp.context7.com/mcp
    fi
    echo "  context7 MCP installed."
  fi
fi

# ---------------------------------------------------------------------------
# Playwright
# ---------------------------------------------------------------------------
if mcp_installed "playwright"; then
  echo "  playwright: already installed, skipping."
else
  if [ "$INTERACTIVE" = true ]; then
    if prompt_yn "Install Playwright MCP (browser automation & UI testing)? [y/N]: "; then
      scope=$(prompt_scope "playwright")
      if [ "$scope" = "project" ] && [ -n "$PROJECT_DIR" ]; then
        ( cd "$PROJECT_DIR" && \
          claude mcp add --scope project playwright -- npx @playwright/mcp@latest )
      else
        claude mcp add --scope user playwright -- npx @playwright/mcp@latest
      fi
      echo "  playwright MCP installed."
    fi
  else
    echo "  Installing playwright MCP..."
    claude mcp add --scope user playwright -- npx @playwright/mcp@latest
    echo "  playwright MCP installed."
  fi
fi
