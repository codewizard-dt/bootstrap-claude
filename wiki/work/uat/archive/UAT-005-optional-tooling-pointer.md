---
id: UAT-005
aliases: [UAT-005]
title: "UAT: Add Optional tooling pointer (qmd, Hindsight) to CLAUDE.md"
status: passed
task: TASK-005
created: 2026-07-06
updated: 2026-07-06
---

# UAT-005 — UAT: Add "Optional tooling" pointer (qmd, Hindsight) to `CLAUDE.md`

implements::[[TASK-005]]

> **Source task**: [[TASK-005]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Run from the repository root (`bootstrap-claude/`)
- [ ] `grep` available on PATH (standard on macOS/Linux)

---

## Test Cases

This task's deliverable is a documentation subsection. Each test below asserts a deterministic, machine-checkable property of the delivered content. Because the repo has no unit-test runner, the repeatable check for each claim **is** its embedded `grep` command, which `/uat-auto` runs directly (via the Serena-equivalent search the repo's markdown hook mandates).

### UAT-VERIFY-001: `### Optional tooling` subsection present in CLAUDE.md
- **Description**: Confirms the new "Optional tooling" subsection was added to CLAUDE.md's LLM Wiki section.
- **Steps**:
  1. Run the command below as-is from the repo root.
- **Command**:
  ```bash
  grep -n '### Optional tooling' CLAUDE.md
  ```
- **Expected Result**: Exactly one match — the `### Optional tooling` heading. Absence fails the test.
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded `grep` command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->

### UAT-VERIFY-002: Both entity-page links present in the subsection
- **Description**: Confirms the subsection cross-links both the qmd and Hindsight entity pages by their wiki paths.
- **Steps**:
  1. Run the command below as-is from the repo root.
- **Command**:
  ```bash
  grep -n 'wiki/knowledge/entities/tools/qmd.md\|wiki/knowledge/entities/tools/hindsight.md' CLAUDE.md
  ```
- **Expected Result**: Two matches — one line linking `wiki/knowledge/entities/tools/qmd.md` and one linking `wiki/knowledge/entities/tools/hindsight.md`.
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded `grep` command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->

### UAT-VERIFY-003: Each link carries its deferred-adoption status line
- **Description**: Confirms each tool's one-line "status for this repo" is present — qmd marked "correctly deferred", Hindsight marked "hold off adopting as default" — so the pointer documents the not-adopted-by-default posture the task requires.
- **Steps**:
  1. Run the command below as-is from the repo root.
- **Command**:
  ```bash
  grep -n 'correctly deferred\|hold off adopting as default' CLAUDE.md
  ```
- **Expected Result**: Two matches — the qmd line containing "correctly deferred" and the Hindsight line containing "hold off adopting as default".
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded `grep` command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->

### UAT-VERIFY-004: Both linked entity pages resolve on disk
- **Scenario**: A cross-link is only valid if its target exists; the task requires both entity pages to be present so the pointer is not a dead link.
- **Steps**:
  1. Run the command below as-is from the repo root.
  ```bash
  ls wiki/knowledge/entities/tools/qmd.md wiki/knowledge/entities/tools/hindsight.md
  ```
- **Expected Result**: Both paths listed with no "No such file or directory" error — i.e., both `qmd.md` and `hindsight.md` exist under `wiki/knowledge/entities/tools/`.
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded file-existence command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->

### UAT-VERIFY-005: Pointer not planted in immutable source or shipped template
- **Scenario**: The task explicitly must NOT edit the immutable `raw/llm-wiki.md`, and deliberately skips `lib/scripts/templates/CLAUDE-wiki.md` (the qmd/Hindsight entity pages exist only in this repo's ingested wiki, so shipping the links to fresh projects would plant dead links). This test confirms neither file references the two entity pages.
- **Steps**:
  1. Run the command below as-is from the repo root.
  ```bash
  grep -rn 'entities/tools/qmd\|entities/tools/hindsight' raw/llm-wiki.md lib/scripts/templates/CLAUDE-wiki.md
  ```
- **Expected Result**: No output (grep finds no matches and exits non-zero). Any printed line means the pointer leaked into the immutable source or the shipped template, and fails the test.
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded `grep` command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->
