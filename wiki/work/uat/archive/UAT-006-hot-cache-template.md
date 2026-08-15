---
id: UAT-006
title: "UAT: Add wiki/hot.md template to lib/scripts/templates/wiki/"
status: passed
task: TASK-006
created: 2026-07-06
updated: 2026-07-06
aliases:
  - UAT-006
---

# UAT-006 — UAT: Add `wiki/hot.md` template to `lib/scripts/templates/wiki/`

implements::[[TASK-006]]

> **Source task**: [[TASK-006]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`
- [ ] `bash` and `rsync` available (macOS default toolchain)

---

## Test Cases

### UAT-FILE-001: Template hot.md has the required hot-cache structure
- **File**: `lib/scripts/templates/wiki/hot.md`
- **Description**: The scaffolded template must carry the fixed hot-cache structure per `wiki/knowledge/concepts/llm-wiki-hot-cache.md` — YAML frontmatter, an `# Hot Cache` H1, a regeneration note (fully regenerated each session, never appended), and the three sections `## Key Recent Facts`, `## Recent Changes`, `## Active Threads`.
- **Steps**:
  1. Run the command below as-is.
- **Command**:
  ```bash
  f=/Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/templates/wiki/hot.md; if grep -q '^# Hot Cache' "$f" && grep -q '## Key Recent Facts' "$f" && grep -q '## Recent Changes' "$f" && grep -q '## Active Threads' "$f" && grep -qi 'regenerated' "$f"; then echo PASS; else echo FAIL; fi
  ```
- **Expected Result**: Prints `PASS` — all four structural markers and the regeneration note are present.
- **Repeatable Unit Test**: Not applicable: repo has no shell test harness; this command is itself the deterministic re-runnable check.
- [x] Pass <!-- 2026-07-06 -->

### UAT-FILE-002: Repo wiki/hot.md is seeded with real session content, not the placeholder
- **File**: `wiki/hot.md`
- **Description**: This repo is the template's own dogfood instance, so `wiki/hot.md` must contain a real session summary (references ROADMAP-001) and a real date — not the `YYYY-MM-DD` placeholder from the template.
- **Steps**:
  1. Run the command below as-is.
- **Command**:
  ```bash
  f=/Users/davidtaylor/Repositories/bootstrap-claude/wiki/hot.md; if grep -q 'ROADMAP-001' "$f" && ! grep -q 'YYYY-MM-DD' "$f"; then echo PASS; else echo FAIL; fi
  ```
- **Expected Result**: Prints `PASS` — file references ROADMAP-001 and contains no `YYYY-MM-DD` placeholder.
- **Repeatable Unit Test**: Not applicable: asserts on a repo-specific seeded content file, not automatable business logic.
- [x] Pass <!-- 2026-07-06 -->

### UAT-INT-001: sync-wiki-scaffold.sh delivers hot.md into a fresh project
- **Description**: Running the scaffold sync against an empty target project must copy `hot.md` into the target's `wiki/` (it is not in the `--exclude` list), landing the hot-cache template for every synced project.
- **Steps**:
  1. Run the command below as-is. It creates a throwaway target dir, runs the sync, asserts `wiki/hot.md` landed with its H1, then cleans up.
- **Command**:
  ```bash
  T=$(mktemp -d); /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/sync-wiki-scaffold.sh "$T" >/dev/null 2>&1; if [ -f "$T/wiki/hot.md" ] && grep -q '^# Hot Cache' "$T/wiki/hot.md"; then echo PASS; else echo FAIL; fi; rm -rf "$T"
  ```
- **Expected Result**: Prints `PASS` — `hot.md` exists in the freshly scaffolded target with the `# Hot Cache` heading.
- **Repeatable Unit Test**: Not applicable: exercises the real sync shell script end-to-end; repo has no shell test harness to house it.
- [x] Pass <!-- 2026-07-06 -->

### UAT-INT-002: hot.md is copy-once — a customized target file is not overwritten on re-sync
- **Scenario**: Once a project customizes its `wiki/hot.md`, a subsequent scaffold sync must preserve the customization (copy-once via `rsync --ignore-existing`), the same as `index.md`/`log.md` and unlike the always-refresh `conventions.md`/`lifecycle.md`.
- **Steps**:
  1. Run the command below as-is. It scaffolds a target, overwrites `wiki/hot.md` with a sentinel, re-runs the sync, and asserts the sentinel survived.
- **Command**:
  ```bash
  T=$(mktemp -d); S=/Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/sync-wiki-scaffold.sh; "$S" "$T" >/dev/null 2>&1; printf 'CUSTOMIZED-SENTINEL' > "$T/wiki/hot.md"; "$S" "$T" >/dev/null 2>&1; if grep -q 'CUSTOMIZED-SENTINEL' "$T/wiki/hot.md"; then echo PASS; else echo FAIL; fi; rm -rf "$T"
  ```
- **Expected Result**: Prints `PASS` — the customized `hot.md` is preserved across a second sync (not overwritten).
- **Repeatable Unit Test**: Not applicable: exercises the real sync shell script end-to-end; repo has no shell test harness to house it.
- [x] Pass <!-- 2026-07-06 -->

---

## Notes

TASK-006 only creates the template and the repo's own `wiki/hot.md`. Wiring `/wiki-ingest` to refresh it (TASK-007) and `/primer` to read it first (TASK-008) are separate dependent tasks and are out of scope for this UAT.
