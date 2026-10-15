---
id: UAT-0089
aliases: [UAT-0089]
title: "UAT: decision-create and roadmap-create gain an optional prior-art scan step"
status: pending
task: TASK-0089
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0089 — UAT: decision-create and roadmap-create gain an optional prior-art scan step

implements::[[TASK-0089]]

> **Source task**: [[TASK-0089]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0089's changes to `lib/skills/adr-create/SKILL.md` and `lib/skills/roadmap-create/SKILL.md`.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).
- [ ] At least one existing page under `wiki/knowledge/concepts/` (e.g. `wiki-work-family-cross-linking-gaps.md`) to use as a real hit during the manual walkthroughs, and a topic with no plausible match in `wiki/knowledge/` to use for the negative (silent-skip) path.
- [ ] Skills installed from this repo's `lib/skills/` copies (run `./lib/scripts/install-global.sh --skip-mcps`) before the manual walkthroughs; the `~/.claude/skills/` copies are machine-local and overwritten on each sync.

---

## Test Cases

### UAT-EDGE-001: decision-create Step 1 scan reads the index sections and searches both knowledge directories via Serena
- **Scenario**: `lib/skills/adr-create/SKILL.md` "Step 1: Parse topic, recall context" gains a prior-art scan item that reads `wiki/index.md`'s `### Concepts` and `### Sources` sections and runs `mcp__serena__search_for_pattern` for the topic's key terms across `wiki/knowledge/concepts/` and `wiki/knowledge/sources/`.
- **Steps**: Read `lib/skills/adr-create/SKILL.md` Step 1 (before "Step 1.5"); confirm the prior-art scan item names `wiki/index.md`, both `### Concepts` and `### Sources`, `mcp__serena__search_for_pattern`, and both `wiki/knowledge/concepts/` and `wiki/knowledge/sources/`.
- **Expected Result**: Every element is present in the scan item, alongside the pre-existing `list_memories` recall and `wiki/work/decisions/lifecycle.md` read.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: decision-create scan is optional, cheap, and skips silently
- **Scenario**: The decision-create scan must be a scan-and-surface step, not a `/research` replacement, and must add no ceremony when the search returns nothing plausible — no error, no "no prior art found" message.
- **Steps**: Read the scan item in `lib/skills/adr-create/SKILL.md` Step 1; confirm it is marked optional and cheap, says "skip silently if nothing plausible turns up", states it is not a `/research` substitute, and contains no instruction to print a "no prior art found" message. Confirm the top-of-file mandatory `/research <topic>` directive is unchanged.
- **Expected Result**: All four statements are present; no "no prior art found" instruction exists; the `/research` directive is preserved.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: decision-create never cites a hit unconfirmed — Step 4 asks the user, and skips the question when nothing was found
- **Scenario**: A candidate page surfaced by the scan is confirmed with the user during Step 4's `AskUserQuestion` clarification round (e.g. "Found `wiki/knowledge/concepts/<slug>.md` — relevant?"), matching the skill's "never invent options" discipline. When the scan found nothing plausible, the question is skipped entirely.
- **Steps**: Read `lib/skills/adr-create/SKILL.md` Step 1's scan item and Step 4 (before "Step 4.5"); confirm Step 1 says hits are "confirmed with the user in Step 4, never cited unconfirmed"; confirm Step 4 contains a **Prior art** question in the "Found `wiki/knowledge/concepts/<slug>.md` — relevant?" form and the "Skip this question entirely when the scan found nothing plausible" rule.
- **Expected Result**: Both the confirm-before-cite rule and the skip-when-empty rule are present.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: decision-create writes derived_from::[[<slug>]] into Shared Context or the block Context on confirmation
- **Scenario**: When the user confirms a surfaced page, Step 4 instructs adding a `derived_from::[[<slug>]]` typed link to the decision's Shared Context or the specific block's `### Context (decision-specific)` section.
- **Steps**: Read `lib/skills/adr-create/SKILL.md` Step 4's **Prior art** question; confirm it says the link is added "on confirmation", uses the `derived_from::[[<slug>]]` form, and names both `Shared Context` and `### Context (decision-specific)` as valid placements.
- **Expected Result**: All four elements are present.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: roadmap-create Step 1 scan reads the index sections and searches both knowledge directories via Serena
- **Scenario**: `lib/skills/roadmap-create/SKILL.md` "Step 1: Parse the topic and recall project context" gains the identical scan pattern alongside its existing `mcp__serena__list_memories` call.
- **Steps**: Read `lib/skills/roadmap-create/SKILL.md` Step 1 (before "Step 2"); confirm the prior-art scan item names `wiki/index.md`, `### Concepts`, `### Sources`, `mcp__serena__search_for_pattern`, `wiki/knowledge/concepts/`, and `wiki/knowledge/sources/`; confirm the existing `mcp__serena__list_memories` and `wiki/work/roadmaps/lifecycle.md` reads and the top-of-file mandatory `/research <topic>` directive are unchanged.
- **Expected Result**: Every element of the scan is present and the pre-existing Step 1 content is preserved.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: roadmap-create scan is optional, cheap, and skips silently
- **Scenario**: The roadmap-create scan must state the same optional/cheap/silent-skip contract as decision-create — no error and no "no prior art found" clutter when nothing plausible turns up, and it is not a `/research` replacement.
- **Steps**: Read the scan item in `lib/skills/roadmap-create/SKILL.md` Step 1; confirm it is marked optional and cheap, says "skip silently if nothing plausible turns up", states it is not a `/research` substitute, and contains no instruction to print a "no prior art found" message.
- **Expected Result**: All statements are present; no "no prior art found" instruction exists.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: roadmap-create confirms hits in Step 3's Q&A batch and drops rejected candidates silently
- **Scenario**: Candidate pages are never cited unconfirmed: Step 3 folds a confirmation question into the existing first `AskUserQuestion` batch (or a short follow-up if the batch is full), and unconfirmed or rejected candidates are dropped silently.
- **Steps**: Read `lib/skills/roadmap-create/SKILL.md` Step 1's scan item and Step 3 (before "Step 4"); confirm Step 1 says hits are "confirmed with the user during Step 3's Q&A, never cited unconfirmed" and names the `derived_from:` frontmatter field; confirm Step 3 has a confirmation question for candidate concept/source pages, says "unconfirmed or rejected candidates are dropped silently", and says "never cited without confirmation".
- **Expected Result**: All statements are present.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: roadmap-create Step 6 populates derived_from from confirmed hits and omits it otherwise
- **Scenario**: A confirmed hit populates the roadmap's `derived_from:` frontmatter field (the established pattern in `ROADMAP-0013`) instead of leaving it empty by default; with no confirmed hit the field is omitted entirely and never invented.
- **Steps**: Read `lib/skills/roadmap-create/SKILL.md` Step 6's field table (before "Step 7"); confirm the `derived_from` row scopes values to `wiki/knowledge/{concepts,sources}` slugs, says "omit the field entirely if none were confirmed", and says "never invent entries". Confirm `wiki/work/roadmaps/ROADMAP-0013-wiki-cross-family-synergy-fixes.md` carries a `derived_from: [...]` frontmatter array as the cited precedent.
- **Expected Result**: The row contains all three statements and the ROADMAP-0013 precedent exists.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: the wiki paths both scans depend on exist
- **Scenario**: Both scans point at `wiki/index.md`'s `### Concepts` and `### Sources` headings and at the `wiki/knowledge/concepts/` and `wiki/knowledge/sources/` directories; if any of these were missing or renamed the scan would silently find nothing.
- **Steps**: Confirm `wiki/index.md` has a `### Concepts` heading and a `### Sources` heading; confirm both `wiki/knowledge/` subdirectories exist.
- **Expected Result**: Both headings and both directories exist.
- **Repeatable Unit Test**: Created: `test/prior-art-scan.test.js`
- **Unit Test Command**: `node --test test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-MANUAL-001: end-to-end /decision-create — a relevant page is surfaced, confirmed, and cited; an irrelevant topic runs with no ceremony
- **Scenario**: Run `/adr-create` on a topic that a real `wiki/knowledge/concepts/` page covers, confirm the scan surfaces it during Step 4 and a confirmed hit is cited as `derived_from::[[<slug>]]`; then run it on a topic with no plausible prior art and confirm the scan adds no visible step, question, or message.
- **Steps**:
  1. Run `/adr-create` with a topic overlapping an existing concept page (e.g. "how wiki knowledge and work families should cross-link", matching `wiki-work-family-cross-linking-gaps`). Proceed through research to Step 4.
  2. In Step 4's `AskUserQuestion` round, confirm a **Prior art** question appears naming the candidate page in the form "Found `wiki/knowledge/concepts/<slug>.md` — relevant?". Answer yes.
  3. After the file is written, confirm the decision's Shared Context (or the block's `### Context (decision-specific)`) contains `derived_from::[[<slug>]]`.
  4. Repeat with a topic that has no plausible match in `wiki/knowledge/`. Confirm no Prior art question is asked and no "no prior art found" message is printed.
  5. Clean up: trash or delete the throwaway decision file(s) and their index/log rows so they do not pollute `wiki/work/decisions/index.md` (operator's call whether to keep a real record).
- **Expected Result**: Live behavior matches every static claim verified in UAT-EDGE-001 through 004: the hit is surfaced and confirmed, never silently cited, cited in the right place on confirmation, and absent from the flow when nothing plausible exists.
- **Repeatable Unit Test**: Not applicable: requires a live `/adr-create` run with `/research`, `AskUserQuestion` interaction, and real file creation — cannot run inside a deterministic unit-test harness without mocking the whole skill-invocation loop.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-MANUAL-002: end-to-end /roadmap-create — a relevant page is surfaced, confirmed, and lands in derived_from; an irrelevant topic runs with no ceremony
- **Scenario**: Run `/roadmap-create` on a topic that a real `wiki/knowledge/` page covers, confirm the scan surfaces it in Step 3's Q&A batch and a confirmed hit populates `derived_from:`; then run it on a topic with no plausible prior art and confirm no derived_from field, question, or message appears.
- **Steps**:
  1. Run `/roadmap-create` with a topic overlapping an existing concept or source page. Proceed through research to Step 3.
  2. In Step 3's first `AskUserQuestion` batch (or a short follow-up), confirm a confirmation question names the candidate page(s). Answer yes.
  3. After the file is written, confirm the new roadmap's frontmatter contains `derived_from: [<slug>]`.
  4. Repeat, rejecting the candidate. Confirm the resulting roadmap frontmatter has no `derived_from` field and no citation of the rejected page.
  5. Repeat with a topic that has no plausible match. Confirm no confirmation question is asked, no "no prior art found" message is printed, and `derived_from` is omitted.
  6. Clean up: remove the throwaway roadmap file(s) and their index/log rows so they do not pollute `wiki/work/roadmaps/index.md`.
- **Expected Result**: Live behavior matches every static claim verified in UAT-EDGE-005 through 008: confirmed hits populate `derived_from:`, rejected or absent hits leave the field omitted, and an empty scan adds no visible ceremony.
- **Repeatable Unit Test**: Not applicable: requires a live `/roadmap-create` run with `/research`, `AskUserQuestion` interaction, and real file creation — cannot run inside a deterministic unit-test harness without mocking the whole skill-invocation loop.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

---

## Notes

- This task touched `lib/skills/adr-create/SKILL.md` and `lib/skills/roadmap-create/SKILL.md` — markdown skill-instructions interpreted by an LLM at runtime, not executable code. UAT-EDGE-001 through 009 are static text/structure assertions against those files and the wiki paths they reference (the only deterministic thing there is to check); UAT-MANUAL-001 and 002 are the cases that exercise the documented behavior end-to-end and are not unit-test promotable.
- `uatGenerate.promoteTests` resolved to `true` → legacy mapping → `dedicated`. This repo's existing `test/` directory and `node --test` convention were followed (matches `test/knowledge-link-flag.test.js`, the closest precedent for a multi-file SKILL.md-content contract test).
- One repeatable unit test file backs all 9 EDGE cases: `test/prior-art-scan.test.js` (15 `node:test` cases). Verified passing: `node --test test/prior-art-scan.test.js` → 15/15 pass, 0 fail.
- No gaps: every checkbox across TASK-0089's 3 steps is covered by a static assertion (EDGE-001..009) or flagged as requiring live verification (MANUAL-001, MANUAL-002). Step 3's "keep it optional and cheap" is covered by EDGE-002 and EDGE-006 for each file.
