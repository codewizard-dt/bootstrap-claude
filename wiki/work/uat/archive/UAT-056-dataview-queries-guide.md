---
id: UAT-056
title: "UAT: Add optional wiki/guides/ Dataview example-queries page"
status: passed
task: TASK-056
created: 2026-08-13
updated: 2026-08-14
---

# UAT-056 — UAT: Add optional wiki/guides/ Dataview example-queries page

implements::[[TASK-056]]

> **Source task**: [[TASK-056]]
> **Generated**: 2026-08-13

---

## Prerequisites

- [ ] Working tree includes `raw/guides/dataview-queries.md` and `wiki/guides/dataview-queries.md`
- [ ] No Obsidian install or Dataview plugin required — every test here is static-content verification of committed markdown, not a rendered-query check

---

## Test Cases

### UAT-STATIC-001: Both guide copies exist
- **Scenario**: TASK-056's Approach requires a master copy at `raw/guides/dataview-queries.md` and a byte-identical dogfooded copy at `wiki/guides/dataview-queries.md`, following the same copy-once pattern as `command-anti-patterns.md` and `evals-framework.md`.
- **Steps**:
  1. Confirm `raw/guides/dataview-queries.md` exists.
  2. Confirm `wiki/guides/dataview-queries.md` exists.
- **Expected Result**: Both files exist on disk.
- **Repeatable Unit Test**: Created: `test/dataview-queries-guide.test.js`
- **Unit Test Command**: `node --test test/dataview-queries-guide.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-002: raw and wiki copies are byte-identical
- **Scenario**: The task's copy-once convention requires the two files to match exactly, not just contain similar content.
- **Steps**:
  1. Read `raw/guides/dataview-queries.md`.
  2. Read `wiki/guides/dataview-queries.md`.
  3. Compare byte-for-byte (verified via SHA-1 during research: both files hash to `0fc5a7e20f4dec33d61982e131ba9543f49707a3`).
- **Expected Result**: The two files are byte-identical.
- **Repeatable Unit Test**: Created: `test/dataview-queries-guide.test.js`
- **Unit Test Command**: `node --test test/dataview-queries-guide.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-003: Contains the tasks-by-status TABLE query
- **Scenario**: The task's Approach requires example query #1 — a `TABLE` query listing pages under `wiki/work/tasks/` by `status`.
- **Steps**:
  1. Open `raw/guides/dataview-queries.md`, section "2.1 Tasks by status".
  2. Confirm the fenced ` ```dataview ` block reads `TABLE status` / `FROM "wiki/work/tasks"` / `SORT status`.
- **Expected Result**: The exact query block is present, targeting `wiki/work/tasks` and the `status` field.
- **Repeatable Unit Test**: Created: `test/dataview-queries-guide.test.js`
- **Unit Test Command**: `node --test test/dataview-queries-guide.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-004: Contains the contradicts:: LIST query
- **Scenario**: The task's Approach requires example query #2 — a `LIST` query surfacing every page containing a `contradicts::` typed link, positioned as a companion to `/wiki-lint`.
- **Steps**:
  1. Open `raw/guides/dataview-queries.md`, section "2.2 Pages with a `contradicts::` link".
  2. Confirm the fenced ` ```dataview ` block reads `LIST` / `FROM "wiki"` / `WHERE contains(file.text, "contradicts::")`.
- **Expected Result**: The exact query block is present, scanning `wiki` for the literal `contradicts::` text.
- **Repeatable Unit Test**: Created: `test/dataview-queries-guide.test.js`
- **Unit Test Command**: `node --test test/dataview-queries-guide.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-005: Contains the tools-by-tag TABLE query
- **Scenario**: The task's Approach requires example query #3 — a `TABLE` query over `wiki/knowledge/entities/tools/` grouped/filtered by `tags`.
- **Steps**:
  1. Open `raw/guides/dataview-queries.md`, section "2.3 Tools by tag".
  2. Confirm the fenced ` ```dataview ` block reads `TABLE tags` / `FROM "wiki/knowledge/entities/tools"` / `SORT file.name`.
- **Expected Result**: The exact query block is present, targeting `wiki/knowledge/entities/tools` and the `tags` field.
- **Repeatable Unit Test**: Created: `test/dataview-queries-guide.test.js`
- **Unit Test Command**: `node --test test/dataview-queries-guide.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-006: Every example carries the "illustrative only" caveat
- **Scenario**: TASK-056's Approach requires each example to explicitly note it is illustrative/exploratory and never a replacement for the committed `index.md` files, per `wiki/conventions.md`'s Maps-of-Content convention.
- **Steps**:
  1. Count occurrences of the phrase "Illustrative only" in `raw/guides/dataview-queries.md`.
  2. Confirm the caveat text references `wiki/conventions.md` and the Maps-of-Content convention.
- **Expected Result**: Exactly 3 "Illustrative only" caveats (one immediately after each of the 3 example query blocks), and at least one reference to `wiki/conventions.md` and "Maps-of-Content convention" in the surrounding prose.
- **Repeatable Unit Test**: Created: `test/dataview-queries-guide.test.js`
- **Unit Test Command**: `node --test test/dataview-queries-guide.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-001: Guide documents Dataview as optional, not a wiki dependency
- **Scenario**: TASK-056's Approach requires the intro to explain Dataview is an opt-in local Obsidian plugin, installable via `lib/scripts/install-obsidian.sh` (once TASK-053 lands) or manually — and explicitly not a dependency of the wiki schema or `/wiki-*` commands.
- **Steps**:
  1. Read Section 1 ("What this is (and isn't)") of `raw/guides/dataview-queries.md`.
  2. Confirm it states Dataview is optional and names both install paths (`lib/scripts/install-obsidian.sh` and the manual Community Plugins route).
- **Expected Result**: The section is present and makes the optionality and both install paths explicit.
- **Repeatable Unit Test**: Not applicable — this is a prose-content judgment call (does the wording clearly convey optionality/install paths) rather than a deterministic string match; a regex match on a single phrase would be a weaker, more brittle proxy than a human/LLM read of the paragraph. Verified manually during generation research: section is present at `raw/guides/dataview-queries.md` lines 7-20 and names both install paths explicitly.
- [x] Pass <!-- 2026-08-14 -->

### UAT-EDGE-002: Task frontmatter `uat:` field is wired to this file
- **Scenario**: Step 4 of `/uat-generate` requires the source task's frontmatter `uat:` field to point at this UAT file, so `/uat-walk`, `/uat-auto`, and `/task-audit` can resolve the link.
- **Steps**:
  1. Open `wiki/work/tasks/TASK-056-dataview-queries-guide.md`.
  2. Confirm frontmatter `uat: "[[UAT-056]]"`.
- **Expected Result**: The field is set and resolves to this file.
- **Repeatable Unit Test**: Not applicable — a one-line frontmatter cross-reference in a hand/LLM-maintained wiki file, not application logic; asserting on it would just re-encode this file's own existence rather than test independently established behavior.
- [x] Pass <!-- 2026-08-14 -->

---

## Gaps

None. Every planned test case had its exact expected content verified against the source files (`raw/guides/dataview-queries.md`, `wiki/guides/dataview-queries.md`) before being written — no test was dropped for insufficient research. UAT-EDGE-001 and UAT-EDGE-002 were judged not unit-test-promotable (prose-quality judgment and a one-line frontmatter self-reference, respectively) rather than blocked; both remain in scope as manual/LLM-judged checks.
