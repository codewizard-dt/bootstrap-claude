---
id: UAT-0097
aliases: [UAT-0097]
title: "UAT: Extract a shared 'archive a work item' reference doc and wire six skills to it"
status: pending
task: TASK-0097
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0097 — UAT: Extract a shared 'archive a work item' reference doc and wire six skills to it

implements::[[TASK-0097]]

> **Source task**: [[TASK-0097]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Repo checked out at the TASK-0097 implementation (`lib/skills/_shared/ARCHIVE-WORK-ITEM.md` present)
- [ ] Node.js available (`node --test` runner; no other dependencies)

---

## Test Cases

### UAT-EDGE-001: Shared doc exists with its five-step Procedure and load-bearing anchors
- **Scenario**: `lib/skills/_shared/ARCHIVE-WORK-ITEM.md` holds the single copy of the archive mechanic: Inputs, five numbered Procedure steps, Row and log formats, Caller deltas, CRITICAL rules, and the "Other consumers (not yet wired)" note. It mentions `git mv`, `archive/index.md`, and `lifecycle.md`, and defers per-family terminal sets to `lifecycle.md` rather than hardcoding them.
- **Steps**: Run the unit test command below.
- **Expected Result**: All assertions in the two named tests pass (exit code 0).
- **Repeatable Unit Test**: Created: `test/archive-work-item.test.js`
- **Unit Test Command**: `node --test test/archive-work-item.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: All six skills point at the shared doc and carry no inline move command
- **Scenario**: `wiki-archive`, `task-audit`, `task-trash`, `roadmap-next`, `bug-triage`, and `bug-close` each reference `ARCHIVE-WORK-ITEM.md`, and none contains `git mv wiki/work/` or a bare `mv wiki/work/` command.
- **Steps**: Run the unit test command below; the per-skill reference and no-inline-move tests cover each skill.
- **Expected Result**: The 12 per-skill tests (reference + no-inline-move, x6) and the `wiki-archive` plain-`mv` test pass.
- **Repeatable Unit Test**: Created: `test/archive-work-item.test.js`
- **Unit Test Command**: `node --test test/archive-work-item.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Drift resolved — wiki-archive uses git mv via the shared doc, not plain mv
- **Scenario**: The `wiki-archive` Step 4 plain `mv` is replaced by the shared Procedure (which mandates `git mv`), with `log: skip` per item and its own Step 5 batch log entry retained.
- **Steps**: Run the unit test command below.
- **Expected Result**: The `wiki-archive` plain-`mv` test and the "keeps its own single batch log entry and passes log: skip" test pass.
- **Repeatable Unit Test**: Created: `test/archive-work-item.test.js`
- **Unit Test Command**: `node --test test/archive-work-item.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Drift resolved — bug-close uses `closed`, never `verified`
- **Scenario**: `bug-close/SKILL.md` maps its "Verify and close" outcome to `closed` (the `bugs/lifecycle.md` enum) with no backticked `` `verified` `` status, no `status: verified`, and no branch gated on "For `verified`". The existing clustering-offer suite still passes after the rename.
- **Steps**: Run the unit test command below (covers both suites).
- **Expected Result**: The `bug-close` `verified` test passes, the `bug-close` parameter test (`closed | wontfix | cannot-reproduce`) passes, and every test in `test/bug-close-clustering-offer.test.js` passes.
- **Repeatable Unit Test**: Created: `test/archive-work-item.test.js`
- **Unit Test Command**: `node --test test/archive-work-item.test.js test/bug-close-clustering-offer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: Drift resolved — bug-triage reject path writes a single log entry
- **Scenario**: `bug-triage` Step 7a delegates to the shared Procedure with `log: skip` and contains no `wiki/log.md` append; Step 9 still owns the one log entry.
- **Steps**: Run the unit test command below.
- **Expected Result**: The bug-triage Step 7a test passes, and the Caller deltas test confirms the `bug-triage` row passes `log: skip`.
- **Repeatable Unit Test**: Created: `test/archive-work-item.test.js`
- **Unit Test Command**: `node --test test/archive-work-item.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: Each caller passes its documented family and terminal status
- **Scenario**: `task-audit` passes `terminal_status: done` (and so gains a log entry via the default), `task-trash` passes `trashed` for the task with log op `task-trashed` and again for related UAT files (`family: uat`), `roadmap-next` passes `family: roadmaps` / `done`, and `bug-close` passes `family: bugs`. The shared doc's Caller deltas table names all six consumers.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "Caller deltas name all six consumers", "task-audit ... task-trash", and "roadmap-next and bug-close" tests pass.
- **Repeatable Unit Test**: Created: `test/archive-work-item.test.js`
- **Unit Test Command**: `node --test test/archive-work-item.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: README and knowledge page are updated
- **Scenario**: `lib/skills/README.md` names `uat-walk/UAT-CORE.md` and the `_shared/` directory (without enumerating its files), and `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md` lists `ARCHIVE-WORK-ITEM.md` and carries `implemented_by::[[TASK-0097]]`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The README test and the knowledge-page test pass.
- **Repeatable Unit Test**: Created: `test/archive-work-item.test.js`
- **Unit Test Command**: `node --test test/archive-work-item.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Full test suite stays green
- **Scenario**: The refactor breaks no other skill-content or script suite.
- **Steps**: Run `npm test` from the repo root.
- **Expected Result**: Exit code 0 with no failing tests (in particular no failures attributable to the six edited skills, the shared doc, or `lib/skills/README.md`).
- **Repeatable Unit Test**: Not applicable: whole-suite run; the file-scoped suites above cover each TASK-0097 contract individually
- [FAIL: auto-judge: npm test exited 1 with 9 failing tests (575 pass) — all in test/skill-frontmatter-aliases.test.js (4: task-add, uat-generate, req-create, roadmap-create) and test/task-typed-links.test.js (5: task-audit x3, task-add x2); none in test/archive-work-item.test.js or bug-close-clustering-offer.test.js; Expected requires exit 0] <!-- 2026-09-19 -->

### UAT-EDGE-009: `_shared/` is not registered as a skill
- **Scenario**: `lib/skills/_shared/` contains reference docs only; a `SKILL.md` there would register a bogus slash command.
- **Steps**: Run the command below.
- **Command**:
  ```bash
  node -e "const fs=require('fs');const d='lib/skills/_shared';console.log(fs.existsSync(d+'/ARCHIVE-WORK-ITEM.md'), fs.existsSync(d+'/SKILL.md'))"
  ```
- **Expected Result**: Prints `true false`.
- **Repeatable Unit Test**: Not applicable: one-line filesystem check with no logic worth a standing test; recorded here as its own machine-checkable command
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: Edited skills read end-to-end with no orphaned step references
- **Scenario**: After the extraction, the six edited `SKILL.md` files (and `roadmap-assess`, which delegates auto-archive to `roadmap-next`) must not point at removed text — e.g. "Step 7a below", numbered items that no longer exist, or leftover references to inline move/index steps.
- **Steps**:
  1. Read `lib/skills/{wiki-archive,task-audit,task-trash,roadmap-next,bug-triage,bug-close}/SKILL.md` and `lib/skills/roadmap-assess/SKILL.md` (~lines 145-146).
  2. For every "Step N" / "above" / "below" / "the procedure" reference, confirm the target still exists and says what the reference implies.
  3. Confirm `bug-close` still handles the non-terminal "fixed" outcome (index-row update, no move) and does not claim `fixed` is a lifecycle status.
- **Expected Result**: No dangling or misleading references; each skill's remaining logic (wiki-archive batch confirmation and Step 5 batch log, task-trash Step 3 confirmation and Step 7 report, roadmap-next "no prompt" contract, bug-triage Step 6 status flip, bug-close Step 10 clustering check) reads coherently.
- **Repeatable Unit Test**: Not applicable: judging whether prose reads coherently has no deterministic oracle; the anchor and drift checks are already covered by UAT-EDGE-001 to UAT-EDGE-007
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->
