#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"

# Orphan skill folders from the noun-first rename (task 008-rename-skills-noun-first)
ORPHAN_SKILLS=(
  create-prd finalize-prd prd-to-decisions update-prd trash-prd
  create-adr finalize-adr walkthrough-adr
  add-task update-task trash-task
  file-bug triage-bug close-bug
  uat uat-generator
  create-roadmap add-to-roadmap next-step
)

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

# playwright
if claude mcp get "playwright" &>/dev/null; then
  echo "  playwright: already installed, skipping."
else
  echo "  Installing playwright MCP..."
  claude mcp add --scope user playwright -- npx @playwright/mcp@latest
  echo "  playwright MCP installed."
fi


# 2. Install hooks globally
GLOBAL_HOOKS_DIR="$HOME/.claude/hooks"
if [ -d "$TEMPLATE_DIR/.claude/hooks" ]; then
  echo "Installing hooks globally (~/.claude/hooks/)..."
  mkdir -p "$GLOBAL_HOOKS_DIR"
  rsync -av --exclude='.DS_Store' "$TEMPLATE_DIR/.claude/hooks/" "$GLOBAL_HOOKS_DIR/"
  echo ""
fi

# 3. Install skills globally
echo "Installing skills globally (~/.claude/skills/)..."

# Ensure the global skills directory exists
mkdir -p "$GLOBAL_SKILLS_DIR"

# Rsync skills from the template to ~/.claude/skills/
rsync -av --exclude='.DS_Store' "$TEMPLATE_DIR/.claude/skills/" "$GLOBAL_SKILLS_DIR/"

# Detect orphan skill folders from the noun-first rename
ORPHAN_FOUND=()
for skill in "${ORPHAN_SKILLS[@]}"; do
  if [ -d "$GLOBAL_SKILLS_DIR/$skill" ]; then
    ORPHAN_FOUND+=("$GLOBAL_SKILLS_DIR/$skill")
  fi
done

if [ ${#ORPHAN_FOUND[@]} -gt 0 ]; then
  echo ""
  echo "Orphan skill folders detected from the noun-first rename:"
  for p in "${ORPHAN_FOUND[@]}"; do
    echo "  $p"
  done
  echo ""
  if [ -t 0 ]; then
    read -r -p "Delete these ${#ORPHAN_FOUND[@]} folder(s)? [y/N]: " REPLY
    case "$REPLY" in
      [yY])
        for p in "${ORPHAN_FOUND[@]}"; do
          rm -rf "$p"
        done
        echo "Removed."
        ;;
      *)
        echo "Skipped. To remove manually: rm -rf ~/.claude/skills/{create-prd,finalize-prd,prd-to-decisions,update-prd,trash-prd,create-adr,finalize-adr,walkthrough-adr,add-task,update-task,trash-task,file-bug,triage-bug,close-bug,uat,uat-generator,create-roadmap,add-to-roadmap,next-step}"
        ;;
    esac
  else
    echo "Non-interactive mode: skipping deletion. Remove manually if needed."
  fi
fi

echo "Global setup complete (MCPs + skills)."
