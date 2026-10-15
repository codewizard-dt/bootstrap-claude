---
id: UAT-0100
aliases: [UAT-0100]
title: "UAT: Shrink power-mode's Single-Task Executor mode to a pointer at /tackle → /uat-generate → /uat-auto"
status: passed
task: TASK-0100
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0100 — UAT: Shrink power-mode's Single-Task Executor mode to a pointer at /tackle → /uat-generate → /uat-auto

implements::[[TASK-0100]]

> **Source task**: [[TASK-0100]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Repo checked out at the working tree containing TASK-0100's edits to `lib/skills/power-mode/SKILL.md`
- [ ] Node.js available (`node --test`); no network, server, or secrets needed

---

## Test Cases

All cases are backed by `test/power-mode-single-task-pointer.test.js`, which reads repo-local markdown only (hermetic).

### UAT-EDGE-001: Single-Task Executor is a short pointer with no agent-team machinery
- **Scenario**: The `## Single-Task Executor` section of `lib/skills/power-mode/SKILL.md` must shrink to <= ~12 lines and contain no `Agent({` blocks, no `bypassPermissions` footer, and no reap machinery (`ListAgents` / `TaskStop`); it states "no agent team, no reap sweep".
- **Steps**: Run the unit test command below; the tests "short pointer (<= 12 non-blank lines)" and "carries no Agent({ blocks or team machinery" cover this.
- **Expected Result**: Both tests pass.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Pointer names the three skills in order and keeps the autonomy rule
- **Scenario**: The section lists `/tackle <task-path>`, `/uat-generate <task-path>`, `/uat-auto <uat-path>` in that order, runs them in the current session via the Skill tool, and keeps the "without pausing, asking questions, or awaiting approval between them" rule so `/power-mode <task>` stays autonomous.
- **Steps**: Run the unit test command below; the tests "names /tackle, /uat-generate, /uat-auto in order" and "keeps the 'without pausing' autonomy rule" cover this.
- **Expected Result**: Both tests pass.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Closure is deferred to /uat-auto's UAT-CORE and the resting-state rule survives
- **Scenario**: The section says to stop after `/uat-auto` returns, points at UAT-CORE's Closure procedure for status/archive/index/roadmap-checkbox handling, and keeps the rule that `[FAIL: auto-judge: UI test requires human verification]` / stub-detected tests are an acceptable resting state.
- **Steps**: Run the unit test command below; the test "defers closure to UAT-CORE and keeps the resting-state rule" covers this.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Dispatch bullet and frontmatter description retargeted; name/argument-hint untouched
- **Scenario**: The Dispatch task bullet reads "Single-Task Executor (a pointer at the tackle → uat-generate → uat-auto pipeline; see below)"; the roadmap bullet is unchanged; the frontmatter description ends "runs that pipeline once in the current session and stops."; `name: power-mode` and `argument-hint: "[roadmap-file-path | task-file-path]"` are unchanged.
- **Steps**: Run the unit test command below; the tests "Dispatch task bullet is retargeted at the pointer" and "frontmatter description is reworded; name and argument-hint untouched" cover this.
- **Expected Result**: Both tests pass.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: Roadmap orchestrator and shared sections are left intact
- **Scenario**: Dispatch, Parallelization Mandate, Team Member Requirements, Agent Lifecycle, Single-Task Executor, and Roadmap-to-Completion Orchestrator headings remain in that order; the Roadmap section retains its autonomy mandate, forbidden-actions list, Orchestrator loop Steps 1-4, Phase 1-3 pipeline, and its `Agent({` blocks (no functionality lost).
- **Steps**: Run the unit test command below; the tests "surrounding sections are present and in their original order" and "Roadmap-to-Completion Orchestrator is structurally intact" cover this.
- **Expected Result**: Both tests pass.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: Discovery text in lib/skills/README.md remains truthful
- **Scenario**: The `power-mode` row in `lib/skills/README.md` still says it drives "roadmap or task files through the full tackle → uat-generate → uat-auto pipeline" (a no-op edit is the expected outcome).
- **Steps**: Run the unit test command below; the test "lib/skills/README.md power-mode row still truthful" covers this.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: Component wiki page reports the outcome and keeps required links
- **Scenario**: `wiki/knowledge/entities/components/power-mode-skill.md` no longer calls the shrink a pending "candidate", cites `[[TASK-0100]]`, adds `evolved_by::[[TASK-0100]]` while keeping `evolved_by::[[TASK-003]]`, `relates_to::[[wiki-skill-boilerplate-duplication]]`, `implements::[[Multi-Agent Orchestration Patterns]]`, `id: power-mode-skill`, no `ROADMAP-0013` citation, and its first paragraph no longer says the orchestrator "drives that one task".
- **Steps**: Run the unit test command below; the test "component page reports the outcome and keeps its reverse pointers" covers this.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Existing reverse-pointer suite still passes with the new evolved_by link
- **Scenario**: `test/component-page-reverse-pointers.test.js` (constrains component pages and requires `evolved_by::[[TASK-0100]]` to resolve and TASK-0100 to mention `lib/skills/power-mode/SKILL.md`) is green after the edit.
- **Steps**: Run the unit test command below.
- **Expected Result**: All tests pass, zero failures.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js` (pre-existing suite from TASK-0090; extended coverage of this task's link is in `test/power-mode-single-task-pointer.test.js`)
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->
