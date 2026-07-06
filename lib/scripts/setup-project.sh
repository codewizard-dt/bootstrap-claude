#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

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

# 1. Install MCPs interactively, then skills + hooks globally
echo "Checking MCP servers..."
"$SCRIPT_DIR/install-mcps.sh" --interactive --project-dir "$PROJECT_DIR"
echo ""
echo "Installing skills and hooks globally..."
"$SCRIPT_DIR/install-global.sh" --skip-mcps
echo ""

echo "Syncing wiki scaffold..."
"$SCRIPT_DIR/sync-wiki-scaffold.sh" "$PROJECT_DIR"
"$SCRIPT_DIR/merge-gitignore.sh" "$PROJECT_DIR"
echo ""

# 2. Assemble mcp-tools.md guide for only the installed MCPs
echo "Building MCP tools guide..."
INSTALLED_MCPS=()
if [ -f "$PROJECT_DIR/.mcp.json" ] && grep -q '"serena"' "$PROJECT_DIR/.mcp.json" 2>/dev/null; then
  INSTALLED_MCPS+=("serena")
fi
for mcp in context7 brave-search playwright; do
  if claude mcp get "$mcp" &>/dev/null; then
    INSTALLED_MCPS+=("$mcp")
  fi
done
"$SCRIPT_DIR/build-mcp-guide.sh" "$PROJECT_DIR" "${INSTALLED_MCPS[@]+"${INSTALLED_MCPS[@]}"}"
echo ""

# 3. Bootstrap Serena project.yml
echo "Bootstrapping Serena project.yml..."
"$SCRIPT_DIR/bootstrap-serena.sh" "$PROJECT_DIR"
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
