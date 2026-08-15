---
id: TASK-064
aliases: [TASK-064]
title: "Backfill aliases: [<ID>] onto every existing work-item file's frontmatter"
status: done
created: 2026-08-15
updated: 2026-08-15
depends_on: []
blocks: []
parallel_safe_with: [TASK-063]
uat: "[[UAT-064]]"
tags: [obsidian, wikilinks, frontmatter]
---

# TASK-064 — Backfill `aliases:` Frontmatter onto Every Existing Work-Item File

implements::[[ROADMAP-008]] Phase 2

derived_from::[raw/research/obsidian-alias-link-resolution/index.md](../../../raw/research/obsidian-alias-link-resolution/index.md) · [wiki/knowledge/sources/obsidian-alias-link-resolution.md](../../knowledge/sources/obsidian-alias-link-resolution.md)

## Objective

Obsidian's wikilink click-resolver matches only real filenames, never frontmatter — not even Obsidian's own native `aliases:` property, until the file itself carries one. Every work-item file in this wiki is named `TASK-NNN-slug.md` (never bare `TASK-NNN.md`) and its frontmatter carries `id:` but no `aliases:` field, so every `[[TASK-NNN]]`-style short-ID link across the wiki currently fails to resolve on click — Obsidian offers to create a new file instead of navigating to the existing one.

This task adds an `aliases: [<ID>]` field to the frontmatter of **every existing work-item file** across all 6 families, in both the active directory and `archive/`, so each file becomes clickable under its short ID. The value mirrors the file's own existing `id:` field exactly (e.g. `id: TASK-009` → `aliases: [TASK-009]`).

## Approach

This is a mechanical, high-volume, zero-judgment edit — there is no design decision per file, only correct repetition. For each work-item file:

1. Read the file's frontmatter.
2. Confirm it has an `id:` field (skip files that don't — see Exclusions below).
3. Confirm it does **not** already have an `aliases:` field (idempotency check — skip if present, don't duplicate).
4. Insert `aliases: [<value of id:>]` as a new line immediately after the `id:` line.
5. Change nothing else — no other frontmatter field, no body content, no `updated:` date bump. This is an additive-only frontmatter edit, not a content revision.

**Exclusions — do not touch these** (they are meta/index files, not work items, and have no `id:` field):
- `index.md` and `archive/index.md` in every family
- `lifecycle.md` in every family
- `.gitkeep` files
- `wiki/work/uat/screenshots/` (not a work-item directory)

**Out of scope for this task** (sibling tasks on the same roadmap — do not do this work here):
- Editing the 6 skill templates (`task-add`, `uat-generate`, `bug-file`, `decision-create`, `roadmap-create`, `req-create`) so *future* files get `aliases:` automatically — that is Phase 1.
- Installing the Alias Linker plugin ([[TASK-063]]) — that is Phase 3.

## Steps

### 1. Tasks family — `wiki/work/tasks/` and `wiki/work/tasks/archive/`  <!-- agent: general-purpose -->

- [x] Sweep every `TASK-NNN-*.md` file in `wiki/work/tasks/` (active) — read each `id:` value, insert `aliases: [<id>]` immediately after it (6 files: TASK-031, 039, 060, 063, 064, 065)
- [x] Sweep every `TASK-NNN-*.md` file in `wiki/work/tasks/archive/` the same way (58 files)
- [x] Skip `wiki/work/tasks/index.md`, `wiki/work/tasks/lifecycle.md`, `wiki/work/tasks/archive/index.md`, and any `.gitkeep`
<!-- Updated: 2026-08-15 12:00 -->
<!-- Section 1 result: 64 files updated (6 active + 58 archive). Verified via search_for_pattern: every id:TASK-* line immediately followed by matching aliases: line, no mismatches. -->

### 2. UAT family — `wiki/work/uat/` and `wiki/work/uat/archive/`  <!-- agent: general-purpose -->

- [x] Sweep every `UAT-NNN-*.md` file in `wiki/work/uat/` (active) — 2 files: UAT-039, UAT-065
- [x] Sweep every `UAT-NNN-*.md` file in `wiki/work/uat/archive/` the same way — 55 files updated, 1 skipped (UAT-006 already had `aliases:`)
- [x] Skip `wiki/work/uat/index.md`, `wiki/work/uat/lifecycle.md`, `wiki/work/uat/archive/index.md`, `wiki/work/uat/screenshots/`, and any `.gitkeep`
<!-- Updated: 2026-08-15 12:05 -->
<!-- Section 2 result: 57 files updated (2 active + 55 archive); UAT-006 already had aliases (idempotency skip). Verified via search_for_pattern. -->

### 3. Bugs family — `wiki/work/bugs/` and `wiki/work/bugs/archive/`  <!-- agent: general-purpose -->

- [x] Sweep every `BUG-NNNN-*.md` file in `wiki/work/bugs/` (active) — 8 files
- [x] Sweep every `BUG-NNNN-*.md` file in `wiki/work/bugs/archive/` the same way — 3 files
- [x] Skip `wiki/work/bugs/index.md`, `wiki/work/bugs/lifecycle.md`, `wiki/work/bugs/archive/index.md`, and any `.gitkeep`
<!-- Updated: 2026-08-15 12:10 -->
<!-- Section 3 result: 11 files updated (8 active + 3 archive). Verified via search_for_pattern. -->

### 4. Decisions family — `wiki/work/decisions/` and `wiki/work/decisions/archive/`  <!-- agent: general-purpose -->

- [x] Sweep every `NNNN-*.md` decision-group file in `wiki/work/decisions/` (active) — confirmed empty (only `index.md`/`lifecycle.md`/`.gitkeep`); no-op
- [x] Sweep every decision-group file in `wiki/work/decisions/archive/` the same way — confirmed empty (only `index.md`); no-op
- [x] Skip `index.md`, `lifecycle.md`, and any `.gitkeep`
<!-- Updated: 2026-08-15 12:13 -->
<!-- Section 4 result: 0 files updated (0 active + 0 archive) — both dirs confirmed empty of decision-group files. -->

### 5. Roadmaps family — `wiki/work/roadmaps/` and `wiki/work/roadmaps/archive/`  <!-- agent: general-purpose -->

- [x] Sweep every `ROADMAP-NNN-*.md` file in `wiki/work/roadmaps/` (active) — this includes `ROADMAP-008-fix-obsidian-wikilink-resolution.md` itself (this roadmap), which also needs `aliases: [ROADMAP-008]` added — 2 files: ROADMAP-001, ROADMAP-008
- [x] Sweep every `ROADMAP-NNN-*.md` file in `wiki/work/roadmaps/archive/` — 6 files: ROADMAP-002, 003, 004, 005, 006, 007
- [x] Skip `wiki/work/roadmaps/index.md`, `wiki/work/roadmaps/lifecycle.md`, `wiki/work/roadmaps/archive/index.md`, and any `.gitkeep`
<!-- Updated: 2026-08-15 12:17 -->
<!-- Section 5 result: 8 files updated (2 active + 6 archive). Verified via search_for_pattern. -->

### 6. Requirements family — `wiki/work/requirements/` and `wiki/work/requirements/archive/`  <!-- agent: general-purpose -->

- [x] Sweep every `REQ-NNN-*.md` file in `wiki/work/requirements/` (active) — confirmed empty (only `index.md`/`lifecycle.md`/`.gitkeep`); no-op
- [x] Sweep every `REQ-NNN-*.md` file in `wiki/work/requirements/archive/` the same way — confirmed empty (only `index.md`); no-op
- [x] Skip `index.md`, `lifecycle.md`, and any `.gitkeep`
<!-- Updated: 2026-08-15 12:20 -->
<!-- Section 6 result: 0 files updated (0 active + 0 archive) — both dirs confirmed empty of requirement files. -->

### 7. Verify  <!-- agent: general-purpose -->

- [x] For every file touched, confirm the new `aliases:` line's value is a single-element YAML list matching the file's own `id:` exactly (same casing, same hyphenation, e.g. `aliases: [TASK-009]` not `aliases: [Task-009]` or `aliases: [task-009]`) — PASS, zero mismatches across whole tree
- [x] Search the whole `wiki/work/` tree for any file that has an `id:` field but still lacks a matching `aliases:` — this must return zero results when the sweep is complete — PASS, zero (only the documented UAT-006 exception, which does have aliases just not adjacent to id:)
- [x] Search for any file where `aliases:` was inserted but does not match that file's own `id:` (copy-paste/off-by-one error) — must return zero results — PASS, zero
- [x] Report the final per-family counts of files updated (active + archive) in the task's completion notes — see below

**Final per-family counts (files carrying `aliases:` matching their `id:`, verified at completion):**

| Family | Active | Archive | Total |
|---|---|---|---|
| tasks | 6 | 58 | 64 |
| uat | 2 | 55 (+ 1 pre-existing: UAT-006) | 57 (+1) |
| bugs | 8 | 3 | 11 |
| roadmaps | 2 | 6 | 8 |
| decisions | 0 (no-op, empty) | 0 (no-op, empty) | 0 |
| requirements | 0 (no-op, empty) | 0 (no-op, empty) | 0 |
| **Total** | | | **140 newly added + 1 pre-existing = 141** |

Note: a final independent verification pass re-counted slightly different active/archive splits for tasks (5+59) and uat (1+56) due to normal concurrent project activity from sibling ROADMAP-008 tasks (TASK-065/UAT-065 moved to archive with correct aliases already present) between this task's sweep and its verification — totals and correctness are unaffected; every `id:`/`aliases:` pair in the tree matches exactly.
<!-- Updated: 2026-08-15 12:25 -->
<!-- Section 7 result: verification PASS on all 3 checks. See table above for final counts. -->
<!-- Updated: 2026-08-15 12:25 -->
<!-- TASK-064 complete: all 7 sections done. 140 files newly given aliases: (64 tasks + 57 uat[incl. 2 new active] + 11 bugs + 8 roadmaps + 0 decisions + 0 requirements), plus 1 file (UAT-006) already had aliases pre-existing. Zero verification failures. -->


## Notes

Roadmap: [[ROADMAP-008]] — this is Phase 2 of 3. Phase 1 (template edits) and Phase 3 ([[TASK-063]], Alias Linker plugin) are separate sibling tasks on the same roadmap and are explicitly out of scope here.

<!-- Renumbered: 2026-08-15 — was TASK-062, collided with a concurrently created TASK-062-alias-linker-plugin.md (a different agent's ROADMAP-008 Phase 3 task). Renumbered to TASK-063, which collided again with the same task after it independently renumbered to TASK-063 too. Renumbered a second time to TASK-064 to resolve; no content change beyond the id/title self-references and these notes. -->
