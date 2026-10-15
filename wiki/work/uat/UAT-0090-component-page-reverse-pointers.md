---
id: UAT-0090
aliases: [UAT-0090]
title: "UAT: Add implemented_by::/evolved_by:: reverse-pointer convention to component entity pages"
status: pending
task: TASK-0090
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0090 — UAT: Add implemented_by::/evolved_by:: reverse-pointer convention to component entity pages

implements::[[TASK-0090]]

> **Source task**: [[TASK-0090]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0090's edits to `lib/scripts/templates/wiki/conventions.md`, `wiki/conventions.md`, `wiki/knowledge/entities/components/power-mode-skill.md`, and `wiki/knowledge/entities/components/bootstrap-prefs-store.md`.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).

---

## Test Cases

### UAT-EDGE-001: both conventions.md copies declare implemented_by and evolved_by in the vocabulary
- **Scenario**: Step 1 requires `implemented_by` and `evolved_by` to be added to the §3 "Typed links" **Vocabulary** line in the template (`lib/scripts/templates/wiki/conventions.md`) and in this repo's local dogfood copy (`wiki/conventions.md`). Editing only one copy would be silently overwritten by, or missing from, the next `sync-wiki-scaffold.sh` run.
- **Steps**: Read the `**Vocabulary:**` line in each of the two files; confirm both list `implemented_by` and `evolved_by`.
- **Expected Result**: Both files' vocabulary line contains `` `implemented_by` `` and `` `evolved_by` ``.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: the ten original link types survive the vocabulary edit
- **Scenario**: The edit must be additive. `derived_from`, `supersedes`, `superseded_by`, `implements`, `uses`, `depends_on`, `contradicts`, `relates_to`, `caused`, and `fixed` must all remain in the vocabulary line of both copies.
- **Steps**: Read the `**Vocabulary:**` line in both files; confirm each of the ten original terms is still present.
- **Expected Result**: All ten original terms present in both copies, alongside the two new ones.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: both copies carry the one-line usage note explaining the inverse relationship
- **Scenario**: Step 1 specifies a note: "`implemented_by::[[TASK-NNNN]]` / `evolved_by::[[ROADMAP-NNNN]]` on a `knowledge/entities/components/` page — the inverse of a task's/roadmap's own `implements::`/`derived_from::` pointing at the concept." It must appear in both copies so a reader knows where and why to use the new types.
- **Steps**: Read the paragraph immediately after the `**Vocabulary:**` line in each file.
- **Expected Result**: The note is present in both files, naming the `knowledge/entities/components/` scope and describing the inverse of `implements::`/`derived_from::`.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: template and local conventions.md are byte-identical
- **Scenario**: The task's Approach section states both copies "must be updated together" because `wiki/conventions.md` is template-owned infrastructure whose canonical source is `lib/scripts/templates/wiki/conventions.md`. Any drift between them means one edit was missed or diverged.
- **Steps**: Diff `lib/scripts/templates/wiki/conventions.md` against `wiki/conventions.md`.
- **Expected Result**: No differences.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: power-mode-skill.md carries an evolved_by:: pointer that resolves to a real work item
- **Scenario**: Step 2 requires `power-mode-skill.md` to gain an `evolved_by::` pointer. Per the task's own fallback rule it cites `[[TASK-003]]` (archived `TASK-003-fix-readme-drift-in-skills.md`) rather than ROADMAP-0013. The target must be a real task/roadmap file in an active or `archive/` directory — not an invented ID.
- **Steps**: Read `wiki/knowledge/entities/components/power-mode-skill.md`; extract every `evolved_by::[[...]]` target; confirm each resolves to a file named `<ID>-*.md` under `wiki/work/tasks/` (or `archive/`) or `wiki/work/roadmaps/` (or `archive/`).
- **Expected Result**: At least one `evolved_by::` pointer is present and every target resolves to an existing file.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: power-mode-skill.md cites only a work item that actually touched the component (accuracy over completeness)
- **Scenario**: Step 2 says: "Do not cite a roadmap/task that didn't actually touch the component." ROADMAP-0013 does not modify `lib/skills/power-mode/SKILL.md`'s content, so it must not appear on the page; the cited target's own file must mention `lib/skills/power-mode/SKILL.md`.
- **Steps**: Search `power-mode-skill.md` for `ROADMAP-0013`; open the file behind each `evolved_by::` target and search it for `lib/skills/power-mode/SKILL.md`.
- **Expected Result**: `ROADMAP-0013` is absent from the page; every cited target's file mentions `lib/skills/power-mode/SKILL.md`.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: bootstrap-prefs-store.md cites TASK-040, TASK-041, and TASK-042 as implemented_by, all real
- **Scenario**: Step 3 requires `implemented_by::` pointers using "the real archived IDs found, not invented ones". The archive holds `TASK-040-bootstrap-prefs-schema`, `TASK-041-bootstrap-prefs-helper`, and `TASK-042-bootstrap-prefs-tests` (all `status: done`). The page must cite these three and every `implemented_by::` target must resolve.
- **Steps**: Read `wiki/knowledge/entities/components/bootstrap-prefs-store.md`; extract every `implemented_by::[[...]]` target; confirm `TASK-040`, `TASK-041`, `TASK-042` are among them and that each target resolves to a task file.
- **Expected Result**: All three IDs present; no target fails to resolve.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: bootstrap-prefs-store.md cites ROADMAP-011 as evolved_by, and it resolves to the bootstrap-prefs-tui roadmap
- **Scenario**: Step 3 requires `evolved_by::[[ROADMAP-011]]` because `ROADMAP-011-build-bootstrap-prefs-tui.md` is extending the store. The target must resolve and actually be about `bootstrap-prefs-tui`.
- **Steps**: Confirm `evolved_by::[[ROADMAP-011]]` on the page; open `wiki/work/roadmaps/ROADMAP-011-build-bootstrap-prefs-tui.md` and confirm it concerns `bootstrap-prefs-tui`.
- **Expected Result**: Pointer present; target file exists and mentions `bootstrap-prefs-tui`.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: backfilled pages keep their frontmatter and pre-existing typed links
- **Scenario**: The backfill must be additive. `power-mode-skill.md` must retain its `id: power-mode-skill` frontmatter and its `implements::[[Multi-Agent Orchestration Patterns]]` link; `bootstrap-prefs-store.md` must retain `id: bootstrap-prefs-store` and `derived_from::[[bootstrap-prefs-editor-tui]]`.
- **Steps**: Read the first lines and body of each page; confirm the frontmatter `id` and the named pre-existing typed link are intact.
- **Expected Result**: Both pages retain frontmatter ids and the named links.
- **Repeatable Unit Test**: Created: `test/component-page-reverse-pointers.test.js`
- **Unit Test Command**: `node --test test/component-page-reverse-pointers.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: scope fence — no other component page was backfilled (Step 4)
- **Scenario**: Step 4 says scope is exactly the two named pages; `settings-deny-list.md`, `bootstrap-claude-hooks.md`, `serena-health-tracking-hook.md`, `now-skill.md`, and `bootstrap-guarded-install-pattern.md` are "candidates for the same treatment later, not done here". This is a point-in-time check made at the commit under test, not a standing invariant, so it is verified manually rather than as a permanent unit test.
- **Steps**:
  1. Using `mcp__serena__search_for_pattern` with `implemented_by::|evolved_by::` and `paths_include_glob: wiki/knowledge/entities/components/*.md`, list the files that match.
  2. Compare against the two expected pages.
- **Expected Result**: Exactly two files match: `power-mode-skill.md` and `bootstrap-prefs-store.md`.
- **Repeatable Unit Test**: Not applicable: a permanent test would fail for the wrong reason as soon as a later task legitimately backfills another component page.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-MANUAL-001: the new link types read correctly on a real page and render as the intended inverse
- **Scenario**: Confirms the convention is understandable to a reader who has not seen the task: the note in `conventions.md` §3 describes where to use the types, and the two backfilled pages demonstrate them in a way consistent with that note (a component page pointing forward at the task/roadmap, mirroring a task's own `implements::`/`derived_from::` back at the concept).
- **Steps**:
  1. Open `wiki/conventions.md` §3 and read the vocabulary line and the note beneath it.
  2. Open `wiki/knowledge/entities/components/bootstrap-prefs-store.md` and read the final paragraph.
  3. Open `wiki/knowledge/entities/components/power-mode-skill.md` and read the final paragraph.
  4. Check that the sentence each page wraps around its pointers is accurate to the linked work item (e.g. TASK-041 does build the four-state read/write engine; TASK-003 does fix the stale `README.md` references in `lib/skills/power-mode/SKILL.md`).
- **Expected Result**: The note explains the types unambiguously; each pointer's surrounding claim matches the linked work item's own content.
- **Repeatable Unit Test**: Not applicable: judging whether prose is accurate and clear is a human review; the mechanical parts (resolution, presence, parity) are covered by UAT-EDGE-001 through 009.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

---

## Notes

- TASK-0090 touched only markdown: two template-owned `conventions.md` copies and two knowledge component pages. There is no API or UI surface, so all cases are EDGE (static content contract) plus one MANUAL review.
- `uatGenerate.promoteTests` resolved to `true` (legacy value) → mapped to `dedicated`. The repo's existing `test/` directory and `node --test` convention were followed, matching `test/bug-close-clustering-offer.test.js` and `test/wiki-work-naming-convention.test.js`.
- One unit test file backs EDGE-001 through EDGE-009: `test/component-page-reverse-pointers.test.js` (10 `node:test` cases). Verified passing: `node --test test/component-page-reverse-pointers.test.js` → 10/10 pass, 0 fail.
- The unit test deliberately does not assert ROADMAP-011's `status: active`: the roadmap will complete and archive, and the test resolves IDs through `archive/` so normal lifecycle progress does not turn it red.
- Research checks made while generating: `TASK-040`, `TASK-041`, `TASK-042`, `TASK-003` exist under `wiki/work/tasks/archive/`; `ROADMAP-011-build-bootstrap-prefs-tui.md` exists in `wiki/work/roadmaps/` with `status: active`; `TASK-003`'s file lists the stale `wiki/work/tasks/README.md` references in `lib/skills/power-mode/SKILL.md`; the two `conventions.md` copies were byte-identical at generation time.
- No gaps: every step of TASK-0090 (Steps 1-4) is covered by a static assertion (EDGE-001..009), a point-in-time scope check (EDGE-010), or a human review (MANUAL-001).
