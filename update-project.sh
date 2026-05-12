#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"

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

# Orphan skill folders from the noun-first rename (task 008-rename-skills-noun-first)
ORPHAN_SKILLS=(
  create-prd finalize-prd prd-to-decisions update-prd trash-prd
  create-adr finalize-adr walkthrough-adr
  add-task update-task trash-task
  file-bug triage-bug close-bug
  uat uat-generator
  create-roadmap add-to-roadmap next-step
)

# 1. Detect legacy .claude/commands/ files migrated to .claude/skills/
# The migration moved each <name>.md slash-command into .claude/skills/<name>/SKILL.md.
# If any of those legacy files still exist in the target, offer to remove them.
LEGACY_COMMANDS_DIR="$PROJECT_DIR/.claude/commands"
if [ -d "$LEGACY_COMMANDS_DIR" ]; then
  LEGACY_FILES=()
  for skill_dir in "$TEMPLATE_DIR/.claude/skills/"*/; do
    skill_name="$(basename "$skill_dir")"
    legacy_file="$LEGACY_COMMANDS_DIR/$skill_name.md"
    if [ -f "$legacy_file" ]; then
      LEGACY_FILES+=("$legacy_file")
    fi
  done

  if [ ${#LEGACY_FILES[@]} -gt 0 ]; then
    echo "Found legacy slash-command files in $LEGACY_COMMANDS_DIR/ that have been migrated to .claude/skills/:"
    for f in "${LEGACY_FILES[@]}"; do
      echo "  - ${f#"$PROJECT_DIR"/}"
    done
    echo ""
    read -r -p "Remove these legacy command files? [y/N] " REPLY
    if [[ "$REPLY" =~ ^[Yy]$ ]]; then
      for f in "${LEGACY_FILES[@]}"; do
        rm -f "$f"
        echo "  Removed: ${f#"$PROJECT_DIR"/}"
      done
      # If .claude/commands/ is now empty (no files, no subdirs), remove the directory.
      if [ -z "$(ls -A "$LEGACY_COMMANDS_DIR")" ]; then
        rmdir "$LEGACY_COMMANDS_DIR"
        echo "  Removed empty directory: .claude/commands/"
      else
        echo "  Note: .claude/commands/ retained — other (project-specific) files remain."
      fi
    else
      echo "  Skipped legacy command cleanup."
    fi
    echo ""
  fi
fi

# 2. Sync .claude/skills/ and .docs/
echo "Syncing .claude/skills/ and .docs/ scaffold..."
"$TEMPLATE_DIR/sync-docs-scaffold.sh" "$PROJECT_DIR"
echo ""

# Detect orphan skill folders from the noun-first rename
ORPHAN_FOUND=()
for skill in "${ORPHAN_SKILLS[@]}"; do
  if [ -d "$PROJECT_DIR/.claude/skills/$skill" ]; then
    ORPHAN_FOUND+=("$PROJECT_DIR/.claude/skills/$skill")
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
        echo "Skipped. To remove manually: rm -rf .claude/skills/{create-prd,finalize-prd,prd-to-decisions,update-prd,trash-prd,create-adr,finalize-adr,walkthrough-adr,add-task,update-task,trash-task,file-bug,triage-bug,close-bug,uat,uat-generator,create-roadmap,add-to-roadmap,next-step}"
        ;;
    esac
  else
    echo "Non-interactive mode: skipping deletion. Remove manually if needed."
  fi
fi

# 3. Bootstrap Serena project.yml (idempotent)
echo "Re-checking Serena project.yml bootstrap..."
"$TEMPLATE_DIR/bootstrap-serena.sh" "$PROJECT_DIR"
echo ""

# Done
echo "============================="
echo "  Update complete!"
echo "============================="
