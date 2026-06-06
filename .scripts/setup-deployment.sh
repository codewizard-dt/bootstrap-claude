#!/usr/bin/env bash
set -euo pipefail

# Deployment / CI scaffolding seam — separate from the docs/skills/MCP sync flow.
# Reads .docs/guides/deployment-strategy.md as a prompt template and runs Claude
# to scaffold .github/ workflows + Makefile + .gitleaks.toml into a target project.
#
# Called once by setup-project.sh (new projects). DELIBERATELY NOT called by
# update-project.sh: workflows get hand-customized per project (Dockerfile paths,
# runner labels, deploy steps) and must not be clobbered on every template update.
#
# Also invokable standalone (`npx bootstrap-claude deploy`) so an existing project
# can opt into CI on demand. Claude applies copy-once semantics:
#   - security.yml      → always overwritten (generic, no project-specific content)
#   - build.yml         → created once, skipped if present
#   - .gitleaks.toml    → created once, skipped if present
#   - Makefile          → Docker targets added/merged if a Makefile already exists

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GUIDE="$SCRIPT_DIR/../.docs/guides/deployment-strategy.md"
TEMPLATE="$SCRIPT_DIR/../.claude/prompt-template/setup-deployment.md"

if [ ! -f "$GUIDE" ]; then
  echo "Error: deployment guide not found at $GUIDE" >&2
  exit 1
fi

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: prompt template not found at $TEMPLATE" >&2
  exit 1
fi

DRY_RUN=false
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
set -- "${POSITIONAL[@]}"

if [ $# -ne 1 ]; then
  echo "Usage: $0 [--dry-run] <path-to-project>" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)" || {
  echo "Error: Cannot resolve path: $1" >&2
  exit 1
}

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR" >&2
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo "Docker and Compose files in $PROJECT_DIR:"
  echo ""
  echo "  Dockerfiles:"
  find "$PROJECT_DIR" \( -name node_modules -o -name .git \) -prune -o \
    -name "Dockerfile*" -print | sort | while read -r f; do
    echo "    ${f#"$PROJECT_DIR/"}"
  done
  echo ""
  echo "  Docker Compose files:"
  find "$PROJECT_DIR" \( -name node_modules -o -name .git \) -prune -o \
    \( -name "docker-compose*.yml" -o -name "docker-compose*.yaml" \
       -o -name "compose*.yml" -o -name "compose*.yaml" \) -print | sort | while read -r f; do
    echo "    ${f#"$PROJECT_DIR/"}"
  done
  exit 0
fi

TASK="$(sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$TEMPLATE")"

PROMPT="$(cat "$GUIDE")

---

$TASK"

cd "$PROJECT_DIR"
claude --dangerously-skip-permissions "$PROMPT"