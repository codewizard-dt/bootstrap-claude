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

# 1b. Detect per-project .claude/skills/ copies of skills THIS REPO installs globally
PROJECT_SKILLS_DIR="$PROJECT_DIR/.claude/skills"
if [ -d "$PROJECT_SKILLS_DIR" ]; then
  # Only flag skill directories whose names match skills installed by this repo
  PER_PROJECT_SKILLS=()
  for skill_dir in "$TEMPLATE_DIR/.claude/skills/"*/; do
    skill_name="$(basename "$skill_dir")"
    project_skill="$PROJECT_SKILLS_DIR/$skill_name"
    [ -f "$project_skill/SKILL.md" ] && PER_PROJECT_SKILLS+=("$project_skill/")
  done

  if [ ${#PER_PROJECT_SKILLS[@]} -gt 0 ]; then
    echo ""
    echo "Per-project skill folders detected in .claude/skills/ (skills are now global — these should be deleted):"
    for p in "${PER_PROJECT_SKILLS[@]}"; do
      echo "  ${p#"$PROJECT_DIR"/}"
    done
    echo ""
    echo "  Skills are now installed globally to ~/.claude/skills/ and no longer need to live in each project."
    echo ""
    if [ -t 0 ]; then
      read -r -p "Delete these ${#PER_PROJECT_SKILLS[@]} per-project skill folder(s)? [y/N]: " REPLY
      case "$REPLY" in
        [yY])
          for p in "${PER_PROJECT_SKILLS[@]}"; do
            rm -rf "$p"
          done
          echo "  Removed."
          # If .claude/skills/ is now empty, remove it too
          if [ -z "$(ls -A "$PROJECT_SKILLS_DIR" 2>/dev/null)" ]; then
            rmdir "$PROJECT_SKILLS_DIR"
            echo "  Removed empty directory: .claude/skills/"
          fi
          ;;
        *)
          echo "  Skipped. Remove manually: rm -rf $PROJECT_SKILLS_DIR"
          ;;
      esac
    else
      echo "  Non-interactive mode: skipping per-project skill cleanup. Remove manually if desired."
    fi
    echo ""
  fi
fi

# 2. Install skills globally and sync .docs/ scaffold
echo "Installing skills globally (~/.claude/skills/)..."
"$TEMPLATE_DIR/install-global.sh"
echo ""

echo "Syncing .docs/ scaffold..."
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

# Also clean up orphan skill folders at global level (~/.claude/skills/)
GLOBAL_ORPHAN_FOUND=()
for skill in "${ORPHAN_SKILLS[@]}"; do
  if [ -d "$HOME/.claude/skills/$skill" ]; then
    GLOBAL_ORPHAN_FOUND+=("$HOME/.claude/skills/$skill")
  fi
done

if [ ${#GLOBAL_ORPHAN_FOUND[@]} -gt 0 ]; then
  echo ""
  echo "Orphan skill folders detected in global ~/.claude/skills/ from the noun-first rename:"
  for p in "${GLOBAL_ORPHAN_FOUND[@]}"; do
    echo "  $p"
  done
  echo ""
  if [ -t 0 ]; then
    read -r -p "Delete these ${#GLOBAL_ORPHAN_FOUND[@]} global folder(s)? [y/N]: " REPLY
    case "$REPLY" in
      [yY])
        for p in "${GLOBAL_ORPHAN_FOUND[@]}"; do
          rm -rf "$p"
        done
        echo "Removed."
        ;;
      *)
        echo "Skipped."
        ;;
    esac
  else
    echo "Non-interactive mode: skipping global orphan deletion."
  fi
fi

# 3. Migrate files from old active/pending/open subfolders to parent directories
# These subfolders were removed in favour of flat placement (files go directly under the parent).
declare -A LEGACY_SUBDIRS=(
  [".docs/tasks/active"]=".docs/tasks"
  [".docs/uat/pending"]=".docs/uat"
  [".docs/bugs/open"]=".docs/bugs"
  [".docs/prd/active"]=".docs/prd"
)

MIGRATE_FOUND=()
for subdir in "${!LEGACY_SUBDIRS[@]}"; do
  legacy_path="$PROJECT_DIR/$subdir"
  if [ -d "$legacy_path" ]; then
    # Count moveable files (non-.gitkeep markdown files, skip README which was an index)
    shopt -s nullglob
    moveable=("$legacy_path"/*.md)
    shopt -u nullglob
    # Filter out README.md (old active index, not a content file)
    real_files=()
    for f in "${moveable[@]}"; do
      [[ "$(basename "$f")" != "README.md" ]] && real_files+=("$f")
    done
    if [ ${#real_files[@]} -gt 0 ] || [ -d "$legacy_path" ]; then
      MIGRATE_FOUND+=("$subdir")
    fi
  fi
done

if [ ${#MIGRATE_FOUND[@]} -gt 0 ]; then
  echo ""
  echo "Legacy subdirectories detected (flat layout now; files belong in the parent folder):"
  for subdir in "${MIGRATE_FOUND[@]}"; do
    parent="${LEGACY_SUBDIRS[$subdir]}"
    legacy_path="$PROJECT_DIR/$subdir"
    shopt -s nullglob
    moveable=("$legacy_path"/*.md)
    shopt -u nullglob
    real_files=()
    for f in "${moveable[@]}"; do
      [[ "$(basename "$f")" != "README.md" ]] && real_files+=("$f")
    done
    if [ ${#real_files[@]} -gt 0 ]; then
      echo "  $subdir/ → $parent/  (${#real_files[@]} file(s))"
      for f in "${real_files[@]}"; do echo "    $(basename "$f")"; done
    else
      echo "  $subdir/  (empty — will be removed)"
    fi
  done
  echo ""
  if [ -t 0 ]; then
    read -r -p "Move files to parent folders and remove legacy subdirectories? [y/N]: " REPLY
    case "$REPLY" in
      [yY])
        for subdir in "${MIGRATE_FOUND[@]}"; do
          parent="${LEGACY_SUBDIRS[$subdir]}"
          legacy_path="$PROJECT_DIR/$subdir"
          dest_path="$PROJECT_DIR/$parent"
          shopt -s nullglob
          moveable=("$legacy_path"/*.md)
          shopt -u nullglob
          for f in "${moveable[@]}"; do
            fname="$(basename "$f")"
            [[ "$fname" == "README.md" ]] && continue
            if [ -e "$dest_path/$fname" ]; then
              echo "  Skipped (already exists): $parent/$fname"
            else
              mv "$f" "$dest_path/$fname"
              echo "  Moved: $subdir/$fname → $parent/$fname"
            fi
          done
          rm -rf "$legacy_path"
          echo "  Removed: $subdir/"
        done
        ;;
      *)
        echo "  Skipped legacy subfolder migration."
        ;;
    esac
  else
    echo "Non-interactive mode: skipping legacy subfolder migration. Move manually if needed."
  fi
  echo ""
fi

# 4. Offer to delete legacy trashed/ subfolders (trashed items are now deleted outright, not archived)
TRASHED_SUBDIRS=(
  ".docs/tasks/trashed"
  ".docs/uat/trashed"
  ".docs/bugs/trashed"
  ".docs/prd/trashed"
)

TRASHED_FOUND=()
for subdir in "${TRASHED_SUBDIRS[@]}"; do
  if [ -d "$PROJECT_DIR/$subdir" ]; then
    TRASHED_FOUND+=("$subdir")
  fi
done

if [ ${#TRASHED_FOUND[@]} -gt 0 ]; then
  echo ""
  echo "Legacy trashed/ directories found (trashed items are now deleted outright):"
  for subdir in "${TRASHED_FOUND[@]}"; do
    trashed_path="$PROJECT_DIR/$subdir"
    shopt -s nullglob
    files=("$trashed_path"/*.md "$trashed_path"/.gitkeep)
    shopt -u nullglob
    echo "  $subdir/  (${#files[@]} file(s))"
    for f in "${files[@]}"; do echo "    $(basename "$f")"; done
  done
  echo ""
  if [ -t 0 ]; then
    read -r -p "Delete these trashed/ directories and their contents? [y/N]: " REPLY
    case "$REPLY" in
      [yY])
        for subdir in "${TRASHED_FOUND[@]}"; do
          rm -rf "$PROJECT_DIR/$subdir"
          echo "  Removed: $subdir/"
        done
        ;;
      *)
        echo "  Skipped. Remove manually if desired."
        ;;
    esac
  else
    echo "Non-interactive mode: skipping trashed/ cleanup. Remove manually if desired."
  fi
  echo ""
fi

# 5. Bootstrap Serena project.yml (idempotent)
echo "Re-checking Serena project.yml bootstrap..."
"$TEMPLATE_DIR/bootstrap-serena.sh" "$PROJECT_DIR"
echo ""

# Done
echo "============================="
echo "  Update complete!"
echo "============================="
