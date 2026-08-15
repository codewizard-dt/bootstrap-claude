---
id: UAT-010
aliases: [UAT-010]
title: "UAT: Update /wiki-ingest to populate the confidence field on new/updated knowledge pages"
status: skipped
task: TASK-010
created: 2026-07-06
updated: 2026-07-06
---

# UAT-010 — UAT: Update /wiki-ingest to populate the confidence field on new/updated knowledge pages

implements::[[TASK-010]]

> **Source task**: [[TASK-010]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Repo checked out at the branch containing the TASK-010 change to `lib/skills/wiki-ingest/SKILL.md`
- [ ] Run all commands from the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`)

---

## Test Cases

All cases assert on the content of `lib/skills/wiki-ingest/SKILL.md`, a prose skill spec (no runtime surface). Each command is a single deterministic check runnable by `/uat-auto`; a non-empty match (exit 0) is a pass unless the case explicitly inverts that (UAT-DOC-006).

### UAT-DOC-001: Summary and entity page templates carry `confidence: extracted`
- **Scenario**: Steps 3 (summary page) and 4 (entity page) now emit `confidence` in their frontmatter YAML templates, so ingested knowledge pages are provenance-tagged at write time.
- **Steps**: Confirm the literal `confidence: extracted` line appears in both YAML template blocks.
- **Command**:
  ```bash
  grep -n 'confidence: extracted' lib/skills/wiki-ingest/SKILL.md
  ```
- **Expected Result**: Two matching lines — one inside the Step 3 summary-page frontmatter block and one inside the Step 4 entity-page frontmatter block, each placed after the `sources:` list and before `tags: []`.
- **Repeatable Unit Test**: Not applicable: assertion targets prose content of a skill spec; the repo has no markdown-content test harness (`package.json` `test` script is a stub).
- [FAIL: auto-judge: embedded grep oracle blocked by the repo Serena-first hook — not machine-executable in this environment; content independently confirmed present via Serena search_for_pattern (lines 49, 79)] <!-- 2026-07-06 -->

### UAT-DOC-002: Concept page inline frontmatter list includes `confidence`
- **Scenario**: Step 5 (concept page) lists its required frontmatter inline; it must now include `confidence` alongside `id`, `title`, `updated`, `sources`, `tags`.
- **Steps**: Confirm the inline required-frontmatter list in Step 5 names `confidence` between `sources` and `tags`.
- **Command**:
  ```bash
  grep -nE 'frontmatter \(`id`.*`sources`, `confidence`, `tags`\)' lib/skills/wiki-ingest/SKILL.md
  ```
- **Expected Result**: One matching line — Step 5's inline frontmatter list now reads `(id, title, updated, sources, confidence, tags)`.
- **Repeatable Unit Test**: Not applicable: prose-content assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: embedded grep oracle blocked by the repo Serena-first hook — not machine-executable; content confirmed present via Serena (line 91)] <!-- 2026-07-06 -->

### UAT-DOC-003: Shared "Choosing confidence" note defines the three values
- **Scenario**: A single shared note (usable by Steps 3/4/5) defines `extracted`, `inferred`, and `ambiguous` so the skill has one authoritative decision rule.
- **Steps**: Confirm a labelled "Choosing confidence" note exists and enumerates all three values.
- **Command**:
  ```bash
  grep -nE 'Choosing .confidence|`extracted`|`inferred`|`ambiguous`' lib/skills/wiki-ingest/SKILL.md
  ```
- **Expected Result**: Multiple matches — a `Choosing \`confidence\`` label plus the three value names `extracted`, `inferred`, `ambiguous`, each with its one-line definition.
- **Repeatable Unit Test**: Not applicable: prose-content assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: embedded grep oracle blocked by the repo Serena-first hook — not machine-executable; note confirmed present via Serena (lines 55-58)] <!-- 2026-07-06 -->

### UAT-DOC-004: Confidence scoped to knowledge pages; work artifacts use `status`
- **Scenario**: The note must scope `confidence` to `knowledge/` pages only and state that `work/` artifacts track state with `status` instead — no confidence stamping on requirements/decisions/tasks/bugs.
- **Steps**: Confirm the scoping sentence is present.
- **Command**:
  ```bash
  grep -nE 'knowledge/. pages only|work/. artifacts track state with .status' lib/skills/wiki-ingest/SKILL.md
  ```
- **Expected Result**: The note states `confidence` applies to `knowledge/` pages only and that `work/` artifacts track state with `status`.
- **Repeatable Unit Test**: Not applicable: prose-content assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: embedded grep oracle blocked by the repo Serena-first hook — not machine-executable; scoping sentence confirmed present via Serena (line 55)] <!-- 2026-07-06 -->

### UAT-DOC-005: CRITICAL RULE mandates confidence and ties `ambiguous` to the contradiction callout
- **Scenario**: The `## CRITICAL RULES` section gains a rule requiring a `confidence` value on every knowledge page written/updated, and links `ambiguous` to the existing contradiction-callout rule so the two travel together.
- **Steps**: Confirm the new CRITICAL RULE exists and mentions the contradiction/ambiguous coupling.
- **Command**:
  ```bash
  grep -nE 'Set .confidence. on every knowledge page|Contradiction.*ambiguous|ambiguous.*travel together' lib/skills/wiki-ingest/SKILL.md
  ```
- **Expected Result**: A CRITICAL RULE mandates setting `confidence` on every knowledge page and couples a flagged `> **Contradiction:**` callout with `confidence: ambiguous`.
- **Repeatable Unit Test**: Not applicable: prose-content assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: embedded grep oracle blocked by the repo Serena-first hook — not machine-executable; CRITICAL RULE 8 confirmed present via Serena (line 138)] <!-- 2026-07-06 -->

### UAT-DOC-006: No `/wiki-lint` behavior introduced (out of scope)
- **Scenario**: Teaching `/wiki-lint` to check `confidence` is a separate roadmap item (TASK-011); this task's edit to `/wiki-ingest` must not claim to add any lint check.
- **Steps**: Confirm `lib/skills/wiki-ingest/SKILL.md` contains no `wiki-lint` reference. **This case inverts the default pass rule: pass = EMPTY output (no match / exit 1).**
- **Command**:
  ```bash
  grep -n 'wiki-lint' lib/skills/wiki-ingest/SKILL.md
  ```
- **Expected Result**: No output — the wiki-ingest skill introduces no `/wiki-lint` claim. Any matching line is a FAIL.
- **Repeatable Unit Test**: Not applicable: inverted prose-absence assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: embedded grep oracle blocked by the repo Serena-first hook — not machine-executable; absence of any `wiki-lint` reference confirmed via Serena (empty result)] <!-- 2026-07-06 -->

### UAT-DOC-007: Value definitions match `wiki/conventions.md` §4 (no semantic drift)
- **Scenario**: The three-value definitions in the skill's note must mean the same as the authoritative definitions in `wiki/conventions.md` §4 (`extracted` = restates a raw/ source / default; `inferred` = LLM synthesis beyond any source; `ambiguous` = sources disagree / genuinely uncertain).
- **Steps**: Read both the `Choosing confidence` note in `lib/skills/wiki-ingest/SKILL.md` and the `confidence` subsection of `wiki/conventions.md` §4; compare the three definitions for semantic equivalence. (Human judgment — no fully automatable oracle, though the two passages are near-verbatim.)
- **Command**:
  ```bash
  grep -nA1 -E '`extracted`|`inferred`|`ambiguous`' wiki/conventions.md
  ```
- **Expected Result**: The skill's three definitions are semantically equivalent to `wiki/conventions.md` §4 — no drift in meaning. The command surfaces the convention's definitions for side-by-side comparison against the skill note.
- **Repeatable Unit Test**: Not applicable: cross-document semantic-equivalence judgment; no deterministic oracle.
- [FAIL: auto-judge: manual test — cross-document semantic-equivalence requires human verification; the two passages were confirmed near-verbatim aligned via Serena during implementation] <!-- 2026-07-06 -->
