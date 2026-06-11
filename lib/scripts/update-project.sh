#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

echo "Updating project: $PROJECT_DIR"
echo ""

# 1. Install MCPs, hooks, and skills globally (also cleans stale renamed skills)
echo "Installing skills globally (~/.claude/skills/)..."
"$SCRIPT_DIR/install-global.sh"
echo ""

# 2. Sync the wiki scaffold (copy-once) and guides (always refreshed)
echo "Syncing wiki scaffold..."
"$SCRIPT_DIR/sync-wiki-scaffold.sh" "$PROJECT_DIR"
"$SCRIPT_DIR/merge-gitignore.sh" "$PROJECT_DIR"
echo ""

# 3. Register Serena per-project if not already registered
echo "Checking Serena MCP registration for this project..."
if [ -f "$PROJECT_DIR/.mcp.json" ] && grep -q '"serena"' "$PROJECT_DIR/.mcp.json" 2>/dev/null; then
  echo "  serena: already registered for this project, skipping."
else
  ( cd "$PROJECT_DIR" && \
    claude mcp add --scope project serena -- \
      uvx --from git+https://github.com/oraios/serena \
      serena start-mcp-server --context claude-code --project "$PROJECT_DIR" )
  echo "  serena MCP registered."
fi
echo ""

# 4. Bootstrap Serena project.yml (idempotent)
echo "Re-checking Serena project.yml bootstrap..."
"$SCRIPT_DIR/bootstrap-serena.sh" "$PROJECT_DIR"
echo ""

# Done
echo "============================="
echo "  Update complete!"
echo "============================="
