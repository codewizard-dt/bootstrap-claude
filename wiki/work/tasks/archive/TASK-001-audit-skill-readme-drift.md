---
id: TASK-001
title: "Audit lib/skills for stale README.md-style family-index references"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: [TASK-003]
parallel_safe_with: [TASK-002]
uat: "[[UAT-001]]"
tags: [wiki-tooling, audit]
---

# TASK-001 — Audit lib/skills for stale README.md-style family-index references

## Objective

Confirm which skills in `lib/skills/*.md` still assume a `wiki/work/<family>/README.md` file is the authoritative, structured family index/template (a pre-wiki-schema convention), instead of this repo's actual convention: `wiki/work/<family>/index.md` (bullet-list of active items only) + `wiki/work/<family>/lifecycle.md` (schema/transitions), per `wiki/conventions.md` and `CLAUDE.md`. Produce a verified, line-referenced list that TASK-003 (fix `/roadmap-create` and other drifting skills) can consume directly.

## Approach

A preliminary grep for `README\.md` across `lib/skills/` already surfaced candidates. Not every hit is drift — several skills legitimately reference a *root-level* project `README.md` (elevator-pitch, project-readme, update-docs), an *external* project's README (port-feature, frontend-taste's `~/code/house-style/README.md`), or their own unrelated generated README (extract-feature's feature-inventory doc, eval-create's `evals/README.md`, which is a non-wiki family). Only count a hit as drift if the skill treats `wiki/work/<family>/README.md` as the place that holds the active-item index, a structured table, or the canonical template/spec for that family — the actual index.md/lifecycle.md split. This task is audit-only; do not edit any skill files here (that's TASK-003).

## Steps

### 1. Re-run and verify the candidate list  <!-- agent: general-purpose -->

- [x] Run `mcp__serena__search_for_pattern` for `README\.md` scoped to `relative_path: "lib/skills"` (already run once in this session with these preliminary hits — re-verify each is still current):
  - `lib/skills/primer/SKILL.md` (~lines 70–77) — assumes `wiki/work/tasks/README.md` is bootstrapped with a structured table (`#`, `Slug`, `Progress`, `UAT`, `Flags`, `Objective` columns)
  - `lib/skills/task-audit/SKILL.md` (~lines 25, 68, 137, 247–272) — reads/writes `wiki/work/tasks/README.md`, including persisting a `## Dependency Graph` section into it
  - `lib/skills/bug-file/SKILL.md` (~lines 26, 44, 65, 81, 94) — reads `wiki/work/bugs/README.md` for the file template, severity rubric, and Index table
  - `lib/skills/power-mode/SKILL.md` (~lines 99, 180) — "Remove the task row from wiki/work/tasks/README.md"
  - `lib/skills/roadmap-next/SKILL.md` (~line 31) — "Read `wiki/work/tasks/README.md`, scan Active Tasks for a row..." (note: this is the skill currently being used to drive this very roadmap)
  - `lib/skills/task-update/SKILL.md` (~line 43) — cites `wiki/work/tasks/README.md` as "the authoritative task file spec"
  - `lib/skills/roadmap-create/SKILL.md` (~lines 10, 33, 50, 52, 59, 123, 130, 160, 164) — heaviest offender: treats `wiki/work/roadmaps/README.md` as the authoritative template, file spec, lifecycle doc, and Index table all at once
  - `lib/skills/tackle/SKILL.md` (~lines 37, 47, 48, 108) — assumes `wiki/work/tasks/README.md` is the canonical structured index with the same column set as primer's
  - `lib/skills/bug-close/SKILL.md` (~line 42) — reads `wiki/work/bugs/README.md` and `wiki/work/bugs/lifecycle.md` together for close-gate requirements
- [x] Confirm these are **not** drift (read each cited line to double-check, don't just trust the pattern match): `frontend-taste`, `elevator-pitch`, `project-readme`, `update-docs`, `extract-feature`, `port-feature`, `eval-create` — record the one-line reason each is out of scope
- [x] Run the same search against `lib/scripts/templates/wiki/` — preliminary run found zero hits; confirm this still holds (no template scaffolds a `README.md` for any family)

### 2. Cross-check against actual convention  <!-- agent: general-purpose -->

- [x] Read `wiki/conventions.md` and confirm the documented family-index convention (`index.md` = active items only, `lifecycle.md` = schema/transitions, no `README.md` role)
- [x] Spot-check one real family's actual files (`wiki/work/tasks/index.md`, `wiki/work/roadmaps/index.md`) to confirm they use the simple bullet-list format, not the structured-table format the drifting skills assume

### 3. Write up findings  <!-- agent: general-purpose -->

- [x] Append a `## Audit Findings` section to this task file listing: confirmed-drifting skill + exact line numbers + what it wrongly assumes, in a form TASK-003 can act on directly without re-deriving it
- [x] Update this task's `status` to `done` in frontmatter and its `updated` date; do not touch any file under `lib/skills/` (out of scope — TASK-003's job)

## Audit Findings

Audit performed 2026-07-06. Search: `mcp__serena__search_for_pattern` for `README\.md` scoped to `lib/skills` and to `lib/scripts/templates/wiki`. All line numbers below re-verified against the current file contents.

### Convention confirmed (Step 2)

`wiki/conventions.md` §"Navigation" and §"The two-domain rule" state the real convention unambiguously: each `wiki/work/<family>/` carries an **`index.md`** listing **only active items** (bullet list) plus a **`lifecycle.md`** defining schema/transitions. There is **no `README.md` role** for any family. Spot-check confirms `wiki/work/tasks/index.md` and `wiki/work/roadmaps/index.md` both use the simple bullet-list format (`- [TASK-NNN — Title](file.md) — summary · status`), **not** the structured multi-column table (`#`, `Slug`, `Progress`, `UAT`, `Flags`, `Objective`) that the drifting skills assume.

### Confirmed drifting skills (TASK-003 scope)

Each treats `wiki/work/<family>/README.md` as the authoritative index / template / spec, which does not exist under the current convention.

1. **`lib/skills/primer/SKILL.md`** — lines **70, 73, 76, 77**. Assumes `wiki/work/tasks/README.md` is a bootstrapped structured index table with columns `#`, `Slug`, `Progress`, `UAT`, `Flags`, `Objective`; line 77 writes that table to `README.md`. Should target `index.md` (bullet list) + `lifecycle.md`.

2. **`lib/skills/task-audit/SKILL.md`** — lines **25, 68, 137, 247, 251, 253, 272**. Reads `wiki/work/tasks/README.md` (25), removes rows from its "Active Tasks" table (68), and persists a `## Dependency Graph` section into it (137, 247–272). Index is really `index.md`; the README does not exist to hold a graph.

3. **`lib/skills/bug-file/SKILL.md`** — lines **26, 44, 65, 81, 94**. Reads `wiki/work/bugs/README.md` for the file template (26, 81), the severity/priority rubric (44), and the Index table (65, 94). The template/rubric belong to `lifecycle.md`; the active list is `index.md`.

4. **`lib/skills/power-mode/SKILL.md`** — lines **99, 180**. Both say "Remove the task row from wiki/work/tasks/README.md". Should be `index.md` (delete the active-item line).

5. **`lib/skills/roadmap-next/SKILL.md`** — line **31**. "Read `wiki/work/tasks/README.md`, scan Active Tasks for a row…" — should read `wiki/work/tasks/index.md`. (Line 89 also names `README.md`, but only in an *exclusion* list when listing roadmap files — benign, not drift, though harmless to drop.)

6. **`lib/skills/task-update/SKILL.md`** — line **43**. Cites `wiki/work/tasks/README.md` as "the authoritative task file spec (format and naming rules)". The spec lives in `lifecycle.md`.

7. **`lib/skills/roadmap-create/SKILL.md`** — lines **10, 33, 50, 52, 59, 123, 130, 160, 164** (heaviest offender). Treats `wiki/work/roadmaps/README.md` as authoritative template + file spec + status lifecycle + item-format rules + Index table + anti-patterns all at once (10, 33, 50, 130), searches it for reserved `ROADMAP-\d{3}` IDs (59, 123), and edits its Index table (160, 164). Also line 52 reads the Tasks table in `wiki/work/tasks/README.md`. All of this splits across `lifecycle.md` (template/spec/rules) and `index.md` (active list).

8. **`lib/skills/tackle/SKILL.md`** — lines **47, 48, 108** are drift: reads `wiki/work/tasks/README.md` as the canonical index with primer's column set (47), STOP message references it (48), and updates its `Progress`/`Flags` cells (108). Line **37** names `README.md` only in an *exclusion* list when listing roadmap `.md` files — benign, not drift (harmless to drop for consistency).

9. **`lib/skills/bug-close/SKILL.md`** — line **42**. Reads `wiki/work/bugs/README.md` and `wiki/work/bugs/lifecycle.md` together for close-gate requirements. The README half is drift; close-gate content lives in `lifecycle.md`.

### Confirmed NOT drift (out of scope)

- **`frontend-taste`** (lines 2, 29) — reads `~/code/house-style/README.md`, an *external* design-system repo. Out of scope.
- **`elevator-pitch`** (line 38) — reads the *root-level* project `README.md` for stated goals. Out of scope.
- **`project-readme`** (line 145) — *writes* the root-level project `README.md`. Out of scope.
- **`update-docs`** (lines 23, 53, 57) — edits the *root-level* project `README.md` when setup/tech-stack/structure changed. Out of scope.
- **`extract-feature`** (line 170) — its own generated Source Feature Inventory `README.md` (consumed by port-feature), a non-wiki artifact. Out of scope.
- **`port-feature`** (line 47) — reads `<source-path>/README.md` of an *external* project being ported. Out of scope.
- **`eval-create`** (line 304) — writes/updates `evals/README.md`, a non-wiki family outside `wiki/work/`. Out of scope.

### Template scan (Step 1, third bullet)

`mcp__serena__search_for_pattern` for `README\.md` over `lib/scripts/templates/wiki/` returned **zero hits** — confirmed. No family template scaffolds a `README.md`; the templates already ship `index.md` + `lifecycle.md` only. No drift in the scaffold layer; the drift is entirely in the skill instructions.
