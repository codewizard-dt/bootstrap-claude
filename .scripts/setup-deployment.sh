#!/usr/bin/env bash
set -euo pipefail

# Deployment / CI scaffolding seam — separate from the docs/skills/MCP sync flow.
# Scaffolds .github/ workflows and the Gitleaks config into a target project.
#
# Called once by setup-project.sh (new projects). DELIBERATELY NOT called by
# update-project.sh: workflows get hand-customized per project (Dockerfile paths,
# runner labels, deploy steps) and must not be clobbered on every template update.
#
# Also invokable standalone (`npx bootstrap-claude deploy`) so an existing project
# can opt into CI on demand. Copy-once semantics protect existing customizations:
#   - security.yml      → always overwritten (generic, no project-specific content)
#   - build.yml         → copied once, skipped if present
#   - .gitleaks.toml    → copied once, skipped if present
#
# build.yml is safe to copy verbatim: its build job is guarded by
# `if: hashFiles('Dockerfile') != ''`, so it self-skips (neutral, not failed) on
# repos that don't build a container yet, taking the dependent deploy job with it.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-project>" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)" || {
  echo "Error: Cannot resolve path: $1"
  exit 1
}

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR"
  exit 1
fi

WORKFLOWS_SRC="$TEMPLATE_DIR/.github/workflows"
WORKFLOWS_DST="$PROJECT_DIR/.github/workflows"
mkdir -p "$WORKFLOWS_DST"

# security.yml — generic secret-scanning workflow; always sync (idempotent, no project-specific content)
rsync -av "$WORKFLOWS_SRC/security.yml" "$WORKFLOWS_DST/"

# .gitleaks.toml — required by security.yml; skip if project has already customized it
if [ ! -f "$PROJECT_DIR/.gitleaks.toml" ]; then
  cp "$TEMPLATE_DIR/.gitleaks.toml" "$PROJECT_DIR/.gitleaks.toml"
  echo "Created .gitleaks.toml"
else
  echo ".gitleaks.toml already exists — skipping"
fi

# build.yml — Docker build/push/deploy starting point; skip if already customized
if [ ! -f "$WORKFLOWS_DST/build.yml" ]; then
  cp "$WORKFLOWS_SRC/build.yml" "$WORKFLOWS_DST/build.yml"
  echo "Created .github/workflows/build.yml (fill in TODO sections for your project)"
else
  echo ".github/workflows/build.yml already exists — skipping"
fi

echo "Deployment scaffold synced (.github/ workflows + .gitleaks.toml)."
