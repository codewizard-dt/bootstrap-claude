---
id: TASK-002
title: "Audit lifecycle.md files and skill templates for stale wiki/work/<family>/completed references"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: []
parallel_safe_with: [TASK-001]
uat: "[[UAT-002]]"
tags: [wiki-tooling, audit]
---

# TASK-002 — Audit lifecycle.md files and skill templates for stale `completed/` references

## Objective

Confirm no `lifecycle.md` file (in `wiki/work/*/lifecycle.md`) or skill/template file (in `lib/skills/`, `lib/scripts/templates/wiki/`) still references the old `wiki/work/<family>/completed/` subdirectory convention that predates the current rule: active files never move, and terminal items may be moved to `wiki/work/<family>/archive/` by `/wiki-archive`.

## Approach

A preliminary sweep already ran three targeted searches and found **zero drift**:
- `completed/` across `lib/skills/` — 3 hits, all correctly stating the *absence* of a `completed/` subdir (`decision-next`, `task-add`, `uat-walk/UAT-CORE.md`)
- `completed/` across `lib/scripts/templates/wiki/` — 1 hit, generic English ("completed/terminal items drop off the list"), not a stale path
- `completed` across every `wiki/work/*/lifecycle.md` — 0 hits
- `/completed` across all of `lib/` (excluding `lib/prompts/migrate-wiki.md`, which intentionally documents the *old* pre-migration `.docs/tasks/completed/` paths as part of its old→new mapping table — that's expected, not drift) — 0 hits

This task exists to have a human/agent independently re-verify that conclusion rather than take one grep pass on faith, and to close out the roadmap item formally.

## Steps

### 1. Re-verify the clean result  <!-- agent: general-purpose -->

- [x] Re-run `mcp__serena__search_for_pattern` for `completed` across all 6 `wiki/work/*/lifecycle.md` files — expect 0 hits
- [x] Re-run for `completed/` across `lib/skills/**` and `lib/scripts/templates/wiki/**` — expect only the known-good hits listed above (correctly stating no `completed/` dir exists, or generic prose)
- [x] Explicitly re-confirm `lib/prompts/migrate-wiki.md`'s `completed/` mentions are scoped to the *old* `.docs/` structure being migrated from, not a live reference to `wiki/work/`

### 2. Record the result  <!-- agent: general-purpose -->

- [x] If still clean: append a `## Audit Findings` section below stating "No drift found — all `completed/` references in `lib/` either correctly describe the absence of that subdirectory or belong to the historical `.docs/` migration mapping." Set `status: done`.
- [ ] If any new drift is found (e.g. a skill added since 2026-07-06 that reintroduces the old convention): list the file + line + fix needed instead, and leave `status: todo` for a follow-up fix (do not fix it in this task — audit-only, matching TASK-001's scope split with TASK-003)

## Audit Findings

**No drift found** — all `completed/` references in `lib/` either correctly describe the absence of that subdirectory or belong to the historical `.docs/` migration mapping.

Re-verified 2026-07-06 via independent `mcp__serena__search_for_pattern` runs:

- **`completed` across all `wiki/work/*/lifecycle.md`** — 0 hits.
- **`completed/` across `lib/skills/**`** — 3 hits, all correctly asserting the *absence* of a `completed/` subdir:
  - `lib/skills/decision-next/SKILL.md:128` — "There is no `completed/` subdirectory and no `git mv`…"
  - `lib/skills/task-add/SKILL.md:61` — "Do **not** look in completed/ or trashed/ subdirectories — files never move…"
  - `lib/skills/uat-walk/UAT-CORE.md:22` — "files never move — no `completed/` subdir…"
- **`completed/` across `lib/scripts/templates/wiki/**`** — 1 hit, generic prose:
  - `lib/scripts/templates/wiki/index.md:38` — "completed/terminal items drop off the list" (describes list behavior, not a path).
- **`/completed` across all of `lib/`** — every hit is confined to `lib/prompts/migrate-wiki.md` (lines 31, 34, 38, 45, 61, 78), all scoped to the *old* pre-migration `.docs/` structure in the old→new mapping table; none reference a live `wiki/work/<family>/completed/` path. Confirmed expected, not drift.
