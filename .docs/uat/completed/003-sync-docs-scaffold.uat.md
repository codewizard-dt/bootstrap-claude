# UAT: Sync .docs/ Scaffold Only

> **Source task**: [`.docs/tasks/completed/003-sync-docs-scaffold.md`](../../tasks/completed/003-sync-docs-scaffold.md)
> **Generated**: 2026-04-22

---

## Prerequisites

- [ ] Working directory is the project root (contains `sync-docs-scaffold.sh`, `setup-project.sh`, `update-project.sh`)
- [ ] `rsync` is installed (`rsync --version`)
- [ ] `sync-docs-scaffold.sh` is executable (`test -x sync-docs-scaffold.sh && echo ok`)

---

## Integration Tests

### UAT-INT-001: Fresh sync creates the correct scaffold structure
- **Components**: `sync-docs-scaffold.sh`
- **Flow**: Run the helper against an empty directory and verify every expected file is present
- **Steps**:
  1. Run the command below — it creates a scratch dir, syncs the scaffold, lists all resulting files, then cleans up
- **Command**:
  ```bash
  SCRATCH=$(mktemp -d) && ./sync-docs-scaffold.sh "$SCRATCH" && find "$SCRATCH/.docs" | sort && rm -rf "$SCRATCH"
  ```
- **Expected Result**: Exits 0. Output includes `.docs/ scaffold synced.` and the following paths:
  - `…/.docs/guides/mcp-tools.md`
  - `…/.docs/guides/task-lifecycle.md`
  - `…/.docs/tasks/active/.gitkeep`
  - `…/.docs/tasks/active/README.md`
  - `…/.docs/tasks/completed/.gitkeep`
  - `…/.docs/tasks/trashed/.gitkeep`
  - `…/.docs/uat/completed/.gitkeep`
  - `…/.docs/uat/pending/.gitkeep`
  - `…/.docs/uat/screenshots/.gitkeep`
  - `…/.docs/uat/skipped/.gitkeep`
  - `…/.docs/uat/trashed/.gitkeep`
- [SKIP: success message reflects expanded scope (.claude/skills/ also synced); all scaffold paths verified present] <!-- 2026-05-01 -->

### UAT-INT-002: Task files and top-level tasks/README.md are excluded
- **Components**: `sync-docs-scaffold.sh`
- **Flow**: Run the helper against a scratch dir and confirm task-specific `.md` files and the top-level task index are absent
- **Steps**:
  1. Run the command below — syncs to scratch, lists all `.md` files found, then cleans up
- **Command**:
  ```bash
  SCRATCH=$(mktemp -d) && ./sync-docs-scaffold.sh "$SCRATCH" && find "$SCRATCH/.docs" -name "*.md" | sort && rm -rf "$SCRATCH"
  ```
- **Expected Result**: Only three `.md` files are present: `…/.docs/guides/mcp-tools.md`, `…/.docs/guides/task-lifecycle.md`, and `…/.docs/tasks/active/README.md`. Absent: `…/.docs/tasks/README.md`, any `0NN-*.md` task file (e.g. `001-project-registry-push.md`), and any `.uat.md` file.
- [SKIP: .docs/adr/README.md and .docs/guides/command-anti-patterns.md present due to expanded script scope; exclusion list reflects old spec] <!-- 2026-05-01 -->

### UAT-INT-003: Idempotency — existing target-project content is preserved on re-sync
- **Components**: `sync-docs-scaffold.sh`
- **Flow**: Seed a project-specific task file in a scratch target, re-run the helper, confirm the file survives untouched
- **Steps**:
  1. Run the command below — creates scratch, syncs, seeds a fake task, re-syncs, checks preservation, cleans up
- **Command**:
  ```bash
  SCRATCH=$(mktemp -d) && ./sync-docs-scaffold.sh "$SCRATCH" && echo "# fake task" > "$SCRATCH/.docs/tasks/active/099-target-only.md" && ./sync-docs-scaffold.sh "$SCRATCH" && test -f "$SCRATCH/.docs/tasks/active/099-target-only.md" && echo "preserved" && rm -rf "$SCRATCH"
  ```
- **Expected Result**: Prints `preserved` and exits 0. The second helper run does not delete or overwrite the seeded file.
- [x] Pass <!-- 2026-05-01 -->

### UAT-INT-004: setup-project.sh delegates to sync-docs-scaffold.sh
- **Components**: `setup-project.sh`
- **Flow**: Confirm the old blanket `.docs/` rsync was replaced by the helper invocation
- **Steps**:
  1. Run the command below — checks for the removed pattern and the new call
- **Command**:
  ```bash
  grep -c 'rsync.*\.docs/.*\.docs/' setup-project.sh; grep -c 'sync-docs-scaffold\.sh' setup-project.sh
  ```
- **Expected Result**: First line: `0` (blanket `.docs/` rsync absent). Second line: `1` (helper call present).
- [x] Pass <!-- 2026-05-01 -->

### UAT-INT-005: update-project.sh delegates to sync-docs-scaffold.sh
- **Components**: `update-project.sh`
- **Flow**: Confirm the old blanket `.docs/` rsync was replaced by the helper invocation
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  grep -c 'rsync.*\.docs/.*\.docs/' update-project.sh; grep -c 'sync-docs-scaffold\.sh' update-project.sh
  ```
- **Expected Result**: First line: `0`. Second line: `1`.
- [x] Pass <!-- 2026-05-01 -->

### UAT-INT-006: All three scripts pass bash syntax check
- **Components**: `sync-docs-scaffold.sh`, `setup-project.sh`, `update-project.sh`
- **Flow**: Run bash in parse-only mode to confirm no syntax errors were introduced by the refactor
- **Steps**:
  1. Run the command below from the project root
- **Command**:
  ```bash
  bash -n sync-docs-scaffold.sh setup-project.sh update-project.sh && echo "All syntax OK"
  ```
- **Expected Result**: Prints `All syntax OK` and exits 0. No error output from bash.
- [x] Pass <!-- 2026-05-01 -->

---

## Edge Case Tests

### UAT-EDGE-001: No arguments prints usage message and exits 1
- **Scenario**: `sync-docs-scaffold.sh` called with zero arguments
- **Steps**:
  1. Run the command below from the project root
- **Command**:
  ```bash
  ./sync-docs-scaffold.sh 2>&1; echo "Exit: $?"
  ```
- **Expected Result**: Output contains `Usage: ./sync-docs-scaffold.sh <path-to-project>`. Last line: `Exit: 1`.
- [x] Pass <!-- 2026-05-01 -->

### UAT-EDGE-002: Non-existent path argument prints error and exits 1
- **Scenario**: `sync-docs-scaffold.sh` called with a path that cannot be resolved
- **Steps**:
  1. Run the command below from the project root
- **Command**:
  ```bash
  ./sync-docs-scaffold.sh /nonexistent/path/xyz 2>&1; echo "Exit: $?"
  ```
- **Expected Result**: Output contains `Error: Cannot resolve path: /nonexistent/path/xyz`. Last line: `Exit: 1`.
- [x] Pass <!-- 2026-05-01 -->
