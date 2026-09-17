---
id: ROADMAP-0014
aliases: [ROADMAP-0014]
title: Wiki Skill De-duplication and Correctness Fixes
status: active
created: 2026-09-13
updated: 2026-09-13
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

- [ ] Fix `req-update`'s inline retire branch, which skips `req-retire`'s `git mv` archive step and leaves retired requirements in divergent end states — strip the branch and redirect to `/req-retire`
- [ ] Fix `bug-file/SKILL.md` writing `Status: new` when `bugs/lifecycle.md`'s status enum starts at `open` — align `bug-file` with the documented schema

## Phase 2: De-duplication Extraction

- [ ] Rewrite `wiki-tidy` to reference `wiki-lint`/`wiki-archive`/`wiki-rotate-log`'s procedures instead of re-embedding them (already drifted from `wiki-archive`'s Step 3 prompt wording — largest single line-count cut)
- [ ] Extract a shared "archive a work item" reference doc (status flip + `git mv` + dual-index edit + log append, parameterized by family + terminal status); wire `task-audit`, `task-trash`, `roadmap-next`, `bug-triage`, `bug-close`, `wiki-archive` to it
- [ ] Extract a shared ID/file-resolution reference doc (accepted forms: path / `NNN-slug` / bare `NNN`); wire the ~10 consuming skills to it
- [ ] Extract a shared boilerplate doc (prereqs line + `sed`/`awk`/`echo >>` hygiene rule + number-allocation algorithm), `UAT-CORE.md`-style; wire consuming skills to it
- [ ] Shrink `power-mode`'s Single-Task Executor mode to a short pointer at `/tackle` → `/uat-generate` → `/uat-auto`; keep the Roadmap-to-Completion mode intact

## Phase 3: Schema Formalization

- [ ] `/decision-create` a new Decision Group consolidating the decision-supersession-scoring algorithm (duplicated between `decision-create` Step 2.5 and `decision-finalize` Step 2.5) into `decisions/lifecycle.md`
- [ ] Once [[DEC-0001]]#D4 is finalized, remove the duplicate task-dependency-format restatements from `task-add`, `task-update`, and `task-audit`, and point them at `tasks/lifecycle.md`'s (updated) frontmatter-array schema

## Phase 4: Family & Action Vocabulary Standardization

- [ ] Rename the `requirements` family to **PRD** (skill names, directory/doc labels, lifecycle references — e.g. `req-create` → `prd-create`); confirm before execution whether the `REQ-NNNN` ID prefix is in scope or only the family/skill label
- [ ] Rename the `decisions` family to **ADR** (skill names, directory/doc labels, lifecycle references — e.g. `decision-create` → `adr-create`); confirm before execution whether the `DEC-NNNN` ID prefix is in scope or only the family/skill label
- [ ] Rename `task-audit` → `task-assess`
- [ ] Rename `req-retire` → `<PRD>-deprecate` (final name — supersedes the intermediate `req-close` naming considered during design)
- [ ] Add a new `<ADR>-deprecate` skill — the decisions/ADR family has no prior terminal/deprecate action to rename
- [ ] Rename `task-trash` → `task-close`
- [ ] Rename `task-add` → `task-create`
- [ ] Rename `uat-generate` → `uat-create`
- [ ] Rename `bug-file` → `bug-create`
- [ ] Remove `req-update` and `task-update` entirely, with no replacement — no other family has ever had an `update` action, and removal simplifies the vocabulary rather than extending it everywhere
- [ ] Add `<PRD>-assess`, `<ADR>-assess`, and `uat-assess` so every family (Roadmaps/Tasks/Bugs already have one) shares a common `assess` action
- [ ] Rename `req-extract-decisions` → `adr-extract`; change its source semantics from operating only within the requirements/PRD family to explicitly taking a PRD (or other document) as its source and producing ADR candidates from it — this moves the action from a PRD-side skill to an ADR-side skill

## Notes

- Originated from `/research wiki work family lifecycles and instructions, consider ways to simplify skills/instructions/workflows...` this session (not a REQ): [Research: Simplifying the wiki/work/ Family Skills](../../knowledge/sources/wiki-skill-simplification.md) and [wiki/work/ Skill Duplication Catalogue](../../knowledge/concepts/wiki-skill-boilerplate-duplication.md).
- Phase 3's second item depends on [[DEC-0001]]#D4 (task-dependency-encoding standardization) being finalized — that decision is owned by [[ROADMAP-0013]], not this roadmap; this item should not be tackled until D4 is accepted.
- The `req-*` → `requirement-*` skill rename was researched in the same session ([Research: Renaming req-* Skills to requirement-*](../../knowledge/sources/req-to-requirement-rename.md), [skill-family-rename-pattern](../../knowledge/concepts/skill-family-rename-pattern.md)) but is **superseded by Phase 4's `requirements` → `PRD` rename** — the user has confirmed PRD is the preferred label, not `requirement-*`. The research page remains as historical context for the rejected direction; no future roadmap should revive `requirement-*`.
- Phase 4 was derived from an in-conversation design discussion (iterative action-matrix tables), not from the `wiki-skill-simplification`/`wiki-skill-boilerplate-duplication` sources behind Phases 1-3 — there is no `raw/` source backing it.
- Phase 4's open questions have been resolved except one:
  1. **Resolved** — `req-extract-decisions` renames to `adr-extract` (not `prd-extract-adrs`) and becomes an ADR-side skill that takes a PRD (or other document) as its source.
  2. **Still open** — whether Roadmaps and UAT need their own terminal `deprecate`/`close`-equivalent action. After Phase 4, PRD/ADR use `deprecate` and Tasks/Bugs use `close`, but Roadmaps and UAT have no terminal action of their own; resolve before or while executing Phase 4.
- All items are inline placeholders (no task files exist yet) — `/roadmap-next` will create them automatically.
