---
id: UAT-0092
aliases: [UAT-0092]
title: "UAT: New wiki-lint check: validate typed-link targets actually resolve"
status: pending
task: TASK-0092
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0092 — UAT: New wiki-lint check: validate typed-link targets actually resolve

implements::[[TASK-0092]]

> **Source task**: [[TASK-0092]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0092's new "### 2.11 Typed-link target resolution (MEDIUM)" section in `lib/skills/wiki-lint/SKILL.md`.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).
- [ ] For the manual cases: a clean or committed working tree so the throwaway typed links planted for UAT-MANUAL-001/002 can be reverted with a single `Edit`, and the Serena MCP server connected (2.11 resolves targets via `mcp__serena__find_file` / `mcp__serena__search_for_pattern`).

---

## Test Cases

### UAT-EDGE-001: 2.11 sits immediately after 2.10 and before Step 3
- **Scenario**: `lib/skills/wiki-lint/SKILL.md` contains the heading `### 2.11 Typed-link target resolution (MEDIUM)` directly after `### 2.10 Provenance / confidence (LOW)`, with no other `2.N` check between them and the section ending before `## Step 3: Report findings`. (A later sibling such as `### 2.12` placed after 2.11 is fine — the task's orchestration note anticipates it.)
- **Steps**: Read `lib/skills/wiki-lint/SKILL.md`; confirm the 2.10 and 2.11 headings are adjacent in that order and that Step 3 follows the 2.N block.
- **Expected Result**: Heading text, ordering, and `(MEDIUM)` severity match exactly.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: 2.11 reuses 2.5's `::[[` scan instead of defining a second scanner
- **Scenario**: Per the task's Approach, 2.11 must extend 2.5's discovery step (every `keyword::[[target]]` occurrence across `wiki/`, via `mcp__serena__search_for_pattern`) rather than describe an independent scanner, and must state that it validates the *target* while 2.5 validates the *keyword*.
- **Steps**: Read the 2.11 section; confirm the "Reuse the `::[[` scan from 2.5" statement, the `mcp__serena__search_for_pattern` reference over `wiki/`, and the target-vs-keyword distinction.
- **Expected Result**: All three elements present; no separate regex/scan procedure is defined in 2.11.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Decision targets resolve against decisions/ and archive/, with `#DM` block existence
- **Scenario**: A `DEC-NNNN` or `DEC-NNNN#DM` target must be checked for file existence in `wiki/work/decisions/` **or** `wiki/work/decisions/archive/` via `mcp__serena__find_file`; when a `#DM` anchor is present, the decision block itself (an H2 `## DM.` carrying a `- **Status**:` line) must be confirmed to exist. This matters concretely because decisions are moved to `archive/` on finalization/supersession (e.g. DEC-0001 now lives in `archive/`), so an active-dir-only check would produce false dangling reports.
- **Steps**: Read the 2.11 "Resolution logic" decision bullet; confirm both directories, `mcp__serena__find_file`, and the `#DM` block-existence rule (H2 + Status line) are documented.
- **Expected Result**: Both directories and the anchor rule are present.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Work-family targets (TASK/BUG/UAT/REQ/ROADMAP) resolve against the family dir or its archive/
- **Scenario**: Each of `TASK-NNNN`, `BUG-NNNN`, `UAT-NNNN`, `REQ-NNNN`, `ROADMAP-NNNN` must be resolved to a file in `wiki/work/<family>/` or `wiki/work/<family>/archive/` via `mcp__serena__find_file`.
- **Steps**: Read the 2.11 "Work-family targets" bullet; confirm all five ID forms, both directory forms, and `mcp__serena__find_file` are named.
- **Expected Result**: All five ID types and both location forms are present.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: Bare slugs resolve to a knowledge page by `id:`, `aliases:`, or filename
- **Scenario**: A bare-slug target (e.g. `[[typed-wiki-links]]`) must be confirmed to exist under `wiki/knowledge/` by matching `id:` frontmatter, an `aliases:` entry, or the filename.
- **Steps**: Read the 2.11 "Knowledge page targets" bullet; confirm the three matching routes, the `wiki/knowledge/` scope, and the `[[typed-wiki-links]]` example.
- **Expected Result**: All present.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: Unresolved targets are reported as `[MEDIUM] dangling typed link` with file:line and the full link
- **Scenario**: The report line for an unresolved target must read exactly `[MEDIUM] dangling typed link — <file>:<line> — <keyword>::[[<target>]] does not resolve to any existing page or work item`.
- **Steps**: Read the 2.11 "Reporting" bullets; compare the dangling-link template character for character.
- **Expected Result**: Template matches the task's specified wording and severity.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: Links to a superseded decision block are reported separately as informational `[LOW]`
- **Scenario**: When a target resolves to a decision block whose status is `superseded by DEC-N#DX`, it must be reported as `[LOW] typed link to superseded decision — <file>:<line> — consider updating to DEC-N#DX`, explicitly framed as informational (not broken; the link still resolves) and never as a dangling link.
- **Steps**: Read the 2.11 "Reporting" bullets; confirm the exact `[LOW]` template, the `superseded by DEC-N#DX` trigger text, and the "informational, not broken / still resolves" framing.
- **Expected Result**: All present; the superseded case is a distinct finding type from the dangling case.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: 2.11's output shape matches every other check, and Steps 3/4/5 need no structural change
- **Scenario**: 2.11's two report templates follow the shared `[SEVERITY] <finding-type> — <detail>` shape, so Step 3's HIGH/MEDIUM/LOW grouping and per-severity counts pick them up unchanged. Step 4 ("For each HIGH finding, propose the exact `Edit`…", approval-gated) and Step 5 remain intact — MEDIUM/LOW findings from 2.11 are reported only, consistent with the task's "no structural change needed there" requirement.
- **Steps**: Read `## Step 3: Report findings`, `## Step 4: Propose fixes`, `## Step 5: Apply approved fixes only`; confirm they are unchanged in structure; confirm the two 2.11 templates begin `[MEDIUM]`/`[LOW]` followed by a finding type, an em dash, and detail.
- **Expected Result**: Step 3 groups by all three severities and summarizes counts; Step 4 still iterates HIGH findings and forbids unapproved edits; 2.11's templates fit the shape.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: 2.5 is preserved and the repo copy (not `~/.claude/skills/`) is the edit target
- **Scenario**: Adding 2.11 must not remove or alter 2.5's keyword-vocabulary check (`::[[` scan, `wiki/conventions.md` vocabulary, "Report unknown keywords."), and 2.11 must not direct edits at the machine-local `~/.claude/skills/wiki-lint/SKILL.md`.
- **Steps**: Read the 2.5 section and the 2.11 section of `lib/skills/wiki-lint/SKILL.md`; confirm 2.5 is intact and 2.11 has no `~/.claude/skills/` reference.
- **Expected Result**: 2.5 unchanged; no machine-local path in 2.11.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js`
- **Unit Test Command**: `node --test test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-MANUAL-001: live `/wiki-lint` run surfaces a planted dangling typed link as `[MEDIUM] dangling typed link`, and does not flag valid ones
- **Scenario**: Run the updated `/wiki-lint` against the real wiki and confirm 2.11 behaves as documented at runtime: a deliberately broken typed link is reported with correct file, line number, keyword, and target, while valid links (including ones pointing at archived items) are not reported.
- **Steps**:
  1. Pick a knowledge page you can safely edit and revert, and add a throwaway line `relates_to::[[TASK-9999-does-not-exist]]` plus a second `relates_to::[[uat-0092-no-such-slug]]`. Note the file path and line numbers.
  2. Run `/wiki-lint` (do not approve any fixes when prompted in Step 4).
  3. In the report, find the two new findings under the MEDIUM group. Confirm each reads `[MEDIUM] dangling typed link — <file>:<line> — relates_to::[[<target>]] does not resolve to any existing page or work item` with the correct file, line, and target.
  4. Confirm no `dangling typed link` finding appears for a known-good link that targets an **archived** item (e.g. any `[[TASK-…]]`/`[[DEC-…]]` whose file lives under an `archive/` directory).
  5. Confirm the summary line's MEDIUM count includes the two planted findings.
  6. Revert: remove the two throwaway lines with `Edit` and confirm `git status` shows the scratch page unchanged.
- **Expected Result**: Both planted links are reported as MEDIUM dangling links with exact file:line; archived-item links are not flagged; counts include the new findings; nothing was auto-fixed.
- **Repeatable Unit Test**: Not applicable: requires an LLM agent to execute the SKILL.md against the live wiki tree via Serena MCP tools and edit real files; the skill is instructions interpreted at runtime, so its execution cannot be run inside a deterministic unit-test harness.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-MANUAL-002: live `/wiki-lint` run distinguishes a superseded-decision link (`[LOW]`) from a dangling one, and validates `#DM` anchors
- **Scenario**: Confirm at runtime that a `#DM` anchor pointing at a block that does not exist is reported as dangling, while a link to a real block marked `superseded by DEC-N#DX` is reported only as the informational `[LOW]` finding.
- **Steps**:
  1. Add a throwaway line `relates_to::[[DEC-0001#D99]]` (existing decision file, nonexistent block) to a scratch page. Add a second throwaway line targeting a decision block whose `- **Status**:` is `superseded by DEC-N#DX` if one exists in `wiki/work/decisions/` or `archive/`; if none exists, skip this half and record that in the result.
  2. Run `/wiki-lint` and decline all fixes.
  3. Confirm `DEC-0001#D99` is reported as `[MEDIUM] dangling typed link` (file resolves via `archive/`, but the block does not exist).
  4. If the superseded target was planted, confirm it is reported as `[LOW] typed link to superseded decision — <file>:<line> — consider updating to DEC-N#DX` and **not** as a dangling link.
  5. Revert the throwaway lines.
- **Expected Result**: Nonexistent `#DM` anchor → MEDIUM dangling; superseded-but-existing block → LOW informational only; DEC-0001 (archived) itself is found.
- **Repeatable Unit Test**: Not applicable: requires an LLM agent to execute the SKILL.md against live decision files and edit real pages; runtime interpretation of skill instructions, not deterministic code.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

---

## Notes

- TASK-0092 changed one file, `lib/skills/wiki-lint/SKILL.md` — a markdown skill interpreted by an LLM at runtime, not executable code. UAT-EDGE-001 through 009 are static structural/text assertions against that file (the only deterministic surface); UAT-MANUAL-001/002 exercise the documented resolution behavior live and are not unit-test promotable.
- `uatGenerate.promoteTests` resolved to `true` → legacy mapping → `dedicated`. The repo's existing `test/` directory and `node --test` convention were followed (closest precedent: `test/knowledge-link-flag.test.js`).
- One repeatable unit test file backs all 9 EDGE cases: `test/wiki-lint-typed-link-resolution.test.js` (14 `node:test` cases). Verified: `node --test test/wiki-lint-typed-link-resolution.test.js` → 14/14 pass, 0 fail. Section boundaries are located by heading text, so TASK-0093's `### 2.12` landing after 2.11 does not break the suite.
- Observed at generation time: 2.11 is already present, `### 2.12 Task-less accepted decisions` (TASK-0093) follows it, and Step 3/4/5 are structurally unchanged — no gap between the acceptance criteria and the implementation.
- Gap note: the task's Step 1 fourth bullet (superseded → `[LOW]`) is only checkable statically here plus MANUAL-002; whether any real decision block currently carries `superseded by DEC-N#DX` is not guaranteed, hence MANUAL-002's conditional second half.
- Concurrency note: `lib/skills/wiki-lint/SKILL.md` was being edited by another agent during generation; this UAT was written against the file as of 2026-09-19 and its unit test will re-verify on each run.
