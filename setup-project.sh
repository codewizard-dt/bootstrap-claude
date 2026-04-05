#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"

# 0. Preflight checks
if ! command -v claude &> /dev/null; then
  echo "Error: 'claude' (Claude Code) is not installed."
  echo "Install it with: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

if ! command -v uv &> /dev/null; then
  echo "Error: 'uv' is not installed."
  echo "Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-project>"
  exit 1
fi

# Resolve relative paths (e.g., ".") to absolute by cd-ing into the dir and printing pwd.
# If the path doesn't exist or can't be resolved, cd fails and we catch it with ||.
PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)" || {
  echo "Error: Cannot resolve path: $1"
  exit 1
}

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR"
  exit 1
fi

echo "Setting up project: $PROJECT_DIR"
echo ""

# 1. Ensure global MCP servers are installed (user scope)
echo "Checking global MCP servers (user scope)..."

# brave-search
if claude mcp get "brave-search" &>/dev/null; then
  echo "  brave-search: already installed, skipping."
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

# context7
if claude mcp get "context7" &>/dev/null; then
  echo "  context7: already installed, skipping."
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
    claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp
  fi
  echo "  context7 MCP installed."
fi

# puppeteer-mcp-claude
if claude mcp get "puppeteer-mcp-claude" &>/dev/null; then
  echo "  puppeteer-mcp-claude: already installed, skipping."
else
  echo "  Installing puppeteer-mcp-claude MCP..."
  claude mcp add --scope user puppeteer-mcp-claude -- npx puppeteer-mcp-claude serve
  echo "  puppeteer-mcp-claude MCP installed."
fi
echo ""

# 2. Add Serena MCP for this project
echo "Adding Serena MCP..."
cd "$PROJECT_DIR"
if claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$PROJECT_DIR" 2>&1; then
  echo "Serena MCP added."
else
  echo "Serena MCP already configured for this project, skipping."
fi
echo ""

# 3. Copy .claude and docs directories
echo "Copying .claude/ commands and .docs/..."
mkdir -p "$PROJECT_DIR/.claude"
rsync -av "$TEMPLATE_DIR/.claude/" "$PROJECT_DIR/.claude/"
echo "Copied .claude/ to $PROJECT_DIR/.claude"
mkdir -p "$PROJECT_DIR/.docs"
rsync -av "$TEMPLATE_DIR/.docs/" "$PROJECT_DIR/.docs/"
echo "Copied .docs/ to $PROJECT_DIR/.docs"
echo ""

# Done
echo "============================="
echo "  Setup complete!"
echo "============================="
echo ""
echo "Next steps:"
echo "  1. cd $PROJECT_DIR"
echo "  2. Open Claude Code: claude"
echo "  3. Run /init to initialize the project"
echo "  4. Run /primer to set up Serena's memory structure"
echo ""
echo "API keys (if you skipped any during setup):"
echo "  brave-search  BRAVE_API_KEY  https://brave.com/search/api/"
echo "  context7      CONTEXT7_API_KEY (optional)  https://context7.com/dashboard"
echo ""
echo "To add a key later:"
echo "  claude mcp remove brave-search -s user"
echo "  claude mcp add --scope user brave-search --env BRAVE_API_KEY=<key> -- npx -y @modelcontextprotocol/server-brave-search"
echo ""
echo "  claude mcp remove context7 -s user"
echo "  claude mcp add --scope user --transport http --header \"CONTEXT7_API_KEY: <key>\" context7 https://mcp.context7.com/mcp"
