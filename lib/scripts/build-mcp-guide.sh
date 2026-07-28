#!/usr/bin/env bash
set -euo pipefail

# build-mcp-guide.sh <project-dir> [mcp-name...]
#
# Assembles .docs/guides/mcp-tools.md in the target project from per-server stubs.
# Only sections for the listed MCP names are included.
#
# Valid MCP names: serena  context7  brave-search  playwright
#
# Example:
#   build-mcp-guide.sh /path/to/project serena context7

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STUBS_DIR="$SCRIPT_DIR/templates/guides/stubs"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <project-dir> [mcp-name...]" >&2
  exit 1
fi

PROJECT_DIR="$1"; shift
INSTALLED_MCPS=("$@")

OUT="$PROJECT_DIR/.docs/guides/mcp-tools.md"

has_mcp() {
  local name="$1"
  for m in "${INSTALLED_MCPS[@]+"${INSTALLED_MCPS[@]}"}"; do
    [ "$m" = "$name" ] && return 0
  done
  return 1
}

mkdir -p "$PROJECT_DIR/.docs/guides"

{
  # 1. Always: title + TOP RULE
  cat "$STUBS_DIR/00-header.md"
  echo ""

  # 2. MANDATORY table (only for installed MCPs)
  if [ ${#INSTALLED_MCPS[@]} -gt 0 ]; then
    cat <<'EOF'
## MANDATORY: MCP Tool Requirements

These MCP servers are **REQUIRED** for all applicable operations. Using standard tools when an MCP tool exists is a violation of project rules.

| MCP Server | Mandatory For | Replaces |
|------------|--------------|----------|
EOF
    if has_mcp "serena"; then
      echo "| **Serena** | All **code** exploration and editing; **all** file/directory exploration and search (code, markdown, config, anything) | \`Read\`, \`Edit\`, \`Write\`, \`Grep\`, \`Glob\` (for code files); \`bash\` exploration commands (\`ls\`, \`cat\`, \`find\`, \`grep\`, \`sed\`, \`awk\`, \`head\`, \`tail\`, \`tree\`) for **any** file type |"
    fi
    if has_mcp "context7"; then
      echo "| **Context7** | All library/framework documentation lookups | WebSearch, WebFetch (for library docs) |"
    fi
    if has_mcp "brave-search"; then
      echo "| **Brave Search** | All general web research | WebSearch (for non-library topics) |"
    fi
    if has_mcp "playwright"; then
      echo "| **Playwright** | Browser automation, screenshots, UI interaction | WebFetch (for rendered pages) |"
    fi
    echo ""
    echo "---"
    echo ""
  fi

  # 3. Per-server stubs (in canonical order)
  if has_mcp "serena";       then cat "$STUBS_DIR/serena.md";       echo ""; fi
  if has_mcp "context7";     then cat "$STUBS_DIR/context7.md";     echo ""; fi
  if has_mcp "brave-search"; then cat "$STUBS_DIR/brave-search.md"; echo ""; fi
  if has_mcp "playwright";   then cat "$STUBS_DIR/playwright.md";   echo ""; fi

  # 4. Quick Reference table (always present; rows per installed MCP)
  cat <<'EOF'
## Quick Reference: Which Tool for What

| Task | MUST Use | NEVER Use |
|------|----------|-----------|
| Read markdown content | Standard `Read` | `cat`, `head`, `tail` |
| Edit markdown content | Standard `Edit` / `Write` | `sed`, `awk`, `echo >>` |
| Edit config files (JSON, YAML, .env) | Standard `Read`/`Edit`/`Write` | `sed` |
EOF
  if has_mcp "serena"; then
    cat <<'EOF'
| Explore code structure | Serena `get_symbols_overview` | `Read` on code files, `cat` |
| Find function/class | Serena `find_symbol` | `Grep` on code files, `bash grep` |
| Edit code | Serena symbolic or file/line tools | Standard `Edit` on code files, `sed` |
| Rename symbol | Serena `rename_symbol` | Manual find-and-replace |
| Search file contents | Serena `search_for_pattern` or `Grep` tool | `bash grep` / `rg` / `ag` |
| List a directory | Serena `list_dir` | `ls`, `tree`, `find -type d` |
| Find files by name | Serena `find_file` or `Glob` tool | `find -name`, `ls \| grep` |
EOF
  fi
  if has_mcp "context7"; then
    echo "| Library docs | Context7 | \`WebSearch\` / \`WebFetch\` |"
  fi
  if has_mcp "brave-search"; then
    echo "| General research | Brave Search (parallel, up to 50/sec) | \`WebSearch\` |"
  fi
  if has_mcp "playwright"; then
    echo "| Browser interaction | Playwright | \`WebFetch\` for rendered content |"
  fi

} > "$OUT"

echo "  mcp-tools.md assembled for: ${INSTALLED_MCPS[*]+"${INSTALLED_MCPS[*]}"} → $OUT"
