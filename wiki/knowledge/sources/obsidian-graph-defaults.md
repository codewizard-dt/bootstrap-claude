---
id: obsidian-graph-defaults
title: Obsidian Graph View Styling, Productivity Patterns, and Shippable Wiki Defaults
updated: 2026-08-15
sources:
  - ../../../raw/research/obsidian-graph-defaults/index.md
  - ../../../raw/research/obsidian-graph-defaults/sources.md
confidence: extracted
tags: [obsidian, graph-view, productivity, defaults, wiki-conventions]
---

Follow-on research answering: how is Obsidian's graph view actually styled, how do other people/projects use Obsidian productively, and what could this repo's bootstrap scripts ship as **defaults synced into new projects** to make the most of the wiki's own structure? The headline finding: coloring the graph by folder or tag (`.obsidian/graph.json`'s `colorGroups` array) is a **native Obsidian feature requiring zero plugins** — plain JSON, `{"query": "path:wiki/knowledge", "color": {"a":1,"rgb":<int>}}`, using Obsidian's ordinary search syntax (`path:`, `tag:`, `file:`, boolean `OR`). Because this repo's own taxonomy is identical across every project it scaffolds (`wiki/knowledge/{sources,concepts,entities}`, `wiki/work/{tasks,bugs,decisions,roadmaps,requirements,uat}`, `raw/`), a hand-authored `colorGroups` template keyed to those exact paths is strictly more precise than any auto-detecting plugin, and fits `derived_from::[[bootstrap-guarded-install-pattern]]` — `uses::[[obsidian]]`'s existing `lib/scripts/install-obsidian.sh` already writes gated, sticky-preference-controlled files directly into `<project>/.obsidian/`, exactly the mechanism a shipped `graph.json` needs.

**Graph-styling community plugins solve a different problem than this repo has.** `relates_to::[[graph-styler]]` auto-detects a vault's top folders/tags and writes the result into native `graph.json` groups plus a CSS glow snippet; `relates_to::[[auto-tag-graph-colors]]` auto-assigns a stable color per tag with zero configuration. Both are built for vaults whose structure is *unknown in advance* — this repo's wiki structure is known and stable, so a hand-authored template beats either plugin's heuristics for the wiki's own families, while both remain reasonable future opt-ins (behind the same consent gate as `uses::[[dataview]]`/`uses::[[graph-link-types]]`/`uses::[[breadcrumbs-plugin]]`) for content a user adds beyond the wiki scaffold.

**Three other `.obsidian/*.json` files exist with distinct roles** — `app.json` (editor/file-handling behavior), `appearance.json` (theme/CSS snippets), `workspace.json` (pane layout, constantly rewritten by Obsidian itself, "manual editing rarely needed"). Of these, only `graph.json` and `appearance.json` are realistic candidates for a shipped default; `workspace.json` is runtime state that would just get overwritten.

**Broader Obsidian productivity practice (Zettelkasten/PARA/MOC communities) validates a design choice this repo already made**: "Don't create MOCs upfront. Let them emerge naturally... Building MOCs too early creates structure for structure's sake" — this repo's `wiki/index.md` and family `index.md` files already function as lazily-maintained MOCs, updated on every ingest/status-change rather than hand-designed in advance, matching current PKM community consensus rather than needing a design change.
