---
id: UAT-0115
aliases: [UAT-0115]
title: "UAT: Remove req-update and task-update entirely, with no replacement"
status: passed
task: TASK-0115
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0115 — UAT: Remove req-update and task-update entirely, with no replacement

implements::[[TASK-0115]]

> **Source task**: [[TASK-0115]]
> **Generated**: 2026-09-19

Every case below runs one file-scoped `node --test` command; each `--test-name-pattern` was verified to select exactly the intended passing test(s) (counts stated per case). No case requires the full `npm test` suite. Cases INT-003 to INT-008 and INT-013 are backed by `test/req-task-update-removal-state.test.js`, created for this UAT.

---

## Prerequisites

- [x] Working directory is the repo root (`bootstrap-claude`) with TASK-0115's edits applied
- [x] Node 18+ available (`node --test` with `--test-name-pattern`)

---

## Test Cases

### UAT-INT-001: Both skill directories are absent
- **Scenario**: `lib/skills/req-update` and `lib/skills/task-update` were hard-deleted with no redirect stub.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='lib/skills/req-update does not exist' --test-name-pattern='lib/skills/task-update does not exist' test/req-task-update-removed.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/req-task-update-removed.test.js` (shipped with TASK-0115)
- **Unit Test Command**: `node --test --test-name-pattern='lib/skills/req-update does not exist' --test-name-pattern='lib/skills/task-update does not exist' test/req-task-update-removed.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-002: No live file under lib/, README.md, or CLAUDE.md names either removed skill
- **Scenario**: Every table row, cross-reference, and wiring line was swept. Only `lib/scripts/install-global.sh` is excluded (TASK-0122 legitimately lists the two as orphans to prune).
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed; on failure the assertion message lists the offending relative paths
- **Command**:
  ```bash
  node --test --test-name-pattern='no file under lib' test/req-task-update-removed.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/req-task-update-removed.test.js` (shipped with TASK-0115)
- **Unit Test Command**: `node --test --test-name-pattern='no file under lib' test/req-task-update-removed.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-003: Requirements lifecycle.md local and template copies are byte-identical
- **Scenario**: TASK-0115 Step 4 applied the same edit to `wiki/work/requirements/lifecycle.md` and `lib/scripts/templates/wiki/work/requirements/lifecycle.md`; template-owned files are always refreshed, so the two must not drift.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='local copy and template copy are byte-identical' test/req-task-update-removal-state.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. The test compares the two files as raw bytes.
- **Repeatable Unit Test**: Created: `test/req-task-update-removal-state.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='local copy and template copy are byte-identical' test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-004: Requirements lifecycle.md says approved changes are made by editing the file directly
- **Scenario**: Both copies replace the "append-only amendments (`/req-update`)" wording with the direct-edit rule and keep the supersede path (`/req-create` then `/req-retire`).
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='says approved changes are made by editing the file directly' test/req-task-update-removal-state.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/req-task-update-removal-state.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='says approved changes are made by editing the file directly' test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-005: TASK-0094 is archived with status trashed
- **Scenario**: TASK-0094 existed only to fix a skill this task deletes; it was trashed via the task-close flow, so it must be absent from `wiki/work/tasks/` and present once in `wiki/work/tasks/archive/` with `status: trashed`.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='TASK-0094 is archived with status trashed' test/req-task-update-removal-state.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/req-task-update-removal-state.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='TASK-0094 is archived with status trashed' test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-006: UAT-0094 is archived with status trashed (no pending UAT left pointing at a deleted skill)
- **Scenario**: The matching UAT must not remain `pending` in `wiki/work/uat/`; it lives once in `wiki/work/uat/archive/` with `status: trashed`.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='UAT-0094 is archived with status trashed' test/req-task-update-removal-state.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/req-task-update-removal-state.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='UAT-0094 is archived with status trashed' test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-007: Family indexes drop TASK-0094 / UAT-0094 and ROADMAP-0014 Phase 1 no longer has its checkbox
- **Scenario**: The trash flow removes both active-index entries and cleans the `- [ ] [[TASK-0094: ...]]` checklist item from ROADMAP-0014. The tasks-index line for TASK-0115 itself legitimately mentions "TASK-0094/UAT-0094" in prose, so the check matches only index entries that begin with the trashed item's link.
- **Steps**:
  1. Run the command below as-is (two name patterns: indexes and roadmap)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='family indexes carry no' --test-name-pattern='ROADMAP-0014 has no checklist item for TASK-0094' test/req-task-update-removal-state.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/req-task-update-removal-state.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='family indexes carry no' --test-name-pattern='ROADMAP-0014 has no checklist item for TASK-0094' test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-008: The retire-redirect pinning test was deleted
- **Scenario**: `test/req-update-retire-redirect.test.js` pinned only the deleted skill's retire redirect and must be gone.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='retire-redirect test file is gone' test/req-task-update-removal-state.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/req-task-update-removal-state.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='retire-redirect test file is gone' test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-009: Trimmed skill-boilerplate suite still passes its hygiene consumers
- **Scenario**: `req-update` and `task-update` were dropped from `HYGIENE_CONSUMERS`; the remaining consumers still point at the shared Edit hygiene section and do not restate the "never sed/awk" sentence.
- **Steps**:
  1. Run the command below as-is (two name patterns)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='hygiene consumers point at the shared Edit hygiene section' --test-name-pattern='hygiene consumers do not restate' test/skill-boilerplate.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` (existing; trimmed by TASK-0115)
- **Unit Test Command**: `node --test --test-name-pattern='hygiene consumers point at the shared Edit hygiene section' --test-name-pattern='hygiene consumers do not restate' test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-010: Trimmed task-dependency-single-source suite covers task-create and task-assess only
- **Scenario**: The `TASK_UPDATE` constant and optional-file filter were dropped; `SKILL_FILES` is `[task-create, task-assess]`. The blockquote-format and Step 2e checks still pass for both.
- **Steps**:
  1. Run the command below as-is (two name patterns)
  2. Confirm exactly 3 tests ran and all passed (task-create and task-assess "does not restate" plus the task-assess Step 2e test)
- **Command**:
  ```bash
  node --test --test-name-pattern='does not restate the blockquote dependency format' --test-name-pattern='task-assess Step 2e reads frontmatter' test/task-dependency-single-source.test.js
  ```
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/task-dependency-single-source.test.js` (existing; trimmed by TASK-0115)
- **Unit Test Command**: `node --test --test-name-pattern='does not restate the blockquote dependency format' --test-name-pattern='task-assess Step 2e reads frontmatter' test/task-dependency-single-source.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-011: Trimmed task-dependency-fields-content suite keeps task-assess's node record and issues report
- **Scenario**: The three `task-update ...` tests were removed and the two `/task-update` assertions on task-assess were retargeted to the new "edit the task's frontmatter directly" wording. The node-record (Step 2f) and issues-report (Step 4) tests still pass.
- **Steps**:
  1. Run the command below as-is (two name patterns)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='task-assess Step 2f node record' --test-name-pattern='task-assess Step 4 reports' test/task-dependency-fields-content.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js` (existing; trimmed by TASK-0115)
- **Unit Test Command**: `node --test --test-name-pattern='task-assess Step 2f node record' --test-name-pattern='task-assess Step 4 reports' test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-012: Trimmed shared-id-resolution suite wires 16 files and keeps the requirements-caller wiring valid
- **Scenario**: `WIRED_SKILLS` / `EXPECTED_WIRING` lost the two removed skills; the file-count test now expects 16 (15 SKILL.md + UAT-CORE.md), every wiring line still uses a family in the shared table, and `req-retire` still declares the requirements/active wiring.
- **Steps**:
  1. Run the command below as-is (three name patterns: count, family-table validity, req-retire wiring)
  2. Confirm exactly 3 tests ran and all passed
- **Command**:
  ```bash
  node --test --test-name-pattern='wired file list covers 16 files' --test-name-pattern='\(e\) every wiring line' --test-name-pattern='\(e\) lib/skills/req-retire' test/shared-id-resolution.test.js
  ```
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js` (existing; trimmed by TASK-0115)
- **Unit Test Command**: `node --test --test-name-pattern='wired file list covers 16 files' --test-name-pattern='\(e\) every wiring line' --test-name-pattern='\(e\) lib/skills/req-retire' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: Removed pointers were replaced with edit-directly wording, not left dangling
- **Scenario**: Text that used to say "run `/task-update <N>`" (task-assess) or "scope changes go through `/req-update`" (req-finalize) must say what to do by hand: edit the task file / its frontmatter directly; edit an approved requirement directly, or create a new one with `/req-create` and retire the old one with `/req-retire`.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='replace the removed pointers with edit-directly wording' test/req-task-update-removal-state.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. The test asserts `lib/skills/task-assess/SKILL.md` contains "edit the task file directly" and "edit the task file's frontmatter directly", and `lib/skills/req-finalize/SKILL.md` contains the direct-edit rule plus the `/req-create` + `/req-retire` supersession path.
- **Repeatable Unit Test**: Created: `test/req-task-update-removal-state.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='replace the removed pointers with edit-directly wording' test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-19 -->

---

## Observations and Gaps (not test cases)

- **Out-of-list edit**: the task's own Step 3 log notes it removed the empty `## Amendments` section from `req-create`'s requirement template, which was not in the task's declared file list. It is the same kind of removed-flow cleanup, and no case asserts on it.
- **Installed copies remain until TASK-0122**: the installed `~/.claude/skills/req-update` and `~/.claude/skills/task-update` copies are deliberately untouched by this task (no `install-global.sh` run). They remain callable in this environment until TASK-0122 prunes stale installed skills, which must list both names. No case asserts on `~/.claude/`.
- **Deliberately not asserted**: the full `npm test` suite exiting 0 (5 known pre-existing failures: `skill-frontmatter-aliases` x4, `task-typed-links` x1), historical mentions in `wiki/log.md`, `wiki/knowledge/sources/**`, archived items, and ROADMAP-0014 prose.
- **New unit test file**: `test/req-task-update-removal-state.test.js` (8 tests, hermetic, read-only, no `skip`/`todo`) was created for this UAT; the shipped `test/req-task-update-removed.test.js` (3 tests) and the four trimmed pinned suites cover the rest.
