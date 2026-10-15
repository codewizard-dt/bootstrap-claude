---
id: UAT-0087
aliases: [UAT-0087]
title: "UAT: bug-close's tag-clustering signal becomes an offered regression-task suggestion"
status: pending
task: TASK-0087
created: 2026-09-13
updated: 2026-09-13
---

# UAT-0087 — UAT: bug-close's tag-clustering signal becomes an offered regression-task suggestion

implements::[[TASK-0087]]

> **Source task**: [[TASK-0087]]
> **Generated**: 2026-09-13

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0087's change to `lib/skills/bug-close/SKILL.md` Step 10.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).

---

## Test Cases

### UAT-EDGE-001: base report bullets stay flat, unconditional, and ahead of the clustering-check bullet
- **Scenario**: The pre-existing report bullets — "Bug ID, title", "Old status → new status; folder move (if any)", "Resolution summary: fix commit, regression test path" — remain top-level, unconditional `Print:` bullets that precede the `verified`-case clustering-check bullet in Step 10. This is the "must not change the report's shape for the common case" acceptance criterion from Step 2 of the task.
- **Steps**: Read `lib/skills/bug-close/SKILL.md` Step 10; confirm the three base bullets appear as flat top-level list items before the "For `verified`: a one-line clustering check" bullet.
- **Expected Result**: All three base bullets are present and precede the clustering-check bullet in document order.
- **Repeatable Unit Test**: Created: `test/bug-close-clustering-offer.test.js`
- **Unit Test Command**: `node --test test/bug-close-clustering-offer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: 2+ related closes trigger the templated inline prompt
- **Scenario**: When the clustering check finds **2 or more** related recent closes (not counting the bug just closed), Step 10 must use `AskUserQuestion` to ask the exact templated question: `N related bugs closed recently with tag(s) <tags> — <BUG-NNNN titles>. File a regression-prevention task? (y/n)`.
- **Steps**: Read `lib/skills/bug-close/SKILL.md` Step 10; confirm the ≥2-related-closes gating language and the exact question template are both present.
- **Expected Result**: Both the threshold gate and the exact question text are present verbatim.
- **Repeatable Unit Test**: Created: `test/bug-close-clustering-offer.test.js`
- **Unit Test Command**: `node --test test/bug-close-clustering-offer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: "yes" answer files a regression task via task-add without --roadmap
- **Scenario**: On a "yes" answer to the prompt, Step 10 must invoke `Skill` `task-add` with a description referencing the clustered bug IDs and shared tag(s), and must explicitly not pass `--roadmap` (no roadmap context exists at this point — the user can link one later via `/task-add --roadmap`).
- **Steps**: Read `lib/skills/bug-close/SKILL.md` Step 10; confirm the "On yes" bullet names `Skill` `task-add` with a bug-ID/tag-referencing description, and confirm the explicit "Do not pass `--roadmap`" instruction is present.
- **Expected Result**: Both the task-add invocation instruction and the no-`--roadmap` instruction are present.
- **Repeatable Unit Test**: Created: `test/bug-close-clustering-offer.test.js`
- **Unit Test Command**: `node --test test/bug-close-clustering-offer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: "no" answer (or ≤1 related close) is an unchanged, silent no-op
- **Scenario**: On a "no" answer, or when ≤1 related close is found, behavior must be unchanged from before this task — print the clustering observation and stop, with no prompt at all.
- **Steps**: Read `lib/skills/bug-close/SKILL.md` Step 10; confirm the exact "On no (or ≤1 related close): unchanged from today — print the clustering observation and stop, no prompt." text is present.
- **Expected Result**: The no-op branch text is present verbatim, confirming no prompt fires in this case.
- **Repeatable Unit Test**: Created: `test/bug-close-clustering-offer.test.js`
- **Unit Test Command**: `node --test test/bug-close-clustering-offer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: new sub-bullets are structurally nested under the verified clustering-check bullet, not top-level
- **Scenario**: The three new sub-bullets (prompt, yes-branch, no-branch) must be nested (2-space-indented) directly beneath the pre-existing "For `verified`: ... clustering check" bullet, so they cannot be misread as unconditional top-level report items and cannot accidentally gate the `fixed`-status branch that follows.
- **Steps**: Read `lib/skills/bug-close/SKILL.md` Step 10; confirm the three lines immediately following the clustering-check bullet are each indented as nested list items, and confirm the "For `fixed`:" bullet remains present and unchanged after them.
- **Expected Result**: All three new lines are nested sub-bullets; the `fixed`-status bullet is untouched.
- **Repeatable Unit Test**: Created: `test/bug-close-clustering-offer.test.js`
- **Unit Test Command**: `node --test test/bug-close-clustering-offer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-MANUAL-001: end-to-end walkthrough with a real 2-related-close cluster
- **Scenario**: Run `/bug-close` on a bug that shares tags with 2+ recently archived bugs, and confirm the live behavior matches the documented contract: the inline prompt appears with correct tag(s)/titles substituted, answering "y" invokes `/task-add` with a sensible description referencing the clustered bug IDs and no `--roadmap` flag, and answering "n" (or having only 0-1 related closes) prints just the clustering observation with no prompt.
- **Steps**:
  1. Ensure `wiki/work/bugs/archive/` has ≥2 closed bugs sharing a common tag (use existing archive contents or file+close two throwaway bugs with a shared tag first).
  2. Close a third bug sharing that same tag via `/bug-close`, choosing "Verify and close".
  3. Observe Step 10's report: confirm the base report (bug ID/title, status transition, resolution summary) prints first, unconditionally.
  4. Confirm the inline prompt appears, naming the correct related bug titles/tag.
  5. Answer "y"; confirm `/task-add` is invoked with a description mentioning the clustered bug IDs and shared tag, and that `--roadmap` is not passed.
  6. Repeat closing a bug with 0-1 tag overlap in the archive; confirm no prompt appears and only the clustering observation prints.
- **Expected Result**: Live behavior matches every static claim verified in UAT-EDGE-001 through 005 above — this is the runtime confirmation that the documented contract is actually followed when a human (or `/uat-walk` operator) executes the skill.
- **Repeatable Unit Test**: Not applicable: requires live `/bug-close` execution, `AskUserQuestion` interaction, and real archive-file state — cannot run inside a deterministic unit-test harness without mocking the whole skill-invocation loop.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

---

## Notes

- This task touched only `lib/skills/bug-close/SKILL.md` — a markdown skill-instruction file interpreted by an LLM at runtime, not executable code. UAT-EDGE-001 through 005 are static text/structure assertions against that file (the only deterministic thing there is to check); UAT-MANUAL-001 is the one case that actually exercises the documented behavior end-to-end and is not unit-test promotable.
- `uatGenerate.promoteTests` resolved to `true` → legacy mapping → `dedicated`. This repo's existing `test/` directory and `node --test` convention were followed (matches `test/task-typed-links.test.js` and `test/wiki-work-naming-convention.test.js`, the closest precedent for SKILL.md-content contract tests).
- One repeatable unit test file backs all 5 EDGE cases: `test/bug-close-clustering-offer.test.js` (7 `node:test` cases). Verified passing: `node --test test/bug-close-clustering-offer.test.js` → 7/7 pass, 0 fail.
- No gaps: every claim in TASK-0087's 2 steps is covered by either a static assertion (EDGE-001..005) or flagged as requiring manual/live verification (MANUAL-001).
