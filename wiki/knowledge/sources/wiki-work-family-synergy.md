---
id: wiki-work-family-synergy
title: "Research: Wiki Structure, Work-Family Lifecycles, and Cross-Family Synergy"
updated: 2026-09-13
sources:
  - ../../../raw/research/wiki-work-family-synergy/index.md
  - ../../../raw/research/wiki-work-family-synergy/sources.md
confidence: extracted
tags: [wiki-conventions, work-families, sdlc, cross-linking]
---

A structural audit of this repo's own wiki — the `knowledge/`/`work/` two-domain split and the six `wiki/work/` family lifecycles (requirements, decisions, roadmaps, tasks, uat, bugs) — looking for where cross-family synergy is missing. **Three family-pairs have no schema-level linking field in either direction**: bug↔task (a real bug file, `BUG-0008`, already uses an undocumented `linked_task:` key that isn't in `bugs/lifecycle.md`'s schema at all), roadmap↔bug (roadmaps have `linked_requirements`/`linked_decisions` but no `linked_bugs`), and requirement↔decision/task (`/req-create`'s own instructions describe index columns that don't exist in the schema, untested since this repo has zero real requirement files). Dependency encoding is also internally inconsistent: `tasks/lifecycle.md` defines dependencies as frontmatter arrays, but the shared parse procedure used by `/roadmap-next` and `/task-audit` scans body headings that sampled real tasks don't contain.

Pipeline automation is thin: only roadmap→task materialization (`/roadmap-next` turning inline items into task files) is truly automatic. Every other cross-family transition is a manual command a human must remember — `/decision-finalize` and `/req-extract-decisions` explicitly print the next command rather than invoking it; `/decision-next` exists solely to catch forgotten decision→task follow-through; `/uat-walk`/`/uat-auto` never offer `implements::[[BUG-NNNN]]`-style `/bug-file` on a failing test; `/bug-close` computes a tag-clustering signal across recent related closes but discards it instead of offering a regression task. `/wiki-lint`'s only cross-family referential check is the UAT↔task bidirectional link (2.4) — nothing validates that `implements::`/`depends_on::`/`fixes::` targets actually resolve.

`relates_to::[[typed-wiki-links]]` is corroborated and extended here: while that page found the `rel::[[target]]` vocabulary densely used inside `knowledge/` (391 matches across 75 files), this research found it is **barely used inside `work/`** — work-family links are almost entirely untyped frontmatter arrays or plain prose wikilinks. `knowledge/` and `work/` do connect, but only when a work item was born from a `/research`→`/wiki-ingest` cycle (`ROADMAP-001`'s `derived_from`, `TASK-075`'s `implements::[[package-install-consent-gating]]`); an ad hoc `/task-add` or `/bug-file` — the documented common case for small work — never checks `knowledge/concepts/` for prior art.

**Critical constraint for any fix**: this repo is the bootstrap template's own source — the six `wiki/work/<family>/lifecycle.md` files here are always-refreshed copies of `lib/scripts/templates/wiki/work/<family>/lifecycle.md`. A schema change made only in the local `wiki/` copy would be silently overwritten by the next `sync-wiki-scaffold.sh` run and never reach downstream projects; it must land in the template source and route through `/decision-create` since it is architecturally significant and ships everywhere.

See `relates_to::[[wiki-work-family-cross-linking-gaps]]` for the full gap catalogue and recommended fixes (tiered: skill affordances → new `/wiki-lint` checks → schema formalization via decision).
