#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

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

PROJECT_DIR="$(resolve_project_dir "$1")" || exit 1

echo "Setting up project: $PROJECT_DIR"
echo ""

# Shared setup/update sequence: MCPs, skills+hooks, wiki scaffold, MCP guide, Serena.
run_project_sync "$PROJECT_DIR" "$SCRIPT_DIR"

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
echo "  5. Drop source documents into raw/ and run /wiki-ingest <file> to grow the wiki"
echo "  6. Optional: run 'npx @codewizard-dt/bootstrap deploy' when you explicitly want deployment scaffolding"
echo ""
echo "API keys (if you skipped any during setup):"
echo "  brave-search  BRAVE_API_KEY  https://brave.com/search/api/"
echo "  context7      CONTEXT7_API_KEY (optional)  https://context7.com/dashboard"
echo ""
echo "To add a Brave key later:"
echo "  export BRAVE_API_KEY=<key>, then re-run 'npx @codewizard-dt/bootstrap update' (starts the container and registers the server), or manually:"
echo "  BRAVE_API_KEY=<key> docker run -d --restart unless-stopped --name brave-search-mcp -e BRAVE_API_KEY -p \"127.0.0.1:8941:8941\" docker.io/mcp/brave-search --transport http --host 0.0.0.0 --port 8941"
echo "  claude mcp add --scope user --transport http brave-search http://127.0.0.1:8941/mcp"
echo ""
echo "To rotate the Brave API key:"
echo "  docker rm -f brave-search-mcp, then re-run 'npx @codewizard-dt/bootstrap update' (recreates the container with the new key)"
echo ""
echo "To update the brave-search server image:"
echo "  docker rm -f brave-search-mcp && docker pull docker.io/mcp/brave-search   (then re-run 'bootstrap update' to recreate the container)"
echo ""
echo "To restart or update the playwright server (macOS launchd agent):"
echo "  npm i -g @playwright/mcp@latest && launchctl kickstart -k gui/\$(id -u)/com.bootstrap-claude.playwright-mcp"
echo ""
echo "Ports: brave-search 8941, playwright 8931 — override via BRAVE_MCP_PORT / PLAYWRIGHT_MCP_PORT env vars set before running setup/update"
echo ""
echo "To add a Context7 key later:"
echo "  claude mcp remove context7 -s user"
echo "  claude mcp add --scope user --transport http --header \"CONTEXT7_API_KEY: <key>\" context7 https://mcp.context7.com/mcp"
