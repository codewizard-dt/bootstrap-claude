---
id: UAT-002
title: "UAT: Audit lifecycle.md files and skill templates for stale completed/ references"
status: skipped
task: TASK-002
created: 2026-07-06
updated: 2026-07-06
---

# UAT-002 — UAT: Audit lifecycle.md files and skill templates for stale `completed/` references

implements::[[TASK-002]]

> **Source task**: [[TASK-002]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Run from the repository root (`bootstrap-claude/`)
- [ ] `grep` available on PATH (standard on macOS/Linux)

---

## Test Cases

This is an audit-only task; its deliverable is the "Audit Findings" section of TASK-002 asserting zero `completed/` drift. Each test below independently re-verifies one claim from that section with a deterministic command. Because the repo has no unit-test runner, the repeatable check for each claim **is** its embedded `grep` command, which `/uat-auto` runs directly.

### UAT-VERIFY-001: No `completed` references in any lifecycle.md
- **Description**: Confirms the audit claim that all six `wiki/work/*/lifecycle.md` files contain zero `completed` mentions (the old subdirectory convention is fully absent from lifecycle specs).
- **Steps**:
  1. Run the command below as-is from the repo root.
- **Command**:
  ```bash
  grep -rn 'completed' wiki/work/decisions/lifecycle.md wiki/work/tasks/lifecycle.md wiki/work/uat/lifecycle.md wiki/work/bugs/lifecycle.md wiki/work/requirements/lifecycle.md wiki/work/roadmaps/lifecycle.md
  ```
- **Expected Result**: No output (grep finds no matches and exits non-zero). Any printed line indicates reintroduced drift and fails the test.
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded `grep` command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->

### UAT-VERIFY-002: `completed/` in lib/skills is only absence-asserting prose
- **Description**: Confirms the three (and only three) `completed/` hits under `lib/skills/` are the known-good lines that assert the *absence* of a `completed/` subdirectory (`decision-next`, `task-add`, `uat-walk/UAT-CORE.md`) — none reintroduce the old path convention.
- **Steps**:
  1. Run the command below as-is from the repo root.
- **Command**:
  ```bash
  grep -rn 'completed/' lib/skills
  ```
- **Expected Result**: Exactly three lines, one each from `lib/skills/decision-next/SKILL.md`, `lib/skills/task-add/SKILL.md`, and `lib/skills/uat-walk/UAT-CORE.md`, each stating that no `completed/` subdirectory exists / files never move. No other files appear.
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded `grep` command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->

### UAT-VERIFY-003: `completed/` in wiki templates is generic prose only
- **Description**: Confirms the single `completed/` hit under `lib/scripts/templates/wiki/` is generic list-behavior prose ("completed/terminal items drop off the list"), not a stale directory path.
- **Steps**:
  1. Run the command below as-is from the repo root.
- **Command**:
  ```bash
  grep -rn 'completed/' lib/scripts/templates/wiki
  ```
- **Expected Result**: Exactly one line from `lib/scripts/templates/wiki/index.md` reading "completed/terminal items drop off the list". No path-style references to `wiki/work/<family>/completed/`.
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded `grep` command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->

### UAT-VERIFY-004: No live `/completed` path references outside the migration prompt
- **Description**: Confirms every `/completed` reference in `lib/` is confined to `lib/prompts/migrate-wiki.md` (the historical `.docs/` old→new mapping). Excluding that file, there are zero `/completed` references — no live `wiki/work/<family>/completed/` path anywhere else in `lib/`.
- **Steps**:
  1. Run the command below as-is from the repo root.
- **Command**:
  ```bash
  grep -rn --exclude='migrate-wiki.md' '/completed' lib
  ```
- **Expected Result**: No output (grep finds no matches and exits non-zero). Any printed line indicates a live stale-path reference outside the migration prompt and fails the test.
- **Repeatable Unit Test**: Not applicable: repo has no unit-test runner; the deterministic check is this embedded `grep` command, run by `/uat-auto`.
- [x] Pass <!-- 2026-07-06 -->

### UAT-VERIFY-005: migrate-wiki.md `completed/` mentions are all `.docs/`-scoped (historical)
- **Scenario**: The migration prompt intentionally documents the *old* pre-migration `.docs/.../completed/` paths in its old→new mapping table. This test confirms those mentions describe the historical source structure being migrated *from*, not a live `wiki/work/` target path.
- **Steps**:
  1. Run the command below and inspect each matched line.
  ```bash
  grep -n 'completed/' lib/prompts/migrate-wiki.md
  ```
- **Expected Result**: Every matched line either sits in the left ("old path") column of the migration mapping table referencing a `.docs/…/completed/…` source, or is a relative-link rewrite example (`completed/NNN-slug.md`) among other `.docs/` old-form links. No line maps *to* or describes a live `wiki/work/<family>/completed/` destination. Requires human confirmation that the surrounding context is historical `.docs/` migration mapping.
- **Repeatable Unit Test**: Not applicable: the assertion is a semantic judgment about historical vs. live scope of matched lines, which requires human reading of context.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->
