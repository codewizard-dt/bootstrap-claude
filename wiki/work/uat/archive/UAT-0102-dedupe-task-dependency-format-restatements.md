---
id: UAT-0102
aliases: [UAT-0102]
title: "UAT: Point task-add, task-update, and task-audit at tasks/lifecycle.md's frontmatter-array dependency schema"
status: passed
task: TASK-0102
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0102 — UAT: Point task-add, task-update, and task-audit at tasks/lifecycle.md's frontmatter-array dependency schema

implements::[[TASK-0102]]

> **Source task**: [[TASK-0102]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0102's edits to `lib/skills/task-add/SKILL.md`, `lib/skills/task-update/SKILL.md`, `lib/skills/task-audit/SKILL.md`, `lib/scripts/templates/wiki/work/tasks/lifecycle.md`, and `wiki/work/tasks/lifecycle.md`.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).
- [ ] Do NOT gate on the full `npm test` suite: it has pre-existing, unrelated failures (3-digit `TASK-NNN` vs 4-digit `TASK-NNNN` placeholder assertions, a TASK-0085 leftover). Every case below uses a file-scoped command.

---

## Test Cases

### UAT-EDGE-001: Both lifecycle.md copies carry a "Dependency fields" paragraph between the schema table and Status transitions
- **Scenario**: `lib/scripts/templates/wiki/work/tasks/lifecycle.md` (canonical) and `wiki/work/tasks/lifecycle.md` (local dogfood copy) each contain the `**Dependency fields.**` paragraph immediately after the frontmatter schema table (last row `parallel_safe_with`) and before `## Status transitions`, with the `depends_on` / `blocks` / `parallel_safe_with` table rows and the status enumeration untouched.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the placement, table-row, and status-enumeration assertions pass for both copies.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js` (placement/status-list) and `test/task-dependency-single-source.test.js` (table rows)
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js test/task-dependency-single-source.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: The paragraph states arrays of `TASK-NNNN` IDs, `[]` when empty, and sole authoritative machine-read (DEC-0001#D4)
- **Scenario**: Per TASK-0102 Step 1(a), the paragraph must say the three fields are YAML arrays of `TASK-NNNN` IDs, `[]` when empty, and are the sole authoritative, machine-read encoding of task dependencies, citing DEC-0001#D4.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the "states arrays of TASK-NNNN IDs, [] when empty, and sole authoritative machine-read" assertion passes for both copies.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: The paragraph states edge symmetry is flagged by tooling and never auto-corrected
- **Scenario**: Per Step 1(b): if A lists B in `blocks`, B must list A in `depends_on`; tooling flags asymmetry and never auto-corrects.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the symmetry assertion passes for both copies.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: The paragraph demotes body typed-link lines to an optional mirror and declares the legacy formats out of schema, in 4-6 lines
- **Scenario**: Per Step 1(c)/(d) and the 4-6 line limit: the body `depends_on::[[TASK-NNNN]]` / `blocks::[[TASK-NNNN]]` lines are an optional graph-view mirror never read by tooling; the legacy `> **Depends on**:` blockquote and `## Dependencies` body headings are not part of the schema.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the mirror, legacy-format, and line-count assertions pass for both copies.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: The two lifecycle.md copies stay in sync on the paragraph
- **Scenario**: The local dogfood copy must receive the identical edit as the canonical template (same pattern as TASK-0090's `conventions.md`); a drifted paragraph would mean the always-refreshed copy overwrites project state incorrectly on the next sync.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the "identical paragraph" assertion passes.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: task-add defers to lifecycle.md for populating the arrays and drops the blockquote aside
- **Scenario**: In `lib/skills/task-add/SKILL.md`, Step 8's "Populate ..." sentence now points at `wiki/work/tasks/lifecycle.md` ("Dependency fields") instead of restating "lists of `TASK-NNNN` IDs (empty list if none)"; the "Dependency links" paragraph no longer mentions the blockquote, keeps the insertion-position instruction, and calls the lines an "optional graph-view mirror of the frontmatter arrays".
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; both task-add assertions pass.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: task-add keeps the Step 5 relation definitions and the frontmatter skeleton
- **Scenario**: Out-of-scope content must survive: the Step 5 `depends_on` / `blocks` / `parallel_safe_with` one-liners (used for the user confirmation table) and the Step 8 frontmatter skeleton (`depends_on: []`, `blocks: []`, `parallel_safe_with: []`, `origin_bug: ""`).
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the "keeps its Step 5 relation definitions and the frontmatter skeleton" assertion passes.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: task-update Step 3 checks frontmatter keys, with no blockquote example and no stale "step 3.5"
- **Scenario**: The "Has dependency block immediately after the title" item and its fenced blockquote are replaced by a frontmatter check pointing at lifecycle.md ("Dependency fields"); no example fence is re-embedded; the stale `/task-add` "step 3.5" reference is gone.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the "checks frontmatter dependency keys instead of a blockquote and has no stale step 3.5" assertion passes.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: task-update adds missing keys in Step 5 via the active task index with user confirmation, and leaves other checklist items alone
- **Scenario**: When a key is missing, task-update must add it during Step 5 by consulting `wiki/work/tasks/index.md` and asking the user to confirm relationships (same process as `/task-add` Step 5). The unrelated stale checklist items (`# NNN —` heading, `## Prerequisites`) must be left as-is.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the "adds missing keys during Step 5" and "leaves the other structure-checklist items alone" assertions pass.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: task-audit Step 2e reads frontmatter and keeps only its two behaviour rules
- **Scenario**: `lib/skills/task-audit/SKILL.md` Step 2e is titled "Read the Dependency Fields", reads `depends_on` / `blocks` / `parallel_safe_with` from YAML frontmatter per lifecycle.md ("Dependency fields"), treats a missing key as an empty list, and records `missing_deps` when none of the three keys is present. The blockquote example, the "may be `none`" and `[NNN-slug](NNN-slug.md)` link-pattern bullets, and the "Going forward ... typed links" paragraph are gone; `missing_block` appears nowhere in the file.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the two Step 2e assertions in the content suite and the Step 2e assertion in the single-source suite pass.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js` and `test/task-dependency-single-source.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js test/task-dependency-single-source.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-011: task-audit downstream references use `TASK-NNNN` IDs, `missing_deps`, and "Missing dependency fields"
- **Scenario**: Step 2f's node record uses `TASK-NNNN` for `id` / `depends_on` / `blocks` / `parallel_safe` and `missing_deps` (renamed from `missing_block`); 2d item 3 says "in their `depends_on` / `blocks` frontmatter"; Step 4e's category and example row read "Missing dependency fields" (no "Missing dependency block" / "Fix missing dependency blocks" remains) and the stale-reference example uses a `TASK-NNNN` value. Step 3 graph logic is still present and unedited in shape.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the 2f, 2d, 4e, and Step 3-still-exists assertions pass.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-012: The three skills carry no blockquote format and each points at lifecycle.md "Dependency fields"
- **Scenario**: None of `task-add`, `task-update`, `task-audit` `SKILL.md` contains `**Depends on**` or `**Parallel-safe with**`, and each references `tasks/lifecycle.md` alongside "Dependency fields" (single source of truth).
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; all per-skill assertions (2 x 3 skills) pass.
- **Repeatable Unit Test**: Created: `test/task-dependency-single-source.test.js`
- **Unit Test Command**: `node --test test/task-dependency-single-source.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-013: No residual blockquote-format text anywhere under lib/skills/
- **Scenario**: TASK-0102 Step 6: a sweep for `Depends on**`, `Parallel-safe with`, `missing_block`, and `dependency block` across every markdown file under `lib/skills/` finds zero hits, including skills other than the three edited ones.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; the "no residual blockquote-dependency-format text anywhere under lib/skills/" assertion passes with an empty offender list.
- **Repeatable Unit Test**: Created: `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="no residual" test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-014: The rewritten task-typed-links assertions describe the frontmatter-authoritative wording
- **Scenario**: TASK-0102's edits removed wording that four assertions in `test/task-typed-links.test.js` used to pin; those were rewritten (task-add mirror wording; task-audit Step 2e no longer documents typed-link lines, reads frontmatter, and defers to lifecycle.md). The rewritten assertions must pass against the current skill text. (One sibling test in the same file, "prose documents the dependency-link placement rule sourced from Step 5", fails on a pre-existing 3-digit `TASK-NNN` placeholder mismatch unrelated to this task, so this case filters to the TASK-0102-relevant tests by name.)
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit 0; 5 tests pass (3 Step 2e tests, the body-template order test, the optional-frontmatter-mirror test), 0 fail.
- **Repeatable Unit Test**: Created: `test/task-typed-links.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="Step 2e|optional frontmatter mirror|body template renders" test/task-typed-links.test.js`
- [x] Pass <!-- 2026-09-19 -->
