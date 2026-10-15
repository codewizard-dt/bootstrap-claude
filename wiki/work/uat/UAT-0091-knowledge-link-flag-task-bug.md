---
id: UAT-0091
aliases: [UAT-0091]
title: "UAT: Add an optional knowledge-link flag to /task-add and /bug-file"
status: pending
task: TASK-0091
created: 2026-09-13
updated: 2026-09-13
---

# UAT-0091 — UAT: Add an optional knowledge-link flag to /task-add and /bug-file

implements::[[TASK-0091]]

> **Source task**: [[TASK-0091]]
> **Generated**: 2026-09-13

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0091's changes to `lib/skills/task-add/SKILL.md`, `lib/skills/bug-create/SKILL.md`, and `CLAUDE.md`.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).
- [ ] At least one existing page under `wiki/knowledge/concepts/` (e.g. `wiki-work-family-cross-linking-gaps.md`) to use as a real slug during the manual walkthrough.

---

## Test Cases

### UAT-EDGE-001: task-add's argument-hint and new Step 2b exist without renumbering Steps 2-4
- **Scenario**: `lib/skills/task-add/SKILL.md`'s `argument-hint:` frontmatter advertises `[--knowledge <slug>]` alongside the pre-existing `--decision`/`--roadmap` hints, and a new "Step 2b" knowledge-detection step exists between the pre-existing Step 3 and Step 4 without renumbering either.
- **Steps**: Read `lib/skills/task-add/SKILL.md`; confirm the `argument-hint:` line includes all three flag hints; confirm Step 2, Step 3, and Step 4 headings are unchanged; confirm a "### Step 2b: Parse and validate knowledge reference" heading exists.
- **Expected Result**: All four headings/hints are present as described.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: task-add Step 2b detects both flag and bare-slug forms, searches both knowledge directories
- **Scenario**: Step 2b must detect `--knowledge <slug>` as well as a bare slug matching an existing page filename, and must use `mcp__serena__find_file` to search both `wiki/knowledge/concepts/` and `wiki/knowledge/sources/`.
- **Steps**: Read `lib/skills/task-add/SKILL.md` Step 2b; confirm both detection forms are documented and both directories are named as search targets via `mcp__serena__find_file`.
- **Expected Result**: Both detection forms and both search directories are present.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: task-add Step 2b never blocks task creation on an unresolved slug
- **Scenario**: If the slug is not found in either knowledge directory, Step 2b must warn and continue — task creation must never be blocked on a missing knowledge page.
- **Steps**: Read `lib/skills/task-add/SKILL.md` Step 2b; confirm the "If not found" warning language and the explicit "never block task creation on a missing knowledge page" statement are both present.
- **Expected Result**: Both statements are present verbatim.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: task-add Step 8 body template writes relates_to::[[<slug>]] between implements:: and depends_on::
- **Scenario**: When Step 2b resolves a knowledge reference, the new task's body template (Step 8) must include a `relates_to::[[<slug>]]` typed-link line positioned after `implements::[[DEC-NNNN#DM]]` (when present) and before the `depends_on::`/`blocks::` lines, matching the documented "immediately after implements::, else immediately after the H1" rule.
- **Steps**: Read `lib/skills/task-add/SKILL.md` Step 8; confirm the body-template code block shows `relates_to::[[<slug>]]` between `implements::[[DEC-NNNN#DM]]` and `depends_on::[[TASK-NNNN]]`; confirm the explanatory "Knowledge link" prose paragraph documents the same positioning rule.
- **Expected Result**: Both the template ordering and the explanatory prose match.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: bug-create's argument-hint and Step 3 gain an optional, non-required Knowledge exception
- **Scenario**: `lib/skills/bug-create/SKILL.md`'s `argument-hint:` frontmatter advertises `[--knowledge <slug>]`, and Step 3 ("Gather Required Fields via Q&A") gains a "Knowledge exception" paragraph explicitly marked optional/non-required, detecting the same flag/bare-slug forms and searching the same two knowledge directories via `mcp__serena__find_file`.
- **Steps**: Read `lib/skills/bug-create/SKILL.md`; confirm the `argument-hint:` line includes `[--knowledge <slug>]`; confirm Step 3 contains a "**Knowledge exception** (optional, non-required):" paragraph naming `--knowledge <slug>`, `mcp__serena__find_file`, and both `wiki/knowledge/concepts/` / `wiki/knowledge/sources/`.
- **Expected Result**: All elements are present as described.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: bug-create Step 3 never blocks bug filing on an unresolved slug, and silently skips when absent
- **Scenario**: An unresolved slug must warn and continue (never block bug filing); when no knowledge reference is given at all, the exception is skipped entirely and no `relates_to::` line is written.
- **Steps**: Read `lib/skills/bug-create/SKILL.md` Step 3; confirm the "never block bug filing on a missing knowledge page" statement and the "skip this exception entirely (no `relates_to::` line is written in Step 6)" statement are both present verbatim.
- **Expected Result**: Both statements are present verbatim.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: bug-create Step 6 inserts relates_to::[[<slug>]] directly under the H1, omitted (not blanked) when unresolved
- **Scenario**: When a knowledge reference resolved, Step 6 must insert `relates_to::[[<slug>]]` as a new line directly under the bug file's `# BUG-NNNN — <title>` H1, before body prose — this is a new line (bug files have no prior typed-link line near the top, unlike tasks). When unresolved, the line must be omitted entirely, never written as an empty placeholder.
- **Steps**: Read `lib/skills/bug-create/SKILL.md` Step 6; confirm the "Knowledge link" paragraph and its fenced template block show `relates_to::[[<slug>]]` between the H1 and the body-prose placeholder; confirm the "omit the line entirely — do not write an empty placeholder" statement is present.
- **Expected Result**: Both the template ordering and the omission rule are present as described.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: CLAUDE.md's Custom Commands table mentions --knowledge <slug> for both /task-add and /bug-create
- **Scenario**: The Custom Commands table row for `/task-add <desc>` and the row for `/bug-create <description>` must each mention the new optional `--knowledge <slug>` flag.
- **Steps**: Read `CLAUDE.md`; locate the `/task-add <desc>` and `/bug-create <description>` table rows; confirm each mentions `--knowledge <slug>`.
- **Expected Result**: Both rows mention the flag.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-MANUAL-001: end-to-end walkthrough — /task-add --knowledge and /bug-create --knowledge against a real page
- **Scenario**: Run `/task-add` and `/bug-create` with a real `--knowledge <slug>` pointing at an existing page (e.g. `wiki-work-family-cross-linking-gaps`), and confirm the live behavior matches the documented contract: the resulting task/bug file carries a `relates_to::[[<slug>]]` typed link in the right position, and confirm the not-found path warns without blocking creation when given a nonexistent slug.
- **Steps**:
  1. Run `/task-add "test knowledge link" --knowledge wiki-work-family-cross-linking-gaps` (or an equivalent existing concepts/sources slug). Confirm the created task file has `relates_to::[[wiki-work-family-cross-linking-gaps]]` immediately after the H1 (or after `implements::` if a decision was also linked).
  2. Run `/bug-create` with a `--knowledge <same-slug>` and minimal required fields. Confirm the created bug file has `relates_to::[[<slug>]]` directly under its H1.
  3. Repeat either command with `--knowledge does-not-exist-slug-xyz`. Confirm a warning is shown and the task/bug file is still created successfully, with no `relates_to::` line written.
  4. Clean up: trash or delete the throwaway task/bug files created for this test so they don't pollute the active index (`/task-trash` for the task; manually remove the bug entry and file, or leave it and note it in this test's result if the team prefers a real record — operator's call).
- **Expected Result**: Live behavior matches every static claim verified in UAT-EDGE-001 through 008 above — this is the runtime confirmation that the documented contract is actually followed when a human (or `/uat-walk` operator) executes both skills.
- **Repeatable Unit Test**: Not applicable: requires live `/task-add` and `/bug-create` execution with `AskUserQuestion` interaction and real file creation — cannot run inside a deterministic unit-test harness without mocking the whole skill-invocation loop.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

---

## Notes

- This task touched `lib/skills/task-add/SKILL.md`, `lib/skills/bug-create/SKILL.md`, and `CLAUDE.md` — the two SKILL.md files are markdown skill-instructions interpreted by an LLM at runtime, not executable code. UAT-EDGE-001 through 008 are static text/structure assertions against those files and CLAUDE.md (the only deterministic thing there is to check); UAT-MANUAL-001 is the one case that actually exercises the documented behavior end-to-end and is not unit-test promotable.
- `uatGenerate.promoteTests` resolved to `true` → legacy mapping → `dedicated`. This repo's existing `test/` directory and `node --test` convention were followed (matches `test/bug-close-clustering-offer.test.js`, the closest precedent for a multi-file SKILL.md-content contract test).
- One repeatable unit test file backs all 8 EDGE cases: `test/knowledge-link-flag.test.js` (13 `node:test` cases, covering both SKILL.md files and the CLAUDE.md table). Verified passing: `node --test test/knowledge-link-flag.test.js` → 13/13 pass, 0 fail.
- No gaps: every checkbox across TASK-0091's 3 steps is covered by either a static assertion (EDGE-001..008) or flagged as requiring manual/live verification (MANUAL-001).
- Per the task's warning callout, this task's edits to `lib/skills/task-add/SKILL.md` were scoped to Steps 2b/8 only (the `--decision`/`--roadmap` area and body template), leaving `TASK-0088`'s Step 5 dependency-scan area untouched — confirmed by re-reading the file: Step 5 ("Identify dependencies") is unchanged.
