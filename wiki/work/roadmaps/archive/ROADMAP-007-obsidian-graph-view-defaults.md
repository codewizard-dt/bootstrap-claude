---
id: ROADMAP-007
title: Obsidian Graph View Defaults & Dataview Query Examples
status: done
created: 2026-08-15
updated: 2026-08-15
owner: David Taylor
derived_from: [raw/research/obsidian-graph-defaults/index.md, ../../knowledge/sources/obsidian-graph-defaults.md]
linked_requirements: []
linked_decisions: []
tags: [obsidian, tooling, graph-view]
---

# Roadmap 007: Obsidian Graph View Defaults & Dataview Query Examples

## Goal

Ship a default `.obsidian/graph.json` template (wired into `install-obsidian.sh`, write-if-absent) — **two complementary color families**: one hue for the `knowledge` domain, with `wiki/knowledge/sources`, `wiki/knowledge/concepts`, and `wiki/knowledge/entities` each a distinct shade of it (similar because they're all knowledge); a complementary hue for the `work` domain, with each of `wiki/work/{tasks,bugs,decisions,roadmaps,requirements,uat}` getting its own distinct shade. `raw/` gets **no** color group — the top-level `"search": "path:wiki"` filter already excludes it from the default graph view, so a color for it would never render. End state: every new project's graph view arrives pre-scoped to the wiki and pre-styled by domain with zero manual configuration, plus 2-3 example Dataview query blocks authored into the wiki's family `index.md` templates. Both of the research report's Next Steps are actually implemented, not just recommended.

Derived from [raw/research/obsidian-graph-defaults/index.md](../../../raw/research/obsidian-graph-defaults/index.md) and its wiki summary at [wiki/knowledge/sources/obsidian-graph-defaults.md](../../knowledge/sources/obsidian-graph-defaults.md).

## Phase 1: Graph View Defaults

- [x] [[TASK-061: Ship a default .obsidian/graph.json template into install-obsidian.sh]]

## Phase 2: Dataview Query Authoring

- [x] ~~Author 2-3 example Dataview query blocks in `wiki/work/*/index.md` templates~~ — already satisfied, see Notes

## Notes

- **2026-08-15**: Phase 1 refined before any task file was created — swapped the original three-group plan (`wiki/knowledge`, `wiki/work/*`, `raw/`) for two complementary color families (knowledge: 3 shades; work: 6 shades) and dropped `raw/`'s color group entirely, since the `"search": "path:wiki"` default filter already excludes it from the graph — a color group for hidden nodes would never render.
- **2026-08-15**: Phase 2 marked done without a task file. Discovered during `/roadmap-next`'s task-creation step that `raw/guides/dataview-queries.md` (shipped earlier by `TASK-056`, part of `ROADMAP-006`) already contains 3 example Dataview query blocks (tasks-by-status, `contradicts::` scan, tools-by-tag) — and its own §3 "Why these stay out of the committed wiki" explicitly argues against embedding query blocks in committed `index.md` files, since the raw ` ```dataview ` fence renders as inert text for any non-Obsidian reader (GitHub preview, plain markdown viewers, teammates without the plugin). The original research's Next Steps recommendation (which seeded this roadmap) missed this guide's existence — Phase 2 as scoped would have contradicted an already-deliberate design decision. No new task created; the underlying need was already met.
