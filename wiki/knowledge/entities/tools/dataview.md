---
id: dataview
title: Dataview
aliases: [obsidian-dataview, blacksmithgu/obsidian-dataview]
updated: 2026-08-13
sources:
  - ../../../../raw/research/obsidian-wiki-linking/index.md
  - ../../../../raw/research/obsidian-wiki-linking/sources.md
confidence: extracted
tags: [obsidian, dataview, typed-links, query]
---

Dataview (`blacksmithgu/obsidian-dataview`) is an `relates_to::[[obsidian]]` plugin that indexes note metadata — YAML frontmatter fields plus **inline fields** written in note content via `key:: value` syntax — and queries it with DQL, inline queries, or JS queries into dynamic tables and lists. `raw/llm-wiki.md` names it directly as generating "dynamic tables and lists" from frontmatter the LLM already writes.

**Its "full-line field" parsing rule is exactly this repo's typed-link convention.** When an entire line consists of nothing but `key:: value`, Dataview parses it as a full-line metadata field, storing the value (which can be a wikilink) in the page's metadata map. This repo's `rel::[[target]]` lines — e.g. `implements::[[REQ-012]]` — are that exact pattern; see `uses::[[typed-wiki-links]]`. Confirmed against Dataview's own docs ("Key:: Value syntax... everywhere in your file") and a source-level breakdown of the plugin's inline-field parser.

**Zero-plugin degradation:** without Dataview installed, `implements::[[REQ-012]]` renders as plain text followed by a normal clickable link — nothing breaks. Querying or filtering by relation type ("show every page that `implements::` REQ-012") requires Dataview to be installed and the field queried via a `​```dataview` block. As of this ingest, **no `​```dataview` query blocks exist anywhere in this repo** — the typed-link vocabulary is written but never queried; Dataview is an available enhancement layer, not a current dependency. `relates_to::[[graph-link-types]]` and `relates_to::[[breadcrumbs-plugin]]` both build visualization/navigation on top of Dataview's index without requiring any change to how links are authored.

**Automated install (`derived_from::[[obsidian-setup-automation]]`).** No running Obsidian instance or GUI is needed — it's a `manifest.json` + `main.js` (+ optional `styles.css`) drop into `<vault>/.obsidian/plugins/<id>/` (the directory name must come from the `id` field inside Dataview's own `manifest.json`, not the `blacksmithgu/obsidian-dataview` repo name) plus an entry in `<vault>/.obsidian/community-plugins.json`, both fetchable from Dataview's GitHub Releases API (`releases/latest`). Since it's a hard prerequisite for `relates_to::[[graph-link-types]]` and `relates_to::[[breadcrumbs-plugin]]`, the proposed `obsidian.plugins` sticky preference bundles all three behind one prompt rather than asking separately.
