# 003 — Sync .docs/ Scaffold Only

## Objective

Refactor `.docs/` sync in `setup-project.sh` and `update-project.sh` so target projects receive only the scaffold (guides + directory shells + `active/README.md`), never this template's own task/UAT content.

## Approach

Extract a new `sync-docs-scaffold.sh` helper that runs multiple targeted `rsync` invocations — one per destination — and call it from both the setup and update scripts (replacing each script's single blanket `rsync` of `.docs/`). The helper explicitly excludes `.docs/tasks/README.md` and every task/UAT content file, syncing only `.docs/guides/` (entire folder), `.docs/tasks/active/README.md` + `.gitkeep`, `.docs/tasks/{completed,trashed}/.gitkeep`, and `.docs/uat/<sub>/.gitkeep` for every UAT subfolder.

## Prerequisites

- [ ] `setup-project.sh` and `update-project.sh` exist and currently call `rsync -av "$TEMPLATE_DIR/.docs/" "$PROJECT_DIR/.docs/"`
- [ ] `bootstrap-serena.sh` helper pattern (alongside setup/update scripts, `chmod +x`) is the precedent for the new helper

---

## Steps

### 1. Create `sync-docs-scaffold.sh` helper  <!-- agent: general-purpose -->
<!-- Updated: 2026-04-20 -->

- [x] Create new file `sync-docs-scaffold.sh` at repo root (sibling of `setup-project.sh`, `update-project.sh`, `bootstrap-serena.sh`)
  - Shebang: `#!/usr/bin/env bash`
  - Header: `set -euo pipefail`
  - Resolve `TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"`
  - Require exactly one arg: `<path-to-project>`; on wrong arg count, print usage to stderr and `exit 1`
  - Resolve `PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)"` with `||` error block matching the style in `setup-project.sh:26-29`
  - Fail if `PROJECT_DIR` is not a directory (mirror `setup-project.sh:31-34`)
- [x] Create required destination directories up front with `mkdir -p`:
  - `"$PROJECT_DIR/.docs/guides"`
  - `"$PROJECT_DIR/.docs/tasks/active"`
  - `"$PROJECT_DIR/.docs/tasks/completed"`
  - `"$PROJECT_DIR/.docs/tasks/trashed"`
  - `"$PROJECT_DIR/.docs/uat/pending"`
  - `"$PROJECT_DIR/.docs/uat/completed"`
  - `"$PROJECT_DIR/.docs/uat/skipped"`
  - `"$PROJECT_DIR/.docs/uat/trashed"`
  - `"$PROJECT_DIR/.docs/uat/screenshots"`
- [x] Sync `.docs/guides/` as a full directory (entire contents, no filters):
  - `rsync -av "$TEMPLATE_DIR/.docs/guides/" "$PROJECT_DIR/.docs/guides/"`
- [x] Sync `.docs/tasks/active/` README + `.gitkeep` only (task files MUST NOT be copied):
  - `rsync -av "$TEMPLATE_DIR/.docs/tasks/active/README.md" "$TEMPLATE_DIR/.docs/tasks/active/.gitkeep" "$PROJECT_DIR/.docs/tasks/active/"`
- [x] Sync `.docs/tasks/completed/.gitkeep` only:
  - `rsync -av "$TEMPLATE_DIR/.docs/tasks/completed/.gitkeep" "$PROJECT_DIR/.docs/tasks/completed/"`
- [x] Sync `.docs/tasks/trashed/.gitkeep` only:
  - `rsync -av "$TEMPLATE_DIR/.docs/tasks/trashed/.gitkeep" "$PROJECT_DIR/.docs/tasks/trashed/"`
- [x] Explicitly DO NOT sync `.docs/tasks/README.md` (the top-level task index is project-specific — no rsync line targets it)
- [x] Loop over UAT subfolders and sync only `.gitkeep` from each:
  ```bash
  for sub in pending completed skipped trashed screenshots; do
    rsync -av "$TEMPLATE_DIR/.docs/uat/$sub/.gitkeep" "$PROJECT_DIR/.docs/uat/$sub/"
  done
  ```
- [x] Emit a final echo: `".docs/ scaffold synced."`
- [x] `chmod +x sync-docs-scaffold.sh`
  - Verify executable bit is set: `test -x sync-docs-scaffold.sh && echo ok`

### 2. Refactor `setup-project.sh` to call the helper  <!-- agent: general-purpose -->
<!-- Updated: 2026-04-20 -->

- [x] Replace the current `.docs/` rsync block in `setup-project.sh:101-103`:
  - Remove the three lines:
    ```bash
    mkdir -p "$PROJECT_DIR/.docs"
    rsync -av "$TEMPLATE_DIR/.docs/" "$PROJECT_DIR/.docs/"
    echo "Copied .docs/ to $PROJECT_DIR/.docs"
    ```
  - Keep the `.claude/` rsync block at lines 98-100 **unchanged** (only `.docs/` is in scope)
  - Keep the section header `echo "Copying .claude/ commands and .docs/..."` at line 97 unchanged
- [x] Insert a call to the new helper in the same position:
  ```bash
  "$TEMPLATE_DIR/sync-docs-scaffold.sh" "$PROJECT_DIR"
  ```
- [x] Do not touch any other block in `setup-project.sh` (MCP installation, Serena MCP, bootstrap-serena call, final summary all remain as-is)

### 3. Refactor `update-project.sh` to call the helper  <!-- agent: general-purpose -->
<!-- Updated: 2026-04-20 -->

- [x] Replace the `.docs/` sync block in `update-project.sh:32-36`:
  - Remove the four lines:
    ```bash
    echo "Syncing .docs/..."
    mkdir -p "$PROJECT_DIR/.docs"
    rsync -av "$TEMPLATE_DIR/.docs/" "$PROJECT_DIR/.docs/"
    echo ""
    ```
- [x] Insert in the same position:
  ```bash
  echo "Syncing .docs/ scaffold..."
  "$TEMPLATE_DIR/sync-docs-scaffold.sh" "$PROJECT_DIR"
  echo ""
  ```
- [x] Do not touch `.claude/commands/` sync block (lines 27-30) or the `bootstrap-serena.sh` call (lines 39-41)

### 4. Verification  <!-- agent: general-purpose -->
<!-- Updated: 2026-04-22 -->

- [x] Create a scratch target dir and simulate a fresh sync:
  ```bash
  SCRATCH=$(mktemp -d)
  mkdir -p "$SCRATCH"
  ./sync-docs-scaffold.sh "$SCRATCH"
  ```
  - Use `mcp__serena__list_dir` with `relative_path="$SCRATCH/.docs"` and `recursive=true` (resolve via `find_file` or equivalent; if the scratch path is outside the project, fall back to `ls -R` only here — scratch verification is the one case where a shell listing is acceptable since MCP list_dir is project-scoped)
- [x] Confirm scratch contents include:
  - `.docs/guides/mcp-tools.md`
  - `.docs/guides/task-lifecycle.md`
  - `.docs/tasks/active/README.md`
  - `.docs/tasks/active/.gitkeep`
  - `.docs/tasks/completed/.gitkeep`
  - `.docs/tasks/trashed/.gitkeep`
  - `.docs/uat/{pending,completed,skipped,trashed,screenshots}/.gitkeep`
- [x] Confirm scratch contents DO NOT include any of:
  - `.docs/tasks/README.md`
  - `.docs/tasks/active/001-project-registry-push.md` (or any 0NN-*.md task file)
  - `.docs/tasks/completed/002-bootstrap-serena.md`
  - `.docs/uat/skipped/002-bootstrap-serena.uat.md`
- [x] Seed a fake project-specific task in the scratch dir, re-run the helper, and confirm it is preserved (the update path must not clobber target-project content):
  ```bash
  echo "# fake target-project task" > "$SCRATCH/.docs/tasks/active/042-target-only.md"
  ./sync-docs-scaffold.sh "$SCRATCH"
  test -f "$SCRATCH/.docs/tasks/active/042-target-only.md" && echo "preserved"
  ```
- [x] Run `bash -n setup-project.sh update-project.sh sync-docs-scaffold.sh` to verify no syntax errors in any script
- [x] Clean up scratch: `rm -rf "$SCRATCH"`

---
**UAT**: [`.docs/uat/pending/003-sync-docs-scaffold.uat.md`](../../uat/pending/003-sync-docs-scaffold.uat.md)
