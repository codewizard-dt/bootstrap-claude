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
echo "To add a key later:"
echo "  claude mcp remove brave-search -s user"
echo "  claude mcp add --scope user brave-search --env BRAVE_API_KEY=<key> -- npx -y @modelcontextprotocol/server-brave-search"
echo ""
echo "  claude mcp remove context7 -s user"
echo "  claude mcp add --scope user --transport http --header \"CONTEXT7_API_KEY: <key>\" context7 https://mcp.context7.com/mcp"
