---
id: UAT-0093
aliases: [UAT-0093]
title: "UAT: Fold decision-next's task-less-decision check into a scheduled wiki-lint/wiki-tidy pass"
status: pending
task: TASK-0093
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0093 — UAT: Fold decision-next's task-less-decision check into a scheduled wiki-lint/wiki-tidy pass

implements::[[TASK-0093]]

> **Source task**: [[TASK-0093]]
> **Generated**: 2026-09-19

> **Note on the check count**: the task text says wiki-tidy should say "all 12 checks", but `/wiki-lint` actually has **13** checks (2.0–2.12; the old wiki-tidy list of 10 also omitted 2.10 provenance). The implementer deliberately wrote "all 13 checks, 2.0–2.12". These tests expect **13**.

---

## Prerequisites

- [ ] Working directory is the `bootstrap-claude` repo root
- [ ] Edits were made to `lib/skills/` (repo source of truth), not `~/.claude/skills/`
- [ ] For the two runtime tests: `wiki/work/decisions/archive/DEC-0001-wiki-cross-family-linking-schema.md` still has D1–D4 `accepted` with `Source task(s): none yet …` (verify before running; if a task has since been linked, adjust the expected set accordingly)

---

## Test Cases

### UAT-CHK-001: wiki-lint gains check 2.12 in the right place
- **Scenario**: `lib/skills/wiki-lint/SKILL.md` contains exactly one `### 2.12 Task-less accepted decisions (MEDIUM)` heading, after 2.10 and 2.11 and before `## Step 3`.
- **Steps**: Run the unit test command below and confirm the placement/heading tests pass.
- **Expected Result**: Test "wiki-lint has ### 2.12 … after 2.10 and 2.11, before Step 3" passes; headings run contiguously 2.0–2.12 (13 checks).
- **Repeatable Unit Test**: Created: `test/wiki-lint-taskless-decisions.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CHK-002: 2.12 ports decision-next's Step 2 scan logic
- **Scenario**: 2.12 scans every decision file in `wiki/work/decisions/` (excluding `lifecycle.md`, including `archive/`), parses `## D\d+\.` blocks, gates on `Status: accepted` (skipping proposed / deprecated / superseded), and treats an absent `### Links` section, a missing `Source task(s):` line, or a blank/placeholder (`none yet`) line as task-less.
- **Steps**: Run the unit test command; then read `lib/skills/wiki-lint/SKILL.md` § 2.12 side by side with `lib/skills/adr-next/SKILL.md` § Step 2 and confirm the criteria match.
- **Expected Result**: Test "wiki-lint 2.12 ports the decision-next Step 2 scan logic …" passes; no criterion from decision-next Step 2 is dropped.
- **Repeatable Unit Test**: Created: `test/wiki-lint-taskless-decisions.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CHK-003: 2.12 reports every instance, not just the first, in the specified format
- **Scenario**: Unlike `/adr-next` (stops at first gap), 2.12 must report all task-less accepted decisions across all files, stay report-only, and use the exact format `[MEDIUM] task-less accepted decision — DEC-NNNN#DM (<title>) has no Source task(s) link`.
- **Steps**: Run the unit test command.
- **Expected Result**: Tests "reports EVERY task-less accepted decision" and "uses the exact MEDIUM report format" pass; 2.12 contains no stop-at-first language.
- **Repeatable Unit Test**: Created: `test/wiki-lint-taskless-decisions.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CHK-004: wiki-tidy says "all 13 checks, 2.0–2.12" and names the new checks
- **Scenario**: `lib/skills/wiki-tidy/SKILL.md` Phase 1 step 2 reads "Run all 13 checks, 2.0–2.12 (…)" and the parenthesised list names 13 checks including provenance/confidence, typed-link target resolution, and task-less accepted decisions. The stale "all 10 checks" and the miscounted "all 12 checks" must not appear.
- **Steps**: Run the unit test command.
- **Expected Result**: Tests for "all 13 checks", "names the previously-missing checks", and "one entry per wiki-lint check (13)" pass.
- **Repeatable Unit Test**: Created: `test/wiki-lint-taskless-decisions.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CHK-005: wiki-tidy references, not restates, the check logic
- **Scenario**: wiki-tidy Phase 1 points at `/wiki-lint` for check logic ("each check's logic lives in `/wiki-lint`") and does not inline 2.12's scan logic (`Source task(s):`, `### Links`, `## D\d+`, `Status: accepted`).
- **Steps**: Run the unit test command.
- **Expected Result**: Test "wiki-tidy references (does not restate) the 2.12 logic" passes.
- **Repeatable Unit Test**: Created: `test/wiki-lint-taskless-decisions.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CHK-006: decision-next gains only the cross-reference line
- **Scenario**: `lib/skills/adr-next/SKILL.md` has the verbatim line "This same check now also runs as part of `/wiki-lint` (check 2.12) for scheduled sweeps across every decision file at once — use this skill directly when you want just the next single gap, fast." once, after the intro and before `## Step 0`. Behavior is unchanged: still `model: claude-haiku-4-5-20251001`, description unchanged, Step 2 and Step 3 intact, still "Stop at the **first** gap".
- **Steps**: Run the unit test command; then run `git diff lib/skills/adr-next/SKILL.md` and confirm the only hunk is the added line (plus its blank separator).
- **Expected Result**: Tests "carries the verbatim 2.12 cross-reference …" and "behavior is unchanged …" pass; diff shows a single added line.
- **Repeatable Unit Test**: Created: `test/wiki-lint-taskless-decisions.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-001: /wiki-lint surfaces every task-less accepted decision at runtime
- **Scenario**: Running `/wiki-lint` on this repo reports the task-less accepted decisions across all decision files (including `archive/`) as separate MEDIUM findings.
- **Steps**:
  1. Confirm the prerequisite state of `wiki/work/decisions/archive/DEC-0001-wiki-cross-family-linking-schema.md` (D1–D4 accepted, `Source task(s): none yet …`).
  2. Run `/wiki-lint`.
  3. Read the Step 3 report; when asked "Which findings should I fix?", reply `none`.
- **Expected Result**: The report includes one line per task-less accepted decision, e.g. `[MEDIUM] task-less accepted decision — DEC-0001#D1 (<title>) has no Source task(s) link`, likewise for D2, D3, D4 (all four listed, not just the first). Findings are grouped under MEDIUM. No files are modified except the standard `lint` log entry.
- **Repeatable Unit Test**: Not applicable: exercises the LLM-executed skill against live wiki content; the deterministic contract is covered by UAT-CHK-001..006
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-INT-002: /wiki-tidy Phase 1 runs the new check via wiki-lint
- **Scenario**: `/wiki-tidy` Phase 1 runs all 13 checks by delegating to `/wiki-lint` and includes the 2.12 findings.
- **Steps**:
  1. Run `/wiki-tidy`.
  2. In Phase 1 confirm the run announces or performs all 13 checks (2.0–2.12) and the report includes the `task-less accepted decision` findings.
  3. At the "Which findings should I fix?" prompt reply `stop` to end wiki-tidy.
- **Expected Result**: Phase 1 output includes the task-less accepted decision findings; wiki-tidy ends at Phase 1 on `stop`; no archive or log-rotation phase runs and no decision files are edited.
- **Repeatable Unit Test**: Not applicable: interactive multi-phase skill run against live wiki content
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-EDGE-001: Source-of-truth boundary — only repo copies are edited
- **Scenario**: The three edits live under `lib/skills/`; the machine-local `~/.claude/skills/` copies are untouched by this task (install-global.sh owns those).
- **Steps**: Run `git status --short lib/skills/wiki-lint lib/skills/wiki-tidy lib/skills/adr-next` and confirm all three show as modified in the repo.
- **Expected Result**: All three repo SKILL.md files appear as modified; no instruction in any of them tells an agent to edit `~/.claude/skills/`.
- **Repeatable Unit Test**: Not applicable: a git working-tree state check, not a deterministic content assertion (content-side coverage is in UAT-CHK-006)
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-EDGE-002: Placeholder and absent-Links forms are all treated as task-less
- **Scenario**: The task-less definition covers all three shapes — `### Links` absent, `Source task(s):` line absent, and `Source task(s):` blank or a placeholder such as `none yet — created via /task-add …` (the exact form DEC-0001 uses).
- **Steps**: Read § 2.12 in `lib/skills/wiki-lint/SKILL.md` and confirm each of the three shapes is listed; compare against the real placeholder line in `DEC-0001-…#D1` (`- Source task(s): none yet — …`).
- **Expected Result**: All three shapes are named, and the DEC-0001 placeholder line is recognisably covered by the "blank / contains only a placeholder (e.g. "none yet")" clause.
- **Repeatable Unit Test**: Created: `test/wiki-lint-taskless-decisions.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->
