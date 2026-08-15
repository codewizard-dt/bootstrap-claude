---
id: obsidian-graph-view-styling
title: Obsidian Graph View Styling (native colorGroups vs. plugins)
updated: 2026-08-15
sources:
  - ../../../raw/research/obsidian-graph-defaults/index.md
  - ../../../raw/research/obsidian-graph-defaults/sources.md
confidence: extracted
tags: [obsidian, graph-view, defaults, configuration]
---

Obsidian's graph view color grouping (Settings → Graph → Groups, or direct edits to `.obsidian/graph.json`) is a **native feature — zero plugin dependency**. The file is plain, hand-editable JSON: a `colorGroups` array of `{"query": "<search string>", "color": {"a": 1, "rgb": <int>}}` entries, alongside layout keys (`repelStrength`, `linkStrength`, `linkDistance`, `centerStrength`, `scale`, etc.) that control the force-directed physics. The `query` field uses Obsidian's ordinary search grammar — `path:wiki/knowledge` (folder-based), `tag:#cool` (tag-based), `file:journal` (filename-based), combinable with boolean `OR`/`AND` — the same syntax used in the vault-wide search box. A group is added through the in-app Groups panel, or by editing `graph.json` directly and reopening the vault; a user's own automation script (read `json.loads`, append to `colorGroups`, `json.dumps` back out) confirms Obsidian simply re-reads the file.

Three sibling config files handle other layers: `app.json` (core editor/file behavior), `appearance.json` (theme, CSS snippets enabled, font), and `workspace.json` (pane/sidebar layout — auto-rewritten by Obsidian constantly; "manual editing is rarely needed"). Of the four, `graph.json` and `appearance.json` are realistic template-shipping candidates; `workspace.json` is runtime state that resists templating.

**Two ways to get a styled graph, with different tradeoffs:**
- **Hand-authored `colorGroups` template** — precise when the vault's folder/tag taxonomy is *known in advance* (this repo's wiki scaffold is identical across every project it creates: `wiki/knowledge/*`, `wiki/work/*`, `raw/`). Zero new dependency; needs manual maintenance if the taxonomy changes.
- **Auto-detecting plugins** (`relates_to::[[graph-styler]]`, `relates_to::[[auto-tag-graph-colors]]`) — inspect the vault at runtime and assign colors to whatever folders/tags actually exist, no template authoring required, but add a community-plugin trust decision and are less precise for a taxonomy that's already known.

`derived_from::[[obsidian-graph-defaults]]` recommends the first approach for `uses::[[obsidian]]`'s own known wiki taxonomy, ship as a write-if-absent default via `derived_from::[[bootstrap-guarded-install-pattern]]`'s existing mechanism (`lib/scripts/install-obsidian.sh`), and treats the plugins as optional follow-on opt-ins layered on top — complementary to (not competing with) `uses::[[graph-link-types]]`, which colors/labels *edges* by relation type rather than *nodes* by folder/tag.
