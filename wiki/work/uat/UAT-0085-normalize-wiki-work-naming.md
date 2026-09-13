---
id: UAT-0085
aliases: [UAT-0085]
title: "UAT: Fix bug-file/roadmap-create filename bugs and standardize wiki/work/ IDs at 4 digits going forward"
status: pending
task: TASK-0085
created: 2026-09-13
updated: 2026-09-13
---

# UAT-0085 — UAT: Fix bug-file/roadmap-create filename bugs and standardize wiki/work/ IDs at 4 digits going forward

implements::[[TASK-0085]]

> **Source task**: [[TASK-0085]]
> **Generated**: 2026-09-13

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0085's changes to `lib/skills/`, `wiki/work/*/lifecycle.md`, `CLAUDE.md`, `wiki/conventions.md`, and their `lib/scripts/templates/` counterparts.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).

---

## Test Cases

### UAT-EDGE-001: bug-file filename fix and re-verify race guard
- **Scenario**: `lib/skills/bug-file/SKILL.md` writes/reports the prefixed filename `BUG-NNNN-<slug>.md` (not the old bare `NNNN-<slug>.md`) and contains a "Step 5a: Re-verify next bug number" section mirroring the race-guard pattern used by `task-add`/`roadmap-create`.
- **Steps**: Read `lib/skills/bug-file/SKILL.md`; confirm the "Present and Confirm", "Write the Bug File", and "Report Completion" steps all reference `wiki/work/bugs/BUG-NNNN-<slug>.md`; confirm a `### Step 5a: Re-verify next bug number` heading exists between the confirm and write steps.
- **Expected Result**: Every filename reference uses the `BUG-` prefix; the Step 5a re-verify section is present.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-002: roadmap-create filename fix and 4-digit width
- **Scenario**: `lib/skills/roadmap-create/SKILL.md` writes/reports `ROADMAP-NNNN-slug.md` (4-digit, prefixed) with zero remaining bare `NNN-slug.md` / bare 3-digit `NNN-` mentions, and the worked slug examples (`ROADMAP-0001-ship-billing-portal.md`, `ROADMAP-0004-migrate-postgres-17.md`) are updated to the prefixed 4-digit form.
- **Steps**: Read `lib/skills/roadmap-create/SKILL.md`; confirm `wiki/work/roadmaps/ROADMAP-NNNN-slug.md` appears in the "locate directory" and "write" steps and the index/report steps; confirm no literal `wiki/work/roadmaps/NNN-slug.md` or unprefixed `001-ship-billing-portal.md`/`004-migrate-postgres-17.md` strings remain; confirm no bare `ROADMAP-NNN` (3-digit, not followed by a 4th `N`) token remains.
- **Expected Result**: All filename and slug-example references are 4-digit and `ROADMAP`-prefixed; no bare 3-digit forms remain.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-003: roadmap-next stale example removed
- **Scenario**: `lib/skills/roadmap-next/SKILL.md` no longer contains the stale `003-billing.md` → `ROADMAP-003` bare-filename fallback example.
- **Steps**: Read `lib/skills/roadmap-next/SKILL.md`; confirm no `003-billing` or bare `ROADMAP-003` (not followed by a digit) substring remains.
- **Expected Result**: Zero matches for the stale example strings.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-004: task-add 4-digit width-agnostic scanning
- **Scenario**: `lib/skills/task-add/SKILL.md` describes 4-digit zero-padding of the *result* of the next-task-number computation, and describes scanning by numeric value (`TASK-<digits>` prefix) regardless of how many digits are present, so 3-digit and 4-digit filenames coexisting doesn't cause a collision or a missed high number.
- **Steps**: Read `lib/skills/task-add/SKILL.md`; confirm the "Determine the next task number" and "Re-verify next task number" steps contain "zero-pad the result to 4 digits", the `TASK-<digits>` token, and "regardless of digit count".
- **Expected Result**: All three phrases are present in the number-scanning logic.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-005: req-create width, race guard, and index-format wording fix
- **Scenario**: `lib/skills/req-create/SKILL.md` describes `REQ-NNNN` (4-digit), contains a "Step 5a: Re-verify next requirement number" section, and its index-update step describes the flat-bullet entry format (matching every other family's `index.md`) rather than the old, inaccurate "Row/columns" table wording.
- **Steps**: Read `lib/skills/req-create/SKILL.md`; confirm `wiki/work/requirements/REQ-NNNN-slug.md` appears; confirm a `### Step 5a: Re-verify next requirement number` heading exists; confirm the index-update step's text reads `- [REQ-NNNN — Title](REQ-NNNN-slug.md) — one-line summary · status` and that the string "Row/columns" no longer appears anywhere in the file.
- **Expected Result**: 4-digit ID, race guard present, flat-bullet format documented, no stale "Row/columns" wording.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-006: decision-create race guard added, DEC-NNNN unchanged
- **Scenario**: `lib/skills/decision-create/SKILL.md` contains a re-verify-before-write step ("Step 4.5: Re-verify next decision number") inserted between "Clarify with the user" and "Generate the file", and still describes `DEC-NNNN` — unchanged, since decisions were already 4-digit before this task.
- **Steps**: Read `lib/skills/decision-create/SKILL.md`; confirm the `## Step 4.5: Re-verify next decision number` heading exists; confirm `DEC-NNNN` still appears throughout (frontmatter template, heading template, index/log formats).
- **Expected Result**: Step 4.5 present; `DEC-NNNN` unchanged.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-007: repo lifecycle.md files state correct ID widths
- **Scenario**: All 4 repo `wiki/work/{tasks,uat,requirements,roadmaps}/lifecycle.md` files state a 4-digit ID scheme (`TASK-NNNN`/`UAT-NNNN`/`REQ-NNNN`/`ROADMAP-NNNN`), while `wiki/work/bugs/lifecycle.md` and `wiki/work/decisions/lifecycle.md` remain unchanged — they were already 4-digit (`BUG-NNNN`/`DEC-NNNN`) before this task and this task did not touch them.
- **Steps**: Read all 6 `lifecycle.md` files' "ID scheme" line; confirm the 4 changed families state "(4-digit, zero-padded)" against the correct 4-digit token; confirm bugs/decisions still state "(4-digit, zero-padded...)" against `BUG-NNNN`/`DEC-NNNN`.
- **Expected Result**: 4 files show the newly-stated 4-digit scheme; 2 files show the pre-existing, unchanged 4-digit scheme.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-008: CLAUDE.md and wiki/conventions.md updated, DEC/BUG left alone
- **Scenario**: `CLAUDE.md` and `wiki/conventions.md` state 4-digit tokens for the 4 changed families (no stale bare-3-digit `TASK-NNN`/`UAT-NNN`/`REQ-NNN`/`ROADMAP-NNN` tokens remain) and leave `DEC-NNNN`/`BUG-NNNN` mentions unchanged (still present, still 4-digit).
- **Steps**: Search both files for the negative-lookahead stale-token regex `TASK-NNN(?!N)|UAT-NNN(?!N)|REQ-NNN(?!N)|ROADMAP-NNN(?!N)`; confirm zero matches. Confirm `DEC-NNNN` and `BUG-NNNN` are still present in both files.
- **Expected Result**: Zero stale-token matches; `DEC-NNNN`/`BUG-NNNN` present and unchanged in both files.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-009: comprehensive sweep — zero remaining stale tokens across lib/skills/
- **Scenario**: The mechanical relabeling sweep (TASK-0085 Steps 10-11) is complete: zero remaining matches for the negative-lookahead regex `TASK-NNN(?!N)|UAT-NNN(?!N)|REQ-NNN(?!N)|ROADMAP-NNN(?!N)` across every `.md` file under `lib/skills/` (recursive). This is the strongest, most valuable regression guard in this UAT — it directly encodes "the mechanical sweep is complete and won't silently regress" for all ~34 touched skill files, not just the 6 spot-checked above.
- **Steps**: Recursively walk `lib/skills/**/*.md`; test each file's contents against the stale-token regex; collect any offending file paths.
- **Expected Result**: The offender list is empty.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

### UAT-EDGE-010: no existing 3-digit file renamed or lost
- **Scenario**: TASK-0085 is a strictly forward-only convention change — no existing 3-digit-ID work-item file was renamed, renumbered, or deleted. Confirmed via `wiki/work/tasks/archive/TASK-001-audit-skill-readme-drift.md`, a pre-existing 3-digit task file (located via `mcp__serena__find_file` rather than assumed), which must still exist at its original filename.
- **Steps**: Check `fs.existsSync` on `wiki/work/tasks/archive/TASK-001-audit-skill-readme-drift.md`.
- **Expected Result**: File exists, unchanged filename.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test test/wiki-work-naming-convention.test.js`
- [ ] Pass

---

## Notes

- All 10 EDGE cases above were verified against the actual current file contents (via `mcp__serena__search_for_pattern` and targeted reads) before being written — none were assumed from the task file's own claims. Every claim in `TASK-0085`'s 12 steps that this UAT covers held true on inspection; no gaps were found requiring a case to be dropped or written as a known-failing regression.
- This task touched only markdown/HTML documentation and skill-instruction text — there is no running server, API, or UI to exercise, so every case above is a deterministic text/pattern assertion, and all 10 were unit-test promotable per `uatGenerate.promoteTests` (resolved value: `true` → legacy mapping → `dedicated`; this repo's existing `test/` directory and `node --test` convention were followed, per `lib/skills/uat-generate/SKILL.md`'s "project's layout outranks the stored answer" rule).
- One repeatable unit test file backs all 10 cases: `test/wiki-work-naming-convention.test.js` (11 `node:test` cases — EDGE-007 is split into two test functions, one for the 4 changed lifecycle files and one for the 2 unchanged ones). Verified passing: `node --test test/wiki-work-naming-convention.test.js` → 11/11 pass, 0 fail.
