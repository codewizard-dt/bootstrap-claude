---
id: graph-styler
title: Graph Styler
aliases: [moonweave/obsidian-graph-styler]
updated: 2026-08-15
sources:
  - ../../../../raw/research/obsidian-graph-defaults/index.md
  - ../../../../raw/research/obsidian-graph-defaults/sources.md
confidence: extracted
tags: [obsidian, graph-view, visualization, plugin]
---

Graph Styler (`moonweave/obsidian-graph-styler`, MIT) is a `relates_to::[[obsidian]]` community plugin that applies one-click aesthetic presets (color palette, glow, force/size values) to the graph view. Unlike a hand-authored template, it **auto-detects vault structure at runtime**: "it finds your most-used folders and assigns the preset's palette to them (up to 4). No folders? It falls back to your most-used tags." It writes its result into Obsidian's own native `.obsidian/graph.json` `colorGroups` (so the result stays inspectable/editable via the normal Groups panel afterward) plus a CSS glow snippet into `.obsidian/snippets/`, and explicitly backs up the original `graph.json` before writing.

Relevant to `derived_from::[[obsidian-graph-defaults]]`: this plugin solves a problem this repo's own wiki doesn't have — its folder taxonomy (`wiki/knowledge/*`, `wiki/work/*`, `raw/`) is fixed and known in advance by `sync-wiki-scaffold.sh`, so a hand-authored `colorGroups` template is more precise than Graph Styler's heuristic detection for that specific structure. It remains a reasonable optional opt-in (behind the same consent gate as `uses::[[dataview]]`/`uses::[[graph-link-types]]`/`uses::[[breadcrumbs-plugin]]` in `lib/scripts/install-obsidian.sh`) for styling content a user adds beyond the wiki scaffold, or for users who want the glow/aesthetic layer a plain template doesn't provide. Not currently adopted in this repo.
