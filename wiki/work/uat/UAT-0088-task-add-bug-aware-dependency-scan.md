---
id: UAT-0088
aliases: [UAT-0088]
title: "UAT: task-add's dependency scan also checks wiki/work/bugs/, writing origin_bug"
status: pending
task: TASK-0088
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0088 — UAT: task-add's dependency scan also checks wiki/work/bugs/, writing origin_bug

implements::[[TASK-0088]]

> **Source task**: [[TASK-0088]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Working tree contains the TASK-0088 edits to `lib/skills/task-add/SKILL.md` (Step 5 bug scan, Step 8 `origin_bug` field)
- [ ] `node` is available (unit-backed cases run with `node --test`)
- [ ] For the manual cases only: `~/.claude/skills/task-add/` is synced from this repo (`npx @codewizard-dt/bootstrap install`), and at least one `open`/`triaged`/`in-progress` bug exists in `wiki/work/bugs/index.md` (file a throwaway one with `/bug-create` if none does)

---

## Test Cases

### UAT-EDGE-001: Step 5 scans bugs/index.md for active bugs only
- **Scenario**: `lib/skills/task-add/SKILL.md` Step 5 must read `wiki/work/bugs/index.md` and consider only rows with status `open`/`triaged`/`in-progress`, matching on plausible fit with the new task's objective.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the test "Step 5 scans wiki/work/bugs/index.md for open/triaged/in-progress bugs" passes.
- **Expected Result**: Test passes; Step 5 names `wiki/work/bugs/index.md`, the three active statuses, and the "plausibly matches the new task's objective" judgment.
- **Repeatable Unit Test**: Created: `test/task-add-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test test/task-add-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Bug scan is additive; task-to-task detection unchanged
- **Scenario**: The new bug scan is a second scan alongside the task-index scan, not a replacement — `depends_on`/`blocks`/`parallel_safe_with` detection is preserved and precedes the bug scan.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the test "bug scan is additive: the task-to-task detection is preserved" passes.
- **Expected Result**: Test passes; Step 5 still defines all three relationship kinds before the bug scan and states the scan is additive with task-to-task detection unchanged.
- **Repeatable Unit Test**: Created: `test/task-add-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test test/task-add-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Missing or empty bugs index is skipped silently
- **Scenario**: A project with no `wiki/work/bugs/index.md`, or one with no active rows, must not error, warn, or prompt.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the test "skips the bug scan silently when the index is missing or has no active rows" passes.
- **Expected Result**: Test passes; Step 5 contains the "Skip silently if `wiki/work/bugs/index.md` is missing or has no active rows." instruction.
- **Repeatable Unit Test**: Created: `test/task-add-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test test/task-add-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Origin bug is confirmed in the same AskUserQuestion round-trip
- **Scenario**: A matched bug appears as an "Origin bug" row (`BUG-NNNN` + title) in the existing compact dependency table, so the user confirms or rejects it in one prompt — not a second `AskUserQuestion`.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the test "surfaces the origin bug as an "Origin bug" row in the same AskUserQuestion table" passes.
- **Expected Result**: Test passes; Step 5 has exactly one `AskUserQuestion`, the "Origin bug" row instruction, "in the same round-trip", and hands the confirmed `BUG-NNNN` (or none) to Step 8.
- **Repeatable Unit Test**: Created: `test/task-add-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test test/task-add-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: Step 8 frontmatter template carries `origin_bug: ""`
- **Scenario**: The task frontmatter template gains an optional singular `origin_bug` key (per DEC-0001#D1), defaulting to an empty string, positioned after `parallel_safe_with` and before `uat`, with all existing keys retained.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the test "Step 8 frontmatter template carries origin_bug" passes.
- **Expected Result**: Test passes; template contains `origin_bug: ""` (not a list) between `parallel_safe_with` and `uat`; `depends_on`, `blocks`, `parallel_safe_with`, `uat`, `tags` all still present.
- **Repeatable Unit Test**: Created: `test/task-add-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test test/task-add-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: origin_bug is populated only from a user-confirmed match, singular
- **Scenario**: Step 8 instructs setting `origin_bug` to the `BUG-NNNN` the user confirmed in Step 5, leaving `""` when none was confirmed, and never as a list.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the test "populates origin_bug only from the user-confirmed BUG-NNNN and keeps it singular" passes.
- **Expected Result**: Test passes; Step 8 cites `DEC-0001#D1`, the confirmed-in-Step-5 source, the empty-when-unconfirmed rule, and "Do not write it as a list."
- **Repeatable Unit Test**: Created: `test/task-add-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test test/task-add-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: task-add does not write the bug-side `linked_task` back-link
- **Scenario**: Per DEC-0001#D1's accepted Follow-up, the symmetric `linked_task` write-back on the bug file belongs to `/bug-triage` and `/bug-close`; `task-add` must not edit bug files.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the test "does not write the bug-side linked_task back-link" passes.
- **Expected Result**: Test passes; the only `linked_task` mentions in `task-add/SKILL.md` are the explicit "not written here" out-of-scope note.
- **Repeatable Unit Test**: Created: `test/task-add-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test test/task-add-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Repo copy is the only edit target
- **Scenario**: The change lives in `lib/skills/task-add/SKILL.md`; the machine-local `~/.claude/skills/task-add/SKILL.md` is never referenced as an edit target.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the test "never names the machine-local skill copy as an edit target" passes.
  3. Optionally run `git diff --stat` and confirm `lib/skills/task-add/SKILL.md` is the modified skill file.
- **Expected Result**: Test passes; no reference to the machine-local copy as an edit target.
- **Repeatable Unit Test**: Created: `test/task-add-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test test/task-add-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-001: Live /task-add run links a matching open bug as origin_bug
- **Scenario**: End-to-end agent behavior — creating a task whose objective plausibly matches an active bug yields an "Origin bug" row and a populated `origin_bug` field.
- **Steps**:
  1. Pick an active bug from `wiki/work/bugs/index.md` (note its `BUG-NNNN` and title).
  2. In a session with the synced skill, run `/task-add` with a description that clearly restates that bug's fix (e.g. "Fix <bug title>").
  3. At the Step 5 `AskUserQuestion` dependency table, confirm it includes an "Origin bug" row naming that `BUG-NNNN` and title, and that there is no separate second prompt for the bug link. Accept it.
  4. Complete the remaining prompts, then open the created `wiki/work/tasks/TASK-NNNN-*.md`.
  5. Clean up the throwaway task with `/task-trash` if it was only created for this test.
- **Expected Result**: The task frontmatter contains `origin_bug: "BUG-NNNN"` (single string, matching the accepted bug); `depends_on`/`blocks`/`parallel_safe_with` are still populated per the task-to-task scan; the bug file itself is unmodified (no `linked_task` written by task-add).
- **Repeatable Unit Test**: Not applicable: exercises live LLM-driven skill execution and interactive prompts, which a deterministic unit test cannot drive
- [FAIL: auto-judge: manual test requires human verification (live LLM-driven /task-add run)] <!-- 2026-09-19 -->

### UAT-INT-002: Live /task-add run with no matching bug leaves origin_bug empty
- **Scenario**: When no active bug plausibly matches (or the user rejects the suggestion), `origin_bug` stays `""` and the flow is otherwise unchanged.
- **Steps**:
  1. In a session with the synced skill, run `/task-add` with a description unrelated to any active bug (e.g. "Add a README badge for the npm version").
  2. Observe the Step 5 dependency table: it must contain no "Origin bug" row and no bug-related warning.
  3. Complete the flow and open the created task file.
  4. Repeat once with a description that matches an active bug, but reject the "Origin bug" row at the prompt; open that task file too.
  5. Clean up throwaway tasks with `/task-trash`.
- **Expected Result**: Both created tasks have `origin_bug: ""`; the unrelated run shows no bug row or warning; the rejected-suggestion run records no bug link.
- **Repeatable Unit Test**: Not applicable: exercises live LLM-driven skill execution and interactive prompts, which a deterministic unit test cannot drive
- [FAIL: auto-judge: manual test requires human verification (live LLM-driven /task-add run)] <!-- 2026-09-19 -->
