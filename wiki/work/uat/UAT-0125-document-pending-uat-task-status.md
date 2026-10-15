---
id: UAT-0125
aliases: [UAT-0125]
title: "UAT: Document pending-uat as a task status in the lifecycle, index headers, /primer check and dashboard"
status: pending
task: TASK-0125
created: 2026-09-20
updated: 2026-09-20
---

# UAT-0125 — UAT: Document pending-uat as a task status in the lifecycle, index headers, /primer check and dashboard

implements::[[TASK-0125]]

> **Source task**: [[TASK-0125]]
> **Generated**: 2026-09-20

TASK-0125 is a documentation-and-data fix: `pending-uat` is added to both `tasks/lifecycle.md` copies, both `tasks/index.md` headers, `/primer`'s consistency check, the sweep-found enumerations (`CLAUDE.md`, `lib/prompts/migrate-wiki.md`, `/primer`'s survey sentence) and the dashboard `STATUS_TONES` map. Every acceptance criterion is a stable string or a small evaluable function, so each case below is backed by a deterministic, read-only `node:test` file. Each `Unit Test Command` was run before this file was written and each `--test-name-pattern` was confirmed to select exactly the number of tests named in the case.

Two test files back the cases: `test/task-lifecycle-pending-uat.test.js` (shipped with TASK-0125, 7 tests: enum/diagram lockstep, index headers, primer sentence, `STATUS_TONES` key, word-boundary rule, tackle-written statuses) and `test/task-lifecycle-pending-uat-crossrefs.test.js` (written by this UAT generation, 13 tests, for what the first file leaves open: bullet order and wording, terminal vs active, the trashed branch, the tone value, the end-user "no badge" symptom across all live tasks, the sweep fixes, the log entry). The new file's tests carry a tag in their names (`[lifecycle-prose]`, `[tone]`, `[live-tasks]`, `[sweep]`, `[log]`) that the commands select.

**Out of scope on purpose**:
- **Skill behaviour**: `/tackle`, `/roadmap-next`, `/power-mode`, `UAT-CORE.md` and `/uat-skip` already handle `pending-uat` and the task fences them off. The recorded, intentionally unchanged `UAT-CORE.md:155` (`todo|in-progress` sibling check) is a separate look, not a defect of this task. Those files also carry uncommitted edits from other in-flight tasks, so no case asserts they are unmodified.
- **The installed copy** `~/.claude/skills/` and `install-global.sh`: the task says not to run it; the installed `/primer` syncs on the next normal install.
- **Known failures from other work** in the full suite (`shared-id-resolution` (f), `skill-frontmatter-aliases` x4) are unrelated; no case here depends on the full suite.

---

## Prerequisites

- [ ] Working directory is the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`) with TASK-0125's implementation present
- [ ] `node` >= 18 on PATH (`node --test` with `--test-name-pattern`)
- [ ] No network, secrets or running services needed for the automated cases; every one is read-only
- [ ] For UAT-MAN-001 only: a free local port and a browser (or the Playwright MCP) to open the dashboard

---

## Test Cases

### UAT-INT-001: The two tasks lifecycle.md copies are byte-identical and carry pending-uat in the enum and diagram
- **Scenario**: The template is the source of truth and `sync-wiki-scaffold.sh` always refreshes the live copy, so `wiki/work/tasks/lifecycle.md` must equal `lib/scripts/templates/wiki/work/tasks/lifecycle.md` exactly. The `status` enum must read `todo | in-progress | pending-uat | done | trashed` (pending-uat between in-progress and done) and the diagram must contain the line `todo ──▶ in-progress ──▶ pending-uat ──▶ done`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. A failure names a divergence between the copies or a missing `pending-uat` in the enum/diagram.
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat.test.js` (shipped with TASK-0125)
- **Unit Test Command**: `node --test --test-name-pattern='both tasks lifecycle.md copies' test/task-lifecycle-pending-uat.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-002: The lifecycle prose puts the pending-uat bullet between in-progress and done and calls it an active state
- **Scenario**: In both copies the `- **pending-uat**` bullet sits after `- **in-progress**` and before `- **done**`; it states that every `## Steps` checkbox is checked and `/tackle` set the status, names `/uat-create`, `/uat-walk` and `/uat-auto`, and says it is an active state that stays listed in `index.md`. `pending-uat` is never described as terminal.
- **Steps**:
  1. Run the unit test command below as-is (selects the bullet-order test for each of the two copies)
  2. Read the summary lines
- **Expected Result**: `tests 2`, `pass 2`, `fail 0` (one per lifecycle copy).
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat-crossrefs.test.js` (written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='pending-uat bullet sits between' test/task-lifecycle-pending-uat-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-003: The done bullet means verification finished (UAT passed or skipped) and only done/trashed are terminal
- **Scenario**: The `- **done**` bullet leads with "verification finished", mentions the UAT passing and `/uat-skip`; the closing sentence "A task reaches **done** only when its UAT is all-pass or skipped" is kept; the never-moved paragraph names only `done` and `trashed` as terminal.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 2`, `pass 2`, `fail 0` (one per lifecycle copy).
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat-crossrefs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='done means UAT passed' test/task-lifecycle-pending-uat-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-004: The transition diagram lets a pending-uat task be trashed
- **Scenario**: The diagram's branch rows show three drops (todo, in-progress, pending-uat) all joining a single `──▶ trashed` arrow, per the task's chosen state model (`trashed` reachable from any non-terminal state).
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 2`, `pass 2`, `fail 0` (one per lifecycle copy).
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat-crossrefs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='trashed is reachable from pending-uat' test/task-lifecycle-pending-uat-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-005: Both tasks/index.md headers and /primer's consistency check name pending-uat as an active status
- **Scenario**: `wiki/work/tasks/index.md` and its template say "Lists **only active** tasks (`todo`, `in-progress`, `pending-uat`)"; `/primer`'s consistency-check sentence lists `pending-uat` among the statuses that must each have exactly one index bullet.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 3`, `pass 3`, `fail 0` (two index headers, one primer sentence).
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat.test.js` (shipped with TASK-0125)
- **Unit Test Command**: `node --test --test-name-pattern='header names pending-uat|primer consistency' test/task-lifecycle-pending-uat.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-006: The sweep-found enumerations (CLAUDE.md, migrate-wiki.md, /primer survey line) include pending-uat
- **Scenario**: Step 5's sweep fixed three genuine omissions: the `CLAUDE.md` tasks/lifecycle Key Files bullet (`todo | in-progress | pending-uat | done | trashed`), the `lib/prompts/migrate-wiki.md` active-tasks list, and `/primer`'s "one line per `todo`/`in-progress`/`pending-uat` task" sentence plus its consistency check.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 2`, `pass 2`, `fail 0` (the `[sweep]` test and the `[log]` test that pins the log entry).
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat-crossrefs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\[sweep\]|\[log\]' test/task-lifecycle-pending-uat-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-007: Both dashboard copies map pending-uat to the in-flight accent tone and resolve suffixed status strings
- **Scenario**: In `wiki/dashboard.html` and `lib/scripts/templates/wiki/dashboard.html`, `STATUS_TONES['pending-uat']` is `'accent'` (the same tone as `in-progress`), every tone is one of `neutral | accent | good | bad | muted`, and `statusKeyword('pending-uat · P2')` and `statusKeyword('PENDING-UAT')` return `pending-uat`.
- **Steps**:
  1. Run the unit test command below as-is (evaluates each dashboard's real `STATUS_TONES` and `statusKeyword` source in `node:vm`)
  2. Read the summary lines
- **Expected Result**: `tests 4`, `pass 4`, `fail 0` (two tests per dashboard copy).
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat-crossrefs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\[tone\]' test/task-lifecycle-pending-uat-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-008: Every live task's status is in the lifecycle enum and renders a dashboard badge
- **Scenario**: This is the end-user symptom the task fixes: 24 of 31 active tasks were `pending-uat` and rendered with no badge. Every top-level `wiki/work/tasks/TASK-*.md` must carry a `status` that is a member of the lifecycle enum, and in both dashboard copies `statusKeyword(status)` must return that same status (never `null`).
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. A failure names the offending task file and dashboard copy.
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat-crossrefs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\[live-tasks\]' test/task-lifecycle-pending-uat-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-001: The word-boundary rule still holds — bare "pending" and "todo" are not swallowed by the new pending-uat key
- **Scenario**: `pending-uat` starts with the existing `pending` keyword. `statusKeyword('pending-uat')` must return `pending-uat` (not `pending`), while `statusKeyword('pending')` must still return `pending` and `statusKeyword('todo')` must return `todo`. No change to `statusKeyword()` was permitted.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 2`, `pass 2`, `fail 0` (one per dashboard copy).
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat.test.js` (shipped with TASK-0125)
- **Unit Test Command**: `node --test --test-name-pattern='word-boundary' test/task-lifecycle-pending-uat.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-002: Every task status /tackle writes is a member of the lifecycle enum (drift guard)
- **Scenario**: `lib/skills/tackle/SKILL.md` must still write `pending-uat` and `in-progress`, and both must be in the lifecycle `status` enum, so the doc and the writer cannot drift apart again.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/task-lifecycle-pending-uat.test.js` (shipped with TASK-0125)
- **Unit Test Command**: `node --test --test-name-pattern='written by /tackle' test/task-lifecycle-pending-uat.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-003: The suites that read tasks/lifecycle.md stay green after the edit
- **Scenario**: `backfill-wiki-aliases`, `wiki-work-naming-convention` and `task-dependency-single-source` parse `tasks/lifecycle.md`; adding a status and a bullet must not break them. The task recorded 32/32 passing across the three.
- **Steps**:
  1. Run the unit test command below as-is (three explicit files; not the full suite)
  2. Read the summary lines
- **Expected Result**: `tests 32`, `pass 32`, `fail 0`, `skipped 0`.
- **Repeatable Unit Test**: Created: `test/backfill-wiki-aliases.test.js`, `test/wiki-work-naming-convention.test.js`, `test/task-dependency-single-source.test.js` (existing suites reused, not modified)
- **Unit Test Command**: `node --test test/backfill-wiki-aliases.test.js test/wiki-work-naming-convention.test.js test/task-dependency-single-source.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-MAN-001: The live dashboard shows an accent badge on pending-uat tasks
- **Scenario**: The unit tests evaluate `statusKeyword` and `STATUS_TONES` in isolation; this case confirms the rendered result in the real dashboard: tasks that were badge-less now show a `pending-uat` pill in the same accent tone as `in-progress`, and a `todo` task still shows its neutral `todo` pill (and is not mis-badged `pending`).
- **Steps**:
  1. From the repo root run `npx @codewizard-dt/bootstrap dashboard 4400` (or `node bin/cli.js dashboard 4400`) and leave it running
  2. Open `http://localhost:4400` and go to the tasks view
  3. Find a `pending-uat` task (for example TASK-0125 itself) and an `in-progress` task (for example TASK-0121); compare the two badges
  4. Find a `todo` task (for example TASK-0126)
  5. Stop the server with Ctrl-C
- **Expected Result**: the `pending-uat` rows show a badge reading `pending-uat` with the same accent styling as the `in-progress` badge; the `todo` row shows a neutral `todo` badge; no `pending-uat` row is badge-less.
- **Repeatable Unit Test**: Not applicable: real browser rendering of the dashboard pill styling; the tone mapping behind it is covered by UAT-INT-007 and UAT-INT-008
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-09-20 -->
