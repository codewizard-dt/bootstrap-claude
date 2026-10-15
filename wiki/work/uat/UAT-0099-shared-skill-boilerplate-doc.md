---
id: UAT-0099
aliases: [UAT-0099]
title: "UAT: Extract a shared skill-boilerplate doc (prereqs line, Edit-hygiene rule, number-allocation algorithm) and wire consuming skills to it"
status: pending
task: TASK-0099
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0099 — UAT: Extract a shared skill-boilerplate doc (prereqs line, Edit-hygiene rule, number-allocation algorithm) and wire consuming skills to it

implements::[[TASK-0099]]

> **Source task**: [[TASK-0099]]
> **Generated**: 2026-09-19

Every case below is backed by a file-scoped unit test that already ships with the task (`test/skill-boilerplate.test.js`, 10 tests; `test/wiki-work-naming-convention.test.js`, 11 tests), except the two Manual cases at the end. No case requires the full `npm test` suite to exit 0: it carries 5 known pre-existing failures (`skill-frontmatter-aliases` x4, `task-typed-links` x1; `TASK-NNN` vs `TASK-NNNN` placeholders left over from TASK-0085) that are unrelated to this task.

---

## Prerequisites

- [ ] Working directory is the repo root (`bootstrap-claude`)
- [ ] Node 18+ available (`node --test` runner)
- [ ] `lib/skills/_shared/SKILL-BOILERPLATE.md` present on disk

---

## Test Cases

### UAT-EDGE-001: Shared doc exists with its three load-bearing sections
- **Scenario**: `lib/skills/_shared/SKILL-BOILERPLATE.md` must exist and carry the headings `## Prereqs`, `## Edit hygiene`, and `## Number allocation`, since every consuming skill points at those section names.
- **Steps**: Run the unit test command below.
- **Command**:
  ```bash
  node --test --test-name-pattern="three shared sections" test/skill-boilerplate.test.js
  ```
- **Expected Result**: 1 test run, 1 pass, 0 fail (`SKILL-BOILERPLATE.md exists and has the three shared sections`).
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` (shipped by TASK-0099 Step 7; test 1)
- **Unit Test Command**: `node --test --test-name-pattern="three shared sections" test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Every inline `**Prereqs:**` line conforms to the single grammar
- **Scenario**: The `**Prereqs:**` line stays inline in each skill (it is the instruction to read `mcp-tools.md`), so only the test keeps it from drifting. Every line starting `**Prereqs:**` in any `lib/skills/*/SKILL.md` must match: `obey \`wiki/guides/mcp-tools.md\`` + optional ` + \`wiki/work/(tasks|bugs|uat)/lifecycle.md\`` + optional `; run /primer if not done this session` + `.`. A vacuous-pass guard requires at least one such line to exist.
- **Steps**: Run the unit test command below.
- **Command**:
  ```bash
  node --test --test-name-pattern="inline .*Prereqs" test/skill-boilerplate.test.js
  ```
- **Expected Result**: 1 test run, 1 pass, 0 fail. On failure the assertion message lists every offending `file:line`.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` (test 2)
- **Unit Test Command**: `node --test --test-name-pattern="inline .*Prereqs" test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Five number-allocation consumers point at the shared section and no longer restate the algorithm
- **Scenario**: `task-add`, `roadmap-create`, `bug-create`, `prd-create`, and `adr-create` must each reference `_shared/SKILL-BOILERPLATE.md` and the phrase `§ Number allocation`, and none may still contain the restated text `zero-pad the result to 4 digits`.
- **Steps**: Run the unit test command below.
- **Command**:
  ```bash
  node --test --test-name-pattern="shared Number allocation section" test/skill-boilerplate.test.js
  ```
- **Expected Result**: 5 tests run (one per consumer), 5 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` (tests 3-7)
- **Unit Test Command**: `node --test --test-name-pattern="shared Number allocation section" test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Hygiene consumers point at the shared Edit hygiene section and do not restate the "never sed/awk" sentence
- **Scenario**: The 17 hygiene consumers (`git-commit`, `req-update`, `update-docs`, `req-extract-decisions`, `adr-create`, `bug-triage`, `prd-finalize`, `uat-skip`, `adr-walkthrough`, `bug-create`, `adr-finalize`, `task-update`, `prd-create`, `roadmap-create`, `tackle`, `req-retire`, `bug-close`) must each reference `_shared/SKILL-BOILERPLATE.md` and `§ Edit hygiene`, and no consumer line may match `never .*sed.*awk` (the allow-list is empty and a stale entry would fail the suite).
- **Steps**: Run the unit test command below.
- **Command**:
  ```bash
  node --test --test-name-pattern="hygiene consumers" test/skill-boilerplate.test.js
  ```
- **Expected Result**: 2 tests run (pointer present; restatement absent), 2 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` (tests 8-9)
- **Unit Test Command**: `node --test --test-name-pattern="hygiene consumers" test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: Shared doc uses only 4-digit `NNNN` placeholders
- **Scenario**: The doc must contain no bare 3-digit placeholder (`TASK-NNN`, `UAT-NNN`, `REQ-NNN`, `ROADMAP-NNN` not followed by another `N`), because the repo convention after TASK-0085 is `NNNN`.
- **Steps**: Run the unit test command below.
- **Command**:
  ```bash
  node --test --test-name-pattern="no bare 3-digit" test/skill-boilerplate.test.js
  ```
- **Expected Result**: 1 test run, 1 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` (test 10)
- **Unit Test Command**: `node --test --test-name-pattern="no bare 3-digit" test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: Retargeted wiki-work-naming-convention EDGE-004 assertion
- **Scenario**: The algorithm moved out of `task-add`, so `test/wiki-work-naming-convention.test.js` EDGE-004 was retargeted (rather than weakened): `lib/skills/task-add/SKILL.md` must contain `_shared/SKILL-BOILERPLATE.md` and `§ Number allocation`, and the shared doc must hold the padding and width text (`zero-padded to 4 digits`, `<digits>`, `regardless of digit count`). The old assertion pinned `zero-pad the result to 4 digits` inside `task-add`, which contradicted this task's requirement that the restated algorithm be removed.
- **Steps**: Run the unit test command below.
- **Command**:
  ```bash
  node --test --test-name-pattern="points at shared Number allocation" test/wiki-work-naming-convention.test.js
  ```
- **Expected Result**: 1 test run, 1 pass, 0 fail (`task-add SKILL.md points at shared Number allocation, which describes 4-digit zero-padding and width-agnostic scanning`).
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js` (EDGE-004, retargeted by TASK-0099 Step 4)
- **Unit Test Command**: `node --test --test-name-pattern="points at shared Number allocation" test/wiki-work-naming-convention.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: New shared doc does not trip the naming-convention placeholder sweep
- **Scenario**: `test/wiki-work-naming-convention.test.js` (EDGE-009) fails on any bare 3-digit placeholder in any `lib/skills/**/*.md`, which now includes `_shared/SKILL-BOILERPLATE.md` and every rewired skill. The whole file (11 tests) must stay green after the wiring edits, including the retargeted EDGE-004 and the check that pre-existing 3-digit `TASK-001` files are untouched.
- **Steps**: Run the unit test command below.
- **Command**:
  ```bash
  node --test test/wiki-work-naming-convention.test.js
  ```
- **Expected Result**: 11 tests run, 11 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js` (existing file, sweep test EDGE-009 and siblings)
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Re-verify step stays visible in each allocation consumer's flow (Manual)
- **Scenario**: Task Step 4 requires the ordering guarantee ("re-scan before `Write`") to stay in each skill's own step list, not buried in the shared doc. Each of the five consumers must keep a dedicated re-verify step that reads "Repeat § Number allocation step 6 (same family and prefix as Step N); never call `Write` before completing it", and the shared doc's `## Number allocation` item 6 must be the matching "Re-verify immediately before `Write`" rule. No unit test asserts this wording today.
- **Steps**:
  1. Use Serena `search_for_pattern` with `substring_pattern="Repeat § Number allocation step 6"` and `relative_path="lib/skills"`, restricted to `**/{task-add,roadmap-create,bug-create,prd-create,adr-create}/SKILL.md`.
  2. Confirm one hit per skill (5 total).
  3. Use Serena `search_for_pattern` with `substring_pattern="Re-verify immediately before"` on `lib/skills/_shared/SKILL-BOILERPLATE.md` and confirm one hit, numbered item 6.
- **Expected Result**: 5 hits in step 2 (one per consumer, each ending "never call `Write` before completing it"); 1 hit in step 3. Any missing skill is a FAIL.
- **Repeatable Unit Test**: Not created: promotable in principle (a string-presence assertion), but this generation run was scoped to `wiki/work/uat/` only by the team lead, so no test file was added. Follow-up: add a `for` loop case to `test/skill-boilerplate.test.js` asserting `Repeat § Number allocation step 6` in each of the five consumers.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-EDGE-009: `_shared/` is a reference directory, not a slash command (Manual)
- **Scenario**: A directory with no `SKILL.md` is not registered as a slash command. `lib/skills/_shared/` must hold only reference docs (no `SKILL.md`), and `lib/skills/README.md` must describe `_shared/` as such while keeping the `uat-walk`/`UAT-CORE.md` sentence accurate.
- **Steps**:
  1. Use Serena `list_dir` on `lib/skills/_shared` and confirm no file named `SKILL.md` is present (`SKILL-BOILERPLATE.md` is expected, and sibling-task docs such as `ARCHIVE-WORK-ITEM.md` may also appear).
  2. Use Serena `search_for_pattern` with `substring_pattern="_shared"` on `lib/skills/README.md` and confirm it says `_shared/` holds reference docs consumed by other skills, has no `SKILL.md`, and is not a slash command.
  3. Use Serena `search_for_pattern` with `substring_pattern="UAT-CORE"` on `lib/skills/README.md` and confirm `uat-walk/` is still described accurately.
- **Expected Result**: No `SKILL.md` under `_shared/`; README states the `_shared/` role in one place and still mentions `UAT-CORE.md` under `uat-walk/`.
- **Repeatable Unit Test**: Not created: promotable in principle, but this run was scoped to `wiki/work/uat/` only; documentation-prose accuracy in the README is a judgment call rather than a deterministic string match.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->
