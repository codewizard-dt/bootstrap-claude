#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-project>" >&2
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

# Ensure destination scaffold directories exist
mkdir -p "$PROJECT_DIR/.docs/guides"
mkdir -p "$PROJECT_DIR/.docs/tasks/active"
mkdir -p "$PROJECT_DIR/.docs/tasks/completed"
mkdir -p "$PROJECT_DIR/.docs/tasks/trashed"
mkdir -p "$PROJECT_DIR/.docs/uat/pending"
mkdir -p "$PROJECT_DIR/.docs/uat/completed"
mkdir -p "$PROJECT_DIR/.docs/uat/skipped"
mkdir -p "$PROJECT_DIR/.docs/uat/trashed"
mkdir -p "$PROJECT_DIR/.docs/uat/screenshots"
mkdir -p "$PROJECT_DIR/.docs/adr"
mkdir -p "$PROJECT_DIR/.docs/prd/active"
mkdir -p "$PROJECT_DIR/.docs/prd/archived"
mkdir -p "$PROJECT_DIR/.docs/prd/trashed"
mkdir -p "$PROJECT_DIR/.claude/skills"

# Sync .docs/guides/ as a full directory (entire contents, no filters)
rsync -av "$TEMPLATE_DIR/.docs/guides/" "$PROJECT_DIR/.docs/guides/"

# Sync .docs/tasks/active/ README + .gitkeep only (task files MUST NOT be copied)
rsync -av "$TEMPLATE_DIR/.docs/tasks/active/README.md" "$TEMPLATE_DIR/.docs/tasks/active/.gitkeep" "$PROJECT_DIR/.docs/tasks/active/"

# Sync .docs/tasks/completed/.gitkeep only
rsync -av "$TEMPLATE_DIR/.docs/tasks/completed/.gitkeep" "$PROJECT_DIR/.docs/tasks/completed/"

# Sync .docs/tasks/trashed/.gitkeep only
rsync -av "$TEMPLATE_DIR/.docs/tasks/trashed/.gitkeep" "$PROJECT_DIR/.docs/tasks/trashed/"

# Explicitly DO NOT sync .docs/tasks/README.md (top-level task index is project-specific)

# Loop over UAT subfolders and sync only .gitkeep from each
for sub in pending completed skipped trashed screenshots; do
  rsync -av "$TEMPLATE_DIR/.docs/uat/$sub/.gitkeep" "$PROJECT_DIR/.docs/uat/$sub/"
done

# Sync .docs/adr/ README + .gitkeep only — ADR files are project-specific and MUST NOT be copied
rsync -av "$TEMPLATE_DIR/.docs/adr/README.md" "$TEMPLATE_DIR/.docs/adr/.gitkeep" "$PROJECT_DIR/.docs/adr/"

# Sync .docs/prd/ README + per-subfolder .gitkeep only — PRD files are project-specific and MUST NOT be copied
rsync -av "$TEMPLATE_DIR/.docs/prd/README.md" "$PROJECT_DIR/.docs/prd/"
for sub in active archived trashed; do
  rsync -av "$TEMPLATE_DIR/.docs/prd/$sub/.gitkeep" "$PROJECT_DIR/.docs/prd/$sub/"
done

# Sync .claude/skills/ (all skill directories and SKILL.md files)
rsync -av "$TEMPLATE_DIR/.claude/skills/" "$PROJECT_DIR/.claude/skills/"

echo ".docs/ scaffold and .claude/skills/ synced."
