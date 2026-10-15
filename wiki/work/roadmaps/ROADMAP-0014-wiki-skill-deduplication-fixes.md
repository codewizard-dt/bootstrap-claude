---
id: ROADMAP-0014
aliases: [ROADMAP-0014]
title: Wiki Skill De-duplication and Correctness Fixes
status: active
created: 2026-09-13
updated: 2026-09-19
owner: David Taylor
derived_from: [wiki-skill-simplification, wiki-skill-boilerplate-duplication]
linked_requirements: []
linked_decisions: [DEC-0001]
tags: [skill-design, wiki-conventions, redundancy]
---

# Roadmap 0014: Wiki Skill De-duplication and Correctness Fixes

## Goal

Every `wiki/work/` family skill either references shared mechanics instead of restating them (or its restatement is justified), the `req-update`/`req-retire` divergent-retire bug is fixed, `bug-file`'s `Status: new` vs. `open` schema drift is corrected, the decision-supersession-scoring algorithm is consolidated into `decisions/lifecycle.md` via a new Decision Group, and the `wiki/work/` family/action vocabulary is standardized so every family shares a common `create`/`assess` action pair and terminal-state naming is consistent.

## Phase 1: Correctness Fixes

- [ ] [[TASK-0095: Align bug-file with bugs/lifecycle.md: write status open, not new]]

## Phase 2: De-duplication Extraction

- [ ] [[TASK-0096: Rewrite wiki-tidy to reference wiki-lint/wiki-archive/wiki-rotate-log instead of re-embedding them]]
- [ ] [[TASK-0097: Extract a shared 'archive a work item' reference doc and wire six skills to it]]
- [x] [[TASK-0098: Extract a shared ID/file-resolution reference doc and wire the consuming skills to it]]
- [ ] [[TASK-0099: Extract a shared skill-boilerplate doc (prereqs line, Edit-hygiene rule, number-allocation algorithm) and wire consuming skills to it]]
- [x] [[TASK-0100: Shrink power-mode's Single-Task Executor mode to a pointer at /tackle → /uat-generate → /uat-auto]]

## Phase 3: Schema Formalization

- [ ] [[TASK-0101: Create a Decision Group consolidating the decision-supersession-scoring algorithm into decisions/lifecycle.md]]
- [x] [[TASK-0102: Point task-add, task-update, and task-audit at tasks/lifecycle.md's frontmatter-array dependency schema]]

## Phase 4: Family & Action Vocabulary Standardization

- [ ] [[TASK-0110: Rename task-audit to task-assess]]
- [x] [[TASK-0111: Rename task-trash to task-close]]
- [x] [[TASK-0112: Rename the task-add skill to task-create]]
- [x] [[TASK-0113: Rename uat-generate to uat-create]]
- [ ] [[TASK-0114: Rename bug-file to bug-create and sweep every live reference]]
- [x] [[TASK-0115: Remove req-update and task-update entirely, with no replacement]]
- [x] [[TASK-0116: Rename the requirements family's skills to PRD and issue new items as PRD-NNNN]]
- [x] [[TASK-0117: Rename the decisions family's skills to ADR and make ADR- the new-item prefix]]
- [ ] [[TASK-0118: Rename req-extract-decisions to adr-extract and re-home it as an ADR-side skill that takes a PRD or any document as its source]]
- [ ] [[TASK-0119: Rename req-retire to prd-deprecate and add a new status-only adr-deprecate]]
- [ ] [[TASK-0120: Add prd-assess, adr-assess, and uat-assess skills mirroring roadmap-assess/bug-assess]]
- [ ] [[TASK-0121: Remove archive/ from the roadmaps, decisions and requirements families (in-place close with Active/Closed index sections)]]
- [ ] [[TASK-0122: Make install-global.sh prune stale skill directories from ~/.claude/skills/ via a maintained stale-skills.json]]
- [ ] [[TASK-0123: Add an idempotent migrate-wiki-ids step to `bootstrap update` (REQ→PRD, DEC→ADR, un-archive)]]
- [ ] [[TASK-0124: Run the PRD/ADR/un-archive migration on this repo's own wiki and verify it]]

## Notes

- Originated from `/research wiki work family lifecycles and instructions, consider ways to simplify skills/instructions/workflows...` this session (not a REQ): [Research: Simplifying the wiki/work/ Family Skills](../../knowledge/sources/wiki-skill-simplification.md) and [wiki/work/ Skill Duplication Catalogue](../../knowledge/concepts/wiki-skill-boilerplate-duplication.md).
- Phase 3's second item depends on [[DEC-0001]]#D4 (task-dependency-encoding standardization) being finalized — that decision is owned by [[ROADMAP-0013]], not this roadmap; this item should not be tackled until D4 is accepted.
- The `req-*` → `requirement-*` skill rename was researched in the same session ([Research: Renaming req-* Skills to requirement-*](../../knowledge/sources/req-to-requirement-rename.md), [skill-family-rename-pattern](../../knowledge/concepts/skill-family-rename-pattern.md)) but is **superseded by Phase 4's `requirements` → `PRD` rename** — the user has confirmed PRD is the preferred label, not `requirement-*`. The research page remains as historical context for the rejected direction; no future roadmap should revive `requirement-*`.
- Phase 4 was derived from an in-conversation design discussion (iterative action-matrix tables), not from the `wiki-skill-simplification`/`wiki-skill-boilerplate-duplication` sources behind Phases 1-3 — there is no `raw/` source backing it.
- Phase 4's open questions were all resolved in a Q&A on 2026-09-19 (recorded here in place of a Decision Group, by the owner's choice):
  1. `req-extract-decisions` renames to `adr-extract` (not `prd-extract-adrs`) and becomes an ADR-side skill that takes a PRD (or other document) as its source.
  2. **ID prefixes:** new items use `PRD-`/`ADR-`; existing `REQ-`/`DEC-` items are renamed by the `npx … update` migration (old ID kept in `aliases:`), not bulk-renamed by hand. The migration also renames the `linked_requirements`/`linked_decisions` frontmatter fields to `linked_prds`/`linked_adrs`.
  3. **Directories keep their names** (`wiki/work/requirements/`, `wiki/work/decisions/`); only skills, IDs, docs and prose change.
  4. **Old skill names are hard-renamed** with no redirect stubs; `install-global.sh` prunes the stale installed copies.
  5. **Roadmaps, decisions and requirements are no longer archived**: no `archive/` folder and no `roadmap-close`; finished files stay in place and appear in a Closed section of the family index. Tasks, UAT and bugs keep `archive/`. This partly supersedes the archive behavior added by TASK-0097 (`ARCHIVE-WORK-ITEM.md`) for those three families.
  6. **`prd-deprecate` and `adr-deprecate` are kept but status-only** (no file move). Roadmaps and UAT get no terminal action skill.
  7. **`prd-assess`/`adr-assess`/`uat-assess` mirror `roadmap-assess`/`bug-assess`.**
  8. The migration leaves `wiki/log.md` (append-only) and `raw/` (immutable) untouched, and is run on this repo's own wiki as its first real use.
- Sequencing for Phase 4 (file overlap): do the single-skill renames and the `req-update`/`task-update` removal first, then the PRD and ADR family renames, then the `archive/` removal and `deprecate`/`assess` skills, then the installer prune, and the migration and its run on this repo last, since it depends on the final names and file layout. Tasks 0096 and 0101 (Phases 2 and 3) are unaffected.
- All items are inline placeholders (no task files exist yet) — `/roadmap-next` will create them automatically.
