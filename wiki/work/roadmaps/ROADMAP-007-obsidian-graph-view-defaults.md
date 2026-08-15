---
id: ROADMAP-007
title: Obsidian Graph View Defaults & Dataview Query Examples
status: active
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

Ship a default `.obsidian/graph.json` template (wired into `install-obsidian.sh`, write-if-absent) — `colorGroups` keyed to `wiki/knowledge`, `wiki/work/*`, and `raw/`, plus a top-level `"search": "path:wiki"` filter so the graph view defaults to showing the wiki subtree — so every new project's graph view arrives pre-scoped and pre-styled with zero manual configuration. Also author 2-3 example Dataview query blocks in the wiki's family `index.md` templates. End state: both of the research report's Next Steps are actually implemented, not just recommended.

Derived from [raw/research/obsidian-graph-defaults/index.md](../../../raw/research/obsidian-graph-defaults/index.md) and its wiki summary at [wiki/knowledge/sources/obsidian-graph-defaults.md](../../knowledge/sources/obsidian-graph-defaults.md).

## Phase 1: Graph View Defaults

- [ ] Ship a default `.obsidian/graph.json` template into `install-obsidian.sh` — `colorGroups` keyed to `wiki/knowledge`, `wiki/work/*`, `raw/`, plus a `"search": "path:wiki"` default filter; write-if-absent, gated by a sticky preference

## Phase 2: Dataview Query Authoring

- [ ] Author 2-3 example Dataview query blocks in `wiki/work/*/index.md` templates (e.g. a `TABLE status FROM` query for a family index)

## Notes

