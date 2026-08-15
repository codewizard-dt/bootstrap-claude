---
id: UAT-008
aliases: [UAT-008]
title: "UAT: Update /primer to read wiki/hot.md first, before Serena memories"
status: skipped
task: TASK-008
created: 2026-07-06
updated: 2026-07-06
---

# UAT-008 — UAT: Update /primer to read wiki/hot.md first, before Serena memories

implements::[[TASK-008]]

> **Source task**: [[TASK-008]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Repo checked out at the branch containing the TASK-008 change to `lib/skills/primer/SKILL.md`
- [ ] Run all commands from the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`)

---

## Test Cases

All cases assert on the content of `lib/skills/primer/SKILL.md`, a prose skill spec (no runtime surface). Each command is a single deterministic check runnable by `/uat-auto`; a non-empty match (exit 0) is a pass unless stated otherwise.

### UAT-EDGE-001: Step 0 "Read the Hot Cache" section exists
- **Scenario**: The primer skill gained a dedicated hot-cache reading step.
- **Steps**: Confirm a `## Step 0: Read the Hot Cache` heading is present.
- **Command**:
  ```bash
  grep -n '## Step 0: Read the Hot Cache' lib/skills/primer/SKILL.md
  ```
- **Expected Result**: One matching line — the Step 0 heading exists.
- **Repeatable Unit Test**: Not applicable: assertion targets prose content of a skill spec; the repo has no markdown-content test harness.
- [FAIL: auto-judge: content/ordering assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena/Read, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-002: Hot cache is read BEFORE Serena memories (ordering — core requirement)
- **Scenario**: The task's whole point — `wiki/hot.md` must be read first, ahead of the Serena memory discovery step.
- **Steps**: Confirm the `## Step 0: Read the Hot Cache` heading appears at an earlier line number than `## Step 1: Discover & Read Memories`.
- **Command**:
  ```bash
  grep -nE '## Step 0: Read the Hot Cache|## Step 1: Discover & Read Memories' lib/skills/primer/SKILL.md
  ```
- **Expected Result**: Two lines, with the `Step 0: Read the Hot Cache` line number strictly less than the `Step 1: Discover & Read Memories` line number (Step 0 precedes Step 1). This is the ordering guarantee the task requires.
- **Repeatable Unit Test**: Not applicable: ordering assertion on prose headings; no markdown-content test harness in repo.
- [FAIL: auto-judge: content/ordering assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena/Read, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-003: Step 0 locates and reads wiki/hot.md via Serena find_file
- **Scenario**: Step 0 discovers `hot.md` under `wiki/` with `mcp__serena__find_file` and then reads it.
- **Steps**: Confirm the Step 0 body references `find_file` for `hot.md` and reading `wiki/hot.md`.
- **Command**:
  ```bash
  grep -nE 'find_file` for `hot.md|`wiki/hot.md`' lib/skills/primer/SKILL.md
  ```
- **Expected Result**: The Step 0 body names `mcp__serena__find_file` for `hot.md` and reading `wiki/hot.md`.
- **Repeatable Unit Test**: Not applicable: prose-content assertion; no markdown-content test harness in repo.
- [FAIL: auto-judge: content/ordering assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena/Read, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-004: Step 0 no-ops silently when hot.md is absent
- **Scenario**: For projects that have not adopted the hot cache, Step 0 must skip silently (no warning), not error.
- **Steps**: Confirm the Step 0 body states it skips silently when the file is not found.
- **Command**:
  ```bash
  grep -nE 'skip this step silently|skip silently|No warning' lib/skills/primer/SKILL.md
  ```
- **Expected Result**: Step 0 explicitly skips silently / with no warning when `hot.md` is not found (graceful optional behavior).
- **Repeatable Unit Test**: Not applicable: prose-content assertion; no markdown-content test harness in repo.
- [FAIL: auto-judge: content/ordering assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena/Read, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-005: Step 0 primes context but does not replace Serena memory reading
- **Scenario**: The hot cache is a cheap first pass, not a substitute for the deeper Serena memory step that follows.
- **Steps**: Confirm the Step 0 body frames itself as a first-pass primer that does not replace the memory reading below.
- **Command**:
  ```bash
  grep -nE 'does not replace|first-pass|first pass' lib/skills/primer/SKILL.md
  ```
- **Expected Result**: Step 0 states it is a first-pass primer that does not replace the Serena memory discovery in Step 1.
- **Repeatable Unit Test**: Not applicable: prose-content assertion; no markdown-content test harness in repo.
- [FAIL: auto-judge: content/ordering assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena/Read, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-006: Step 0 is independent of the Step 4 task-index check (no conflict with TASK-003's fix)
- **Scenario**: TASK-008 layered Step 0 on top of TASK-003's already-fixed Step 4 (task-index consistency, `index.md` not `README.md`); the two must remain distinct, non-conflicting steps.
- **Steps**: Confirm Step 0 (hot cache) and Step 4 (task index → `wiki/work/tasks/index.md`) both exist as separate steps, and Step 4 references `index.md` rather than the old `README.md` table. (Human-verified: the independence judgment has no single deterministic oracle.)
- **Command**:
  ```bash
  grep -nE '## Step 0: Read the Hot Cache|## Step 4: Check the Task Index|wiki/work/tasks/index.md' lib/skills/primer/SKILL.md
  ```
- **Expected Result**: Step 0 and Step 4 are separate headings; Step 4 points at `wiki/work/tasks/index.md` (TASK-003's convention). Human judgment confirms the two checks are independent and non-duplicating.
- **Repeatable Unit Test**: Not applicable: independence is a scope judgment requiring human review; no deterministic oracle.
- [FAIL: auto-judge: content/ordering assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena/Read, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->
