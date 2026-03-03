#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <absolute-path-to-project>"
  exit 1
fi

PROJECT_DIR="$1"

if [[ "$PROJECT_DIR" != /* ]]; then
  echo "Error: Path must be absolute (start with /)"
  exit 1
fi

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR"
  exit 1
fi

echo "Setting up project: $PROJECT_DIR"
echo ""

# 1. Add Serena MCP for this project
echo "Adding Serena MCP..."
cd "$PROJECT_DIR"
if claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$PROJECT_DIR" 2>&1; then
  echo "Serena MCP added."
else
  echo "Serena MCP already configured for this project, skipping."
fi
echo ""

# 2. Copy .claude and docs directories
echo "Copying .claude/ commands and .docs/..."
cp -r "$TEMPLATE_DIR/.claude" "$PROJECT_DIR/.claude"
echo "Copied .claude/ to $PROJECT_DIR/.claude"
cp -r "$TEMPLATE_DIR/docs" "$PROJECT_DIR/docs"
echo "Copied .docs/ to $PROJECT_DIR/docs"
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
