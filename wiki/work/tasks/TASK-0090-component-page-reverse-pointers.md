---
id: TASK-0090
aliases: [TASK-0090]
title: "Add implemented_by::/evolved_by:: reverse-pointer convention to component entity pages"
status: pending-uat
created: 2026-09-13
updated: 2026-09-13
depends_on: []
blocks: []
parallel_safe_with: [TASK-0086, TASK-0087, TASK-0088, TASK-0089, TASK-0091, TASK-0092, TASK-0093]
uat: "[[UAT-0090]]"
tags: [wiki-conventions, knowledge, components]
---

# TASK-0090 — Add implemented_by::/evolved_by:: reverse-pointer convention to component entity pages

relates_to::[[wiki-work-family-cross-linking-gaps]]

## Objective

Component entity pages (`wiki/knowledge/entities/components/*.md`) describe a component but never point forward to the work that built or is currently evolving it — the reverse direction (a concept page's `implements::` pointing at a work item, as in `multi-agent-orchestration-patterns.md` and `per-subcommand-decomposition.md`) already exists, but nothing points the other way. Add `implemented_by::`/`evolved_by::` to the declared typed-link vocabulary and backfill the two component pages the research named: `power-mode-skill.md` and `bootstrap-prefs-store.md`.

## Approach

**This touches template-owned infrastructure.** `wiki/conventions.md` is one of the files `wiki/conventions.md`'s own "Template-owned infrastructure" section names as never-edited-in-place locally — its canonical source is `lib/scripts/templates/wiki/conventions.md`. Both copies must be updated together (this repo dogfoods its own template, so the local copy also needs the edit immediately, not just at the next `sync-wiki-scaffold.sh` run) — do not edit only one.

## Steps

### 1. Extend the typed-link vocabulary in both conventions.md copies <!-- agent: general-purpose -->

- [x] In `lib/scripts/templates/wiki/conventions.md` §3 ("Typed links"), add `implemented_by` and `evolved_by` to the existing vocabulary list (`derived_from, supersedes, superseded_by, implements, uses, depends_on, contradicts, relates_to, caused, fixed`), with a one-line note: "`implemented_by::[[TASK-NNNN]]` / `evolved_by::[[ROADMAP-NNNN]]` on a `knowledge/entities/components/` page — the inverse of a task's/roadmap's own `implements::`/`derived_from::` pointing at the concept."
- [x] Apply the identical edit to `wiki/conventions.md` (this repo's local, always-refreshed copy) so the dogfood instance stays in sync without waiting for the next scaffold sync.

### 2. Backfill power-mode-skill.md <!-- agent: general-purpose -->

- [x] `Read` `wiki/knowledge/entities/components/power-mode-skill.md` in full first (never edit an entity page without reading it — per this repo's own ingest discipline).
- [x] Add an `evolved_by::[[ROADMAP-0013]]` line (this roadmap touches `power-mode-skill.md`'s own orchestration pattern indirectly via this task) — but only if the page's content actually reflects work `ROADMAP-0013` is doing to it; if not directly evolved by this roadmap, instead scan `wiki/work/tasks/` and `wiki/work/roadmaps/` for the task/roadmap that actually built or most recently touched `lib/skills/power-mode/SKILL.md`, and cite that one instead. Do not cite a roadmap/task that didn't actually touch the component — accuracy over completeness. ROADMAP-0013 doesn't actually modify `power-mode-skill.md`'s own content, so per the fallback rule, cited `evolved_by::[[TASK-003]]` instead — confirmed via `search_for_pattern` that TASK-003 (archived) actually fixed two stale `README.md`→`index.md` references inside `lib/skills/power-mode/SKILL.md`.

### 3. Backfill bootstrap-prefs-store.md <!-- agent: general-purpose -->

- [x] `Read` `wiki/knowledge/entities/components/bootstrap-prefs-store.md` in full.
- [x] Identify the task(s)/roadmap(s) that built `lib/scripts/bootstrap-prefs.js` (search `wiki/work/tasks/archive/` for titles mentioning "bootstrap-prefs" — several exist per the earlier task-index scan, e.g. `TASK-040-bootstrap-prefs-schema`, `TASK-041-bootstrap-prefs-helper`, `TASK-042-bootstrap-prefs-tests`) and add `implemented_by::[[TASK-0040]]`-style lines (use the real archived IDs found, not invented ones) for the ones that most directly built the current implementation, plus `evolved_by::[[ROADMAP-011]]` since `ROADMAP-011-build-bootstrap-prefs-tui.md` is actively extending it.

### 4. Do not backfill every other component page <!-- agent: general-purpose -->

- [x] Scope is exactly the two pages named above — this task establishes the convention and demonstrates it, it does not attempt a wiki-wide backfill. Other component pages (`settings-deny-list.md`, `bootstrap-claude-hooks.md`, `serena-health-tracking-hook.md`, `now-skill.md`, `bootstrap-guarded-install-pattern.md`) are candidates for the same treatment later, not done here.
