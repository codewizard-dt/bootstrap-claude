---
id: TASK-003
aliases: [TASK-003]
title: "Fix roadmap-create and other skills drifting from the index.md/lifecycle.md convention"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-001]
blocks: [TASK-008]
parallel_safe_with: []
uat: "[[UAT-003]]"
tags: [wiki-tooling, fix]
---

# TASK-003 — Fix `/roadmap-create` and other skills drifting from the `index.md`/`lifecycle.md` convention

implements::[[TASK-001]]

## Objective

Every skill confirmed drifting by TASK-001's audit currently assumes a `wiki/work/<family>/README.md` file holds the family's authoritative template, lifecycle rules, and/or active-item index as one or more structured tables. The actual convention (per `wiki/conventions.md` §"Navigation") is: `index.md` = active items only, as a flat bullet list (`- [ID — Title](file.md) — summary · status`); `lifecycle.md` = schema + valid status transitions. No family has a `README.md`. Rewrite each drifting skill to reference the real files in the real format.

## Approach

**Wait for TASK-001 to complete first** — its `## Audit Findings` section is the authoritative, re-verified list of exactly which files/lines to change. Do not re-derive the list from scratch; use TASK-001's findings as the checklist, only falling back to the preliminary list below if TASK-001 was for some reason skipped.

Preliminary list from this task's creation-time research (confirm against TASK-001 before trusting):

| Skill | What it wrongly assumes | Fix direction |
|---|---|---|
| `lib/skills/roadmap-create/SKILL.md` | `wiki/work/roadmaps/README.md` holds file template, lifecycle, item-format rules, anti-patterns, AND an "Index" table to append to | Move template/format guidance inline into this skill (or reference `lifecycle.md` for schema); retarget every "Index" append to `wiki/work/roadmaps/index.md` using its real bullet format: `- [ROADMAP-NNN — Title](ROADMAP-NNN-slug.md) — one-line summary · N/M items checked` |
| `lib/skills/primer/SKILL.md` (Step 4, "Verify Task Index Bootstrap", ~lines 69-79) | `wiki/work/tasks/README.md` with a structured `## Active Tasks` table (`#`, `Slug`, `Progress`, `UAT`, `Flags`, `Objective` columns) that must be "bootstrapped" | Retarget to `wiki/work/tasks/index.md`. The real `index.md` has no Progress/UAT/Flags columns — there is nothing to "bootstrap." Simplify Step 4 to a lightweight consistency check: confirm every active task file has a corresponding line in `index.md` and vice versa; drop the table-bootstrap procedure entirely |
| `lib/skills/task-audit/SKILL.md` (~lines 25, 68, 137, 247-272) | Reads/writes `wiki/work/tasks/README.md`, persists a `## Dependency Graph` section into it | Retarget reads to `index.md`. For the Dependency Graph section: `index.md`'s contract is "active items only" in a flat list — appending a large generated graph section conflicts with that contract. Default to writing the graph to its own file, `wiki/work/tasks/dependency-graph.md`, cross-linked from `index.md` with one line, rather than inline in `index.md`. If this trade-off is unclear when tackling, ask the user rather than guessing |
| `lib/skills/bug-file/SKILL.md` (~lines 26, 44, 65, 81, 94) | `wiki/work/bugs/README.md` holds the full file template, severity/priority rubric, glossary, required-fields rules, AND the Index table | Move template/rubric/glossary content into `wiki/work/bugs/lifecycle.md` (schema authority) or embed directly in this skill; retarget Index appends to `wiki/work/bugs/index.md` |
| `lib/skills/power-mode/SKILL.md` (~lines 99, 180) | "Remove the task row from `wiki/work/tasks/README.md`" | Retarget to `wiki/work/tasks/index.md`; it's a bullet-line removal, not a table row |
| `lib/skills/roadmap-next/SKILL.md` (~line 31) | "Read `wiki/work/tasks/README.md`, scan Active Tasks for a row..." (this is the very skill used to drive this roadmap) | Retarget to `wiki/work/tasks/index.md`, scan its bullet entries instead of table rows |
| `lib/skills/task-update/SKILL.md` (~line 43) | Cites `wiki/work/tasks/README.md` as "the authoritative task file spec" | Point to `wiki/work/tasks/lifecycle.md` for schema authority, `index.md` for the active listing |
| `lib/skills/tackle/SKILL.md` (~lines 37, 47, 48, 108) | Assumes `wiki/work/tasks/README.md` is the canonical structured index with the same column set as primer's; no-args survey mode depends on it | Retarget to `index.md`. Since the real format has no Progress/UAT/Flags columns, redesign the no-args survey to work with what `index.md` actually offers (title + one-line summary + status). If this materially degrades `/tackle`'s no-args UX, do not silently expand `index.md`'s schema — flag it back to the user as a design question instead |
| `lib/skills/bug-close/SKILL.md` (~line 42) | Reads `wiki/work/bugs/README.md` **and** `bugs/lifecycle.md` together for close-gate requirements | Requirements belong solely in `bugs/lifecycle.md`; drop the `README.md` read |

**Note on overlap**: TASK-008 (update `/primer` to read `wiki/hot.md` first) also edits `lib/skills/primer/SKILL.md`. Complete this task first — TASK-008 depends on it — to avoid two tasks editing the same file out of order.

## Steps

### 1. Confirm scope from TASK-001  <!-- agent: general-purpose -->

- [x] Read TASK-001's `## Audit Findings` section (`wiki/work/tasks/TASK-001-audit-skill-readme-drift.md`); reconcile against the preliminary table above — add/remove skills as needed

### 2. Fix each confirmed-drifting skill  <!-- agent: general-purpose -->

- [x] For each skill in the reconciled list, `Read` the current file, then `Edit` every drifting reference per its fix direction above (or per TASK-001's findings if they differ)
- [x] For `task-audit` and `tackle`'s design trade-offs (Dependency Graph placement; no-args survey columns), make a call and note the reasoning in the edit, or surface the question to the user if genuinely ambiguous

### 3. Verify  <!-- agent: general-purpose -->

- [x] Re-run `mcp__serena__search_for_pattern` for `README\.md` across `lib/skills/` scoped to `wiki/work/` context — confirm no remaining family-index drift (excluding legitimate root-README / external-README / non-wiki-family hits already identified as out-of-scope in TASK-001)
- [x] Spot-check one fixed skill end-to-end (e.g. run `/roadmap-next` on this same roadmap after the fix) to confirm it reads `index.md` correctly

## Notes

Do not touch `lib/prompts/migrate-wiki.md` — its `README.md`/`completed/` references describe the pre-migration `.docs/` structure intentionally and are not drift.
