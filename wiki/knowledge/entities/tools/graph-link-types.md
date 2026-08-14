---
id: graph-link-types
title: Graph Link Types
aliases: [natefrisch01/Graph-Link-Types]
updated: 2026-08-13
sources:
  - ../../../../raw/research/obsidian-wiki-linking/index.md
  - ../../../../raw/research/obsidian-wiki-linking/sources.md
confidence: extracted
tags: [obsidian, dataview, graph-view, visualization]
---

Graph Link Types (`natefrisch01/Graph-Link-Types`) is an `relates_to::[[obsidian]]` plugin that enhances Obsidian's native graph view by rendering link types as labeled, colored edges. It `depends_on::[[dataview]]` — it reads Dataview-indexed inline fields (the plugin's own example: writing `related:: [[Note]]` makes the graph view display the word "related" directly on that edge).

Because it consumes Dataview's index rather than a bespoke syntax, it would make this repo's `implements::`/`supersedes::`/`contradicts::` vocabulary (see `uses::[[typed-wiki-links]]`) visually distinguishable in graph view with **zero change to how pages are authored** — a pure consumer of the syntax already in place. Tradeoff noted in the source research: graph view can get visually busy once ~10 relation types are all rendered as distinct edge labels/colors simultaneously. Not currently adopted in this repo; no evidence yet that the vocabulary's visual legibility in graph view is a felt need.

**Automated install (`derived_from::[[obsidian-setup-automation]]`).** Same headless mechanism as Dataview — `manifest.json`/`main.js`/`styles.css` fetched from `natefrisch01/Graph-Link-Types`'s GitHub Releases API and dropped into `.obsidian/plugins/<manifest-id>/`, enabled via `community-plugins.json`. **This plugin is exactly the skill that "improves for free":** `/wiki-lint` and `raw/llm-wiki.md`'s existing graph-view guidance already tell a human to eyeball the graph for hubs/orphans — installing this plugin makes every `rel::[[target]]` edge already written by `/wiki-ingest`/`/wiki-lint` show its relation label on that same graph, with no skill-file edit required. By contrast, `/task-audit`'s dependency graph would **not** benefit automatically, since it parses a bespoke `> **Depends on**: [...]` blockquote rather than `depends_on::[[TASK-NNN]]` inline fields — a separate reconciliation task, not a side effect of installing this plugin.
