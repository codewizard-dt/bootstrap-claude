#!/usr/bin/env bash
set -euo pipefail


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

# Preflight checks
if ! command -v claude &>/dev/null; then
  echo "Error: 'claude' (Claude Code) is not installed."
  echo "Install it with: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "Error: 'python3' is not installed."
  exit 1
fi

echo "Bootstrapping Serena for: $PROJECT_DIR"

cd "$PROJECT_DIR"

if [ ! -f ".serena/project.yml" ]; then
  echo "Triggering Claude Code to initialize Serena (.serena/ will be created)..."
  claude --print "exit" >/dev/null 2>&1 || true
  if [ ! -f ".serena/project.yml" ]; then
    echo "Error: .serena/project.yml was not created by 'claude --print'. Ensure Serena MCP is registered for this project (run setup-project.sh first)."
    exit 1
  fi
else
  echo ".serena/project.yml already exists, skipping claude --print step."
fi

PROJECT_YML="$PROJECT_DIR/.serena/project.yml"
REPLACED=$(python3 - "$PROJECT_YML" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
text = p.read_text()
needle = "included_optional_tools: []"
repl = (
    "included_optional_tools:\n"
    "  - list_dir\n"
    "  - find_file\n"
    "  - find_symbol\n"
    "  - find_referencing_symbols\n"
    "  - search_for_pattern\n"
    "  - replace_content\n"
    "  - replace_lines\n"
    "  - insert_at_line\n"
    "  - insert_after_symbol\n"
    "  - insert_before_symbol\n"
    "  - delete_lines"
)
count = text.count(needle)
if count:
    p.write_text(text.replace(needle, repl, 1))
print(count)
PY
)

if [ "$REPLACED" = "0" ]; then
  echo "Serena optional tools already configured, skipping."
  exit 0
elif [ "$REPLACED" = "1" ]; then
  echo "added 11 optional tools"
  exit 0
else
  echo "Warning: replaced $REPLACED occurrences of the marker (expected 1)"
  exit 0
fi
