---
id: auto-tag-graph-colors
title: Auto Tag Graph Colors
aliases: [Trisko06/auto-tag-graph-colors]
updated: 2026-08-15
sources:
  - ../../../../raw/research/obsidian-graph-defaults/index.md
  - ../../../../raw/research/obsidian-graph-defaults/sources.md
confidence: extracted
tags: [obsidian, graph-view, visualization, plugin]
---

Auto Tag Graph Colors (`Trisko06/auto-tag-graph-colors`) is a `relates_to::[[obsidian]]` community plugin that automatically assigns a distinct, stable color to every tag present in the vault's graph view — "zero configuration, instant results." It supports smart tag blending, a monochrome mode, and heat-coloring nodes by connection count. It scans the live graph view (a "Scan vault now" command), maintains a collapsible legend per graph pane, and cleanly removes every color group it created if the plugin is disabled, while preserving any manually-added groups.

Relevant to `derived_from::[[obsidian-graph-defaults]]`: this colors nodes **by tag**, an axis orthogonal to (and composable with) a folder-based `colorGroups` template keyed to this repo's `wiki/knowledge` vs `wiki/work/*` vs `raw/` structure — folder color shows which family a page belongs to; tag color would show cross-cutting themes (e.g. `#obsidian`, `#security`) independent of family. Like `relates_to::[[graph-styler]]`, it is judged an optional future opt-in rather than an immediate recommendation, since this repo's tag vocabulary (unlike its folder taxonomy) isn't fixed or known in advance. Not currently adopted in this repo.
