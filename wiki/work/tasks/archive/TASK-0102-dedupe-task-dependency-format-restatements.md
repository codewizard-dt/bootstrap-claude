---
id: TASK-0102
aliases: [TASK-0102]
title: "Point task-add, task-update, and task-audit at tasks/lifecycle.md's frontmatter-array dependency schema"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: [TASK-0094, TASK-0095]
origin_bug: ""
uat: "[[UAT-0102]]"
tags: [task-schema, dependency-graph, skill-design, deduplication]
---

# TASK-0102 — Point task-add, task-update, and task-audit at tasks/lifecycle.md's frontmatter-array dependency schema

implements::[[DEC-0001#D4]]
relates_to::[[wiki-skill-boilerplate-duplication]]

## Objective

`tasks/lifecycle.md` already defines the task-dependency schema as frontmatter arrays (`depends_on`, `blocks`, `parallel_safe_with`, each a list of `TASK-NNNN` IDs), and [[DEC-0001#D4]] (accepted 2026-09-18) made that the single standard. Three skills still describe or parse a second, legacy format: `task-update` requires a `> **Depends on**:` blockquote as a structure-compliance check, `task-audit` Step 2e parses that blockquote (a format no live task file produces), and `task-add` carries an aside referencing the blockquote. Remove those restatements and make each skill defer to `tasks/lifecycle.md` for the format, so the schema lives in exactly one place. ROADMAP-0014 Phase 3, second item.

## Approach

**Source-of-truth note**: edit `lib/skills/task-add/SKILL.md`, `lib/skills/task-update/SKILL.md`, `lib/skills/task-audit/SKILL.md`, and `lib/scripts/templates/wiki/work/tasks/lifecycle.md` in this repo, never their `~/.claude/skills/` counterparts or a target project's copy — those are machine-local/synced copies. `wiki/work/tasks/lifecycle.md` is the always-refreshed local dogfood copy of the template and must receive the identical edit (same pattern as TASK-0090's `conventions.md`).

**Research findings** (codebase-grounded; the state is fully determined by in-repo files, no external sources needed):

- **The "updated schema" already exists.** Both `wiki/work/tasks/lifecycle.md` (lines 22-24) and `lib/scripts/templates/wiki/work/tasks/lifecycle.md` (lines 19-21) already list `depends_on`, `blocks`, `parallel_safe_with` as `TASK-NNNN` ID arrays. DEC-0001#D4's Option A explicitly requires **no** change to `tasks/lifecycle.md` and no backfill (every sampled real task already conforms). So this task is **not blocked** on any schema landing first; `depends_on` stays empty. The only lifecycle.md change is a small clarification (Step 1 below), because the table rows today say nothing about value shape (YAML array, `[]` when none), that frontmatter is authoritative, or that the body `depends_on::[[TASK-NNNN]]` / `blocks::[[TASK-NNNN]]` typed lines are an optional graph-view mirror — and the three skills need something concrete to point at.
- **`task-add`** does not restate the blockquote in its Step 8 template; the duplication is (a) the trailing aside in the "Dependency links" paragraph ("additive to the existing `> **Depends on**:`/`> **Blocks**:` blockquote format ...") and (b) the sentence "Populate `depends_on`, `blocks`, and `parallel_safe_with` from Step 5 as lists of `TASK-NNNN` IDs (empty list if none)" which restates the lifecycle table. The frontmatter skeleton itself stays — a skill needs a literal template to write from, and it is a creation template, not a format definition.
- **`task-update`** Step 3 "Structure Compliance" has a checklist item that hard-codes the three-line blockquote and says to add it when missing (with a stale reference to "`/task-add` step 3.5", which no longer exists — dependency identification is Step 5). This is replaced by a check that the frontmatter keys are present and valid per `lifecycle.md`.
- **`task-audit`** Step 2e ("Parse the Dependency Block") reads a pre-`TASK-` slug-style blockquote and 2f's node record, the Step 4 issue categories (`Missing dependency block`, `missing_block`), the Step 4 example table, and the "Fix missing dependency blocks" remediation line all key on it. Because 2e is a divergent *parser*, not just a prose restatement, removing its blockquote description without replacing it would leave the skill unable to read dependencies at all. So this task rewrites 2e to read frontmatter arrays — which is the D4 Follow-up for `task-audit` (DEC-0001#D4 Consequences → Follow-up; D4's `Source task(s)` was "none yet") — and adapts the downstream references. Node IDs become `TASK-NNNN` (matching what the frontmatter holds and what `tasks/index.md` lists).
- **Explicitly out of scope**: D4's other Follow-up half — `lib/skills/roadmap-next/SKILL.md` "Parse a roadmap" (scans `## Dependencies` / `## Blocked by` body headings; `roadmap-assess` Step 5 also reads those plus `depends_on::` lines) — is not named by this roadmap item and is a separate change. Flag it to the lead as a candidate follow-up task rather than folding it in here.
- **Interaction with Phase 4**: ROADMAP-0014 Phase 4 removes `task-update` entirely and renames `task-add` → `task-create` and `task-audit` → `task-assess`. This task lands first (Phase 3 precedes Phase 4) and the edits are small and independent of the renames, so it is still worth doing; if `task-update` has already been deleted when this is tackled, skip Step 3 and note it.

**Concurrency note**: `lib/skills/task-add/SKILL.md` was also edited by TASK-0088 and TASK-0091 (both already implemented, pending UAT), and ROADMAP-0014 Phase 2 boilerplate-extraction items may touch `task-add`, `task-update`, and `task-audit` (prereqs line, hygiene rule, number-allocation). This task touches only the dependency-format sentences and Step 2e-related text, so a merge is trivial, but do not `/tackle` it in the same parallel batch as a Phase 2 task that edits the same file — read-then-write on one file risks a lost edit. This is an orchestration note, not a logical dependency, so `depends_on`/`blocks` stay empty.

## Steps

### 1. Clarify the frontmatter-array schema in both lifecycle.md copies <!-- agent: general-purpose -->

- [x] `Read` `lib/scripts/templates/wiki/work/tasks/lifecycle.md` (canonical) and `wiki/work/tasks/lifecycle.md` (local dogfood copy) in full first; note the two copies differ slightly (the local copy carries the 4-digit-ID paragraph) — apply the same edit to each, do not overwrite one with the other.
- [x] Immediately after the "Frontmatter schema" table in each copy, add a short "Dependency fields" paragraph stating: (a) `depends_on`, `blocks`, `parallel_safe_with` are YAML arrays of `TASK-NNNN` IDs, `[]` when empty, and are the **sole authoritative, machine-read** encoding of task dependencies (per DEC-0001#D4); (b) edges should be symmetric — if A lists B in `blocks`, B lists A in `depends_on` (tooling flags asymmetry, never auto-corrects); (c) a body `depends_on::[[TASK-NNNN]]` / `blocks::[[TASK-NNNN]]` typed-link line under the H1 is an optional mirror for graph views (Obsidian/Breadcrumbs) and is never read by tooling; (d) the legacy `> **Depends on**:` blockquote and `## Dependencies` body headings are not part of the schema.
- [x] Keep the paragraph to 4-6 lines and bump `updated:` in the frontmatter of the local copy. Do not change the table rows or the status transitions.

### 2. Strip the restatements from task-add <!-- agent: general-purpose -->

- [x] In `lib/skills/task-add/SKILL.md` Step 8, replace the sentence "Populate `depends_on`, `blocks`, and `parallel_safe_with` from Step 5 as lists of `TASK-NNNN` IDs (empty list if none)." with: "Populate `depends_on`, `blocks`, and `parallel_safe_with` from Step 5 per the schema in `wiki/work/tasks/lifecycle.md` (\"Dependency fields\")."
- [x] In the "**Dependency links**" paragraph, delete the trailing italic aside about being "additive to the existing `> **Depends on**:`/`> **Blocks**:` blockquote format" (the blockquote is not part of the schema). Keep the instruction to insert the typed-link mirror lines and their position; replace the aside with a pointer to the same lifecycle.md section ("optional graph-view mirror of the frontmatter arrays").
- [x] Leave the Step 5 relation definitions (`depends_on` / `blocks` / `parallel_safe_with` one-liners used for the user confirmation table), the frontmatter skeleton, and all `origin_bug` / `--knowledge` handling untouched.

### 3. Replace the blockquote check in task-update <!-- agent: general-purpose -->

- [x] In `lib/skills/task-update/SKILL.md` Step 3 "Structure Compliance", replace the "Has dependency block immediately after the title ..." checklist item and its fenced three-line blockquote with: "- [ ] Frontmatter has `depends_on`, `blocks`, and `parallel_safe_with` per `wiki/work/tasks/lifecycle.md` (\"Dependency fields\") — arrays of `TASK-NNNN` IDs, `[]` when empty". Replace the "If the block is missing entirely, add it during Step 5 ... `/task-add` step 3.5" sentence with: if any key is missing, add it during Step 5 — consult the active task index (`wiki/work/tasks/index.md`) and ask the user to confirm the relationships before writing (same dependency-identification process as `/task-add` Step 5).
- [x] Delete the fenced blockquote example entirely (do not re-embed a frontmatter example — lifecycle.md is the reference).
- [x] If `lib/skills/task-update/SKILL.md` no longer exists (file still exists; step applied) when this is tackled (Phase 4 removed it), skip this step and note it in the task file.
- [x] Do not touch the other stale structure-checklist items in the same section (`# NNN —` heading form, `## Prerequisites`); that legacy drift is separate and dies with `task-update` in Phase 4.

### 4. Rewrite task-audit Step 2e to read frontmatter and adapt downstream references <!-- agent: general-purpose -->

- [x] In `lib/skills/task-audit/SKILL.md`, rewrite "### 2e. Parse the Dependency Block" (title becomes "2e. Read the Dependency Fields"): read `depends_on`, `blocks`, `parallel_safe_with` from the task file's YAML frontmatter (already in hand from the Step 2 read) — format per `wiki/work/tasks/lifecycle.md` ("Dependency fields"), not restated here. Keep two behavior rules: a missing key is treated as an empty list, and a key that is absent entirely is recorded as `missing_deps` for the report. Delete the blockquote example, the "Values may be `none`" / `[NNN-slug](NNN-slug.md)` link-pattern bullets, and the "Going forward, task files should also carry ... typed links" paragraph (the mirror is documented once in lifecycle.md; the parser does not read it).
- [x] In "### 2f. Build the Node Record": change the `id` and the `depends_on` / `blocks` / `parallel_safe` value comments from `NNN-slug` to `TASK-NNNN`; rename `missing_block` to `missing_deps` (`true` if none of the three frontmatter keys is present); update the trailing "Note tasks missing the dependency block" sentence to "missing dependency fields" (still pointing the user at `/task-update`).
- [x] In 2d item 3, change "(e.g. in their dependency blocks)" to "(in their `depends_on` / `blocks` frontmatter)".
- [x] In Step 4's issues section: rename the category `Missing dependency block` to `Missing dependency fields` with definition "task frontmatter has none of `depends_on` / `blocks` / `parallel_safe_with`"; update the example-table row ("Missing dependency block — run `/task-update 006` ...") and the "Fix missing dependency blocks:" remediation heading accordingly; change example IDs in that table from `006-migrate-commands-to-skills` style to `TASK-NNNN` style where they refer to dependency values (the `Stale reference: depends_on "003-deleted-task"` row).
- [x] (Residue: Mermaid sample, Execution Waves / Blocking Chains / Completion Findings / Suggested Next Steps examples still use `001-project-registry-push` / `NNN-slug` display names — left alone as ambiguous; `--json` sample updated to `TASK-NNNN` form) Search `lib/skills/task-audit/SKILL.md` for the remaining `NNN-slug` / `001-project-registry-push` style dependency examples (the `--json` sample near the end has `"id": "001-project-registry-push"` and `"depends_on": [...]`); update only those that describe dependency values to `TASK-NNNN` form — leave unrelated uses of `NNN-slug` (e.g. filename patterns) alone. If an example change would be large or ambiguous, leave it and record the residue in the task file rather than guessing.
- [x] Do not edit Step 3's graph logic (validate edges, cycles, waves) — it operates on the node record's IDs and is format-agnostic.

### 5. Add a contract test <!-- agent: general-purpose -->

- [x] Create `test/task-dependency-single-source.test.js`, zero-dependency (`node:test` + `node:assert/strict`, `'use strict'`, repo-relative paths, hermetic — no subprocess, no writes), mirroring the header/helper style of `test/wiki-lint-taskless-decisions.test.js` (short comment block explaining why a doc-only skill change is tested).
- [x] Assert none of `lib/skills/task-add/SKILL.md`, `lib/skills/task-update/SKILL.md` (skip if the file is absent), `lib/skills/task-audit/SKILL.md` contains `**Depends on**` or `**Parallel-safe with**` (the blockquote format).
- [x] Assert each of the three skill files references `tasks/lifecycle.md` in the dependency context (e.g. matches `/lifecycle\.md[^\n]*Dependency fields|Dependency fields[^\n]*lifecycle\.md/`).
- [x] Assert `task-audit/SKILL.md` Step 2e text mentions frontmatter and no longer contains `missing_block`.
- [x] Assert both lifecycle.md copies (`lib/scripts/templates/wiki/work/tasks/lifecycle.md`, `wiki/work/tasks/lifecycle.md`) contain a "Dependency fields" heading/label and still list `depends_on`, `blocks`, `parallel_safe_with` in their schema tables.
- [x] Run `node --test test/task-dependency-single-source.test.js`, then `npm test` to confirm no sibling suite regressed (notably `skill-frontmatter-aliases.test.js` and `wiki-work-naming-convention.test.js`). New test 11/11 pass. `npm test` surfaced 4 regressions caused by this task's edits in `test/task-typed-links.test.js` (assertions on the removed blockquote/typed-link wording); added subtask below and fixed. Remaining failures are the pre-existing TASK-0085 3-digit `NNN` vs `NNNN` placeholder ones (5, not ours).
- [x] (Discovered subtask) Update `test/task-typed-links.test.js` — rewrite the 4 assertions on the removed wording to match the new frontmatter-authoritative text (task-add mirror wording; task-audit Step 2e no longer documents typed-link lines / reads frontmatter / defers to lifecycle.md). Scope extension beyond the declared file list, required because this task's edits break those assertions.
<!-- Updated: 2026-09-19 -->


### 6. Verify no residual restatements <!-- agent: Explore -->

- [x] `mcp__serena__search_for_pattern` for `Depends on\*\*|Parallel-safe with|missing_block|dependency block` across `lib/skills/`; confirm zero hits outside historical/explanatory mentions in other skills' unrelated text.
- [x] Confirm `roadmap-next` / `roadmap-assess` were not edited (out of scope) and report the `## Dependencies` / `## Blocked by` body-heading parsing there to the lead as a candidate follow-up under DEC-0001#D4.
- [x] Confirm `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md` line 26 (the "Task dependency blockquote format is specified three times" bullet) is left as-is — it is a dated research record — and that this task's completion is noted via its `relates_to::` link only.
