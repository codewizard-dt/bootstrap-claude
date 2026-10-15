---
id: UAT-0095
aliases: [UAT-0095]
title: "UAT: Align bug-file with bugs/lifecycle.md: write status open, not new"
status: pending
task: TASK-0095
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0095 — UAT: Align bug-file with bugs/lifecycle.md: write status open, not new

implements::[[TASK-0095]]

> **Source task**: [[TASK-0095]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0095's change to `lib/skills/bug-create/SKILL.md`.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).

---

## Test Cases

### UAT-EDGE-001: bug-create uses status `open` at all three sites
- **Scenario**: `lib/skills/bug-create/SKILL.md` names the filed status `open` in the intro sentence (line 13, "with status `open`"), the Step 6 field list (`- \`Status: open\``), and the Step 8 completion report (``- Status: `open` ``).
- **Steps**: Read `lib/skills/bug-create/SKILL.md`; locate each of the three sites and confirm the value.
- **Expected Result**: All three sites read `open`.
- **Repeatable Unit Test**: Created: `test/bug-file-status-open.test.js`
- **Unit Test Command**: `node --test test/bug-file-status-open.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: no legacy status `new` remains in bug-create
- **Scenario**: The legacy value must not survive anywhere in the skill — a bug filed as `new` would be ignored by `bug-triage` and `bug-assess`.
- **Steps**: Search `lib/skills/bug-create/SKILL.md` for `Status: new`, ``Status: `new` ``, and ``with status `new` ``.
- **Expected Result**: Zero matches for any of the three patterns.
- **Repeatable Unit Test**: Created: `test/bug-file-status-open.test.js`
- **Unit Test Command**: `node --test test/bug-file-status-open.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: the status bug-create writes is a member of the lifecycle.md enum, with `open` first
- **Scenario**: `wiki/work/bugs/lifecycle.md` is the authority for the bug `status` enum (`open | triaged | in-progress | closed | wontfix | duplicate | cannot-reproduce`). The value written by bug-create Step 6 must be a member, and `open` must be the enum's first (filed) member, guarding against re-drift in either file.
- **Steps**: Read the `status` row of the frontmatter table in `wiki/work/bugs/lifecycle.md` and the Step 6 `Status:` bullet in `lib/skills/bug-create/SKILL.md`; compare.
- **Expected Result**: Step 6's value is in the enum and `open` is its first member.
- **Repeatable Unit Test**: Created: `test/bug-file-status-open.test.js`
- **Unit Test Command**: `node --test test/bug-file-status-open.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Step 7 inherits the status and downstream consumers key on `open`
- **Scenario**: Step 7's index entry must take its `<status>` from Step 6 (so it needs no separate edit), and `bug-triage` (Step 1 gate) and `bug-assess` (batch-triage condition) must both recognise `status: open`, so a freshly filed bug is actually picked up.
- **Steps**: Read Step 7 of `lib/skills/bug-create/SKILL.md`, the Step 1 gate of `lib/skills/bug-triage/SKILL.md`, and the batch-triage condition of `lib/skills/bug-assess/SKILL.md`.
- **Expected Result**: Step 7 says `<status>` is the status set in Step 6; `bug-triage` proceeds on ``status: open`` or ``status: triaged``; `bug-assess` runs batch triage when at least one bug is ``status: open``.
- **Repeatable Unit Test**: Created: `test/bug-file-status-open.test.js`
- **Unit Test Command**: `node --test test/bug-file-status-open.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: neighbouring Step 6 bullets and lifecycle.md are untouched
- **Scenario**: The task's scope is the status value only — the adjacent `Last updated` / `aliases: [BUG-NNNN]` bullet pair (asserted verbatim by `test/skill-frontmatter-aliases.test.js`) must still be adjacent, and `wiki/work/bugs/lifecycle.md` must be unchanged by this task.
- **Steps**: Run the sibling suite; run `git diff --stat -- wiki/work/bugs/lifecycle.md` and confirm it is empty for TASK-0095's commit range.
- **Expected Result**: The bug-create assertions in `test/skill-frontmatter-aliases.test.js` pass, and `lifecycle.md` shows no TASK-0095 diff. Note: other in-flight tasks' templates (req-create, roadmap-create, task-add, uat-generate) may cause unrelated failures in that suite; judge only the bug-create cases.
- **Repeatable Unit Test**: Not applicable: the sibling suite spans other skills whose in-flight edits can fail it independently of this task, so it is a poor single-case oracle; the lifecycle.md no-diff check is a git query, not a unit assertion.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->
