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
mkdir -p "$PROJECT_DIR/.docs/tasks"
mkdir -p "$PROJECT_DIR/.docs/tasks/completed"
mkdir -p "$PROJECT_DIR/.docs/uat"
mkdir -p "$PROJECT_DIR/.docs/uat/completed"
mkdir -p "$PROJECT_DIR/.docs/uat/skipped"
mkdir -p "$PROJECT_DIR/.docs/uat/screenshots"
mkdir -p "$PROJECT_DIR/.docs/adr"
mkdir -p "$PROJECT_DIR/.docs/adr/completed"
mkdir -p "$PROJECT_DIR/.docs/prd"
mkdir -p "$PROJECT_DIR/.docs/prd/archived"
mkdir -p "$PROJECT_DIR/.docs/bugs"
mkdir -p "$PROJECT_DIR/.docs/bugs/in-progress"
mkdir -p "$PROJECT_DIR/.docs/bugs/closed"
mkdir -p "$PROJECT_DIR/.docs/roadmaps"
mkdir -p "$PROJECT_DIR/.docs/roadmaps/completed"
mkdir -p "$PROJECT_DIR/.claude/skills"

# Sync .docs/guides/ as a full directory (entire contents, no filters)
rsync -av "$TEMPLATE_DIR/.docs/guides/" "$PROJECT_DIR/.docs/guides/"

# Sync .docs/tasks/ root .gitkeep only (task files are project-specific and MUST NOT be copied)
rsync -av "$TEMPLATE_DIR/.docs/tasks/.gitkeep" "$PROJECT_DIR/.docs/tasks/"

# Sync .docs/tasks/completed/.gitkeep only
rsync -av "$TEMPLATE_DIR/.docs/tasks/completed/.gitkeep" "$PROJECT_DIR/.docs/tasks/completed/"

# Explicitly DO NOT sync .docs/tasks/README.md (top-level task index is project-specific)

# Sync .docs/uat/ root .gitkeep (UAT files live here directly; no pending/ subfolder)
rsync -av "$TEMPLATE_DIR/.docs/uat/.gitkeep" "$PROJECT_DIR/.docs/uat/"

# Loop over UAT subfolders and sync only .gitkeep from each
for sub in completed skipped screenshots; do
  rsync -av "$TEMPLATE_DIR/.docs/uat/$sub/.gitkeep" "$PROJECT_DIR/.docs/uat/$sub/"
done

# Sync .docs/adr/ README + .gitkeep only — ADR files are project-specific and MUST NOT be copied
rsync -av "$TEMPLATE_DIR/.docs/adr/README.md" "$TEMPLATE_DIR/.docs/adr/.gitkeep" "$PROJECT_DIR/.docs/adr/"
rsync -av "$TEMPLATE_DIR/.docs/adr/completed/.gitkeep" "$PROJECT_DIR/.docs/adr/completed/"

# Sync .docs/prd/ README + per-subfolder .gitkeep only — PRD files are project-specific and MUST NOT be copied
rsync -av "$TEMPLATE_DIR/.docs/prd/README.md" "$PROJECT_DIR/.docs/prd/"
for sub in archived; do
  rsync -av "$TEMPLATE_DIR/.docs/prd/$sub/.gitkeep" "$PROJECT_DIR/.docs/prd/$sub/"
done

# Sync .docs/bugs/ README + per-subfolder .gitkeep only — bug records are project-specific and MUST NOT be copied
rsync -av "$TEMPLATE_DIR/.docs/bugs/README.md" "$PROJECT_DIR/.docs/bugs/"
for sub in in-progress closed; do
  rsync -av "$TEMPLATE_DIR/.docs/bugs/$sub/.gitkeep" "$PROJECT_DIR/.docs/bugs/$sub/"
done

# Sync .docs/roadmaps/ README + .gitkeep only — roadmap files are project-specific and MUST NOT be copied
rsync -av "$TEMPLATE_DIR/.docs/roadmaps/README.md" "$TEMPLATE_DIR/.docs/roadmaps/.gitkeep" "$PROJECT_DIR/.docs/roadmaps/"
rsync -av "$TEMPLATE_DIR/.docs/roadmaps/completed/.gitkeep" "$PROJECT_DIR/.docs/roadmaps/completed/"

# Sync .claude/skills/ (all skill directories and SKILL.md files)
rsync -av "$TEMPLATE_DIR/.claude/skills/" "$PROJECT_DIR/.claude/skills/"

echo ".docs/ scaffold and .claude/skills/ synced."
