---
id: front-matter-title
title: Front Matter Title
aliases: [obsidian-front-matter-title-plugin, snezhig/obsidian-front-matter-title]
updated: 2026-08-15
sources:
  - ../../../../raw/research/obsidian-graph-defaults/index.md
confidence: inferred
tags: [obsidian, graph-view, frontmatter, plugin]
---

Front Matter Title (`snezhig/obsidian-front-matter-title`, plugin id `obsidian-front-matter-title-plugin`) is a `relates_to::[[obsidian]]` community plugin that displays a note's frontmatter `title` field in place of its bare filename — across the file explorer, tabs, search, and, the reason it's relevant here, the **graph view**. It reads (never renames) the file, so filenames on disk are untouched.

**Why this repo needs it.** Every `index.md` across `wiki/knowledge/` and `wiki/work/*` is literally named `index.md`, and Obsidian's core graph view labels nodes by filename, not frontmatter — so all 13 index pages (6 active family indexes, 6 archive indexes, plus `wiki/index.md`) show as indistinguishable "index" nodes today, even though every one already carries a distinct `title:` frontmatter field (e.g. "Tasks Index", "Bugs Archive"). This plugin is the mechanism that actually makes those existing `title:` values render anywhere.

**Not enabled by default — a one-time manual step is required.** The plugin's own per-surface toggles (Graph, Explorer, Tabs, etc.) all default OFF inside its settings; its own documentation walks users through manually enabling "the Explorer feature" as an example. Its internal `data.json` settings schema is undocumented and unversioned, so `derived_from::[[obsidian-graph-defaults]]`'s implementation deliberately does not attempt to script it — doing so would risk the same class of silent-failure bug as BUG-0011 (a plugin installed and enabled, but missing a file it needs to actually work). `install-obsidian.sh` installs and enables the plugin like the other three, then prints a one-time note directing the user to Settings → Front Matter Title to turn on "Graph" themselves.

**Bundled alongside `uses::[[dataview]]`, `uses::[[graph-link-types]]`, and `uses::[[breadcrumbs-plugin]]`** under the single `obsidian.plugins` sticky-preference prompt in `lib/scripts/install-obsidian.sh`, for prompt-count simplicity — unlike Graph Link Types and Breadcrumbs, it has no dependency on Dataview (it reads frontmatter directly), so its inclusion in the bundle is a UX choice, not a technical requirement.
