---
id: breadcrumbs-plugin
title: Breadcrumbs (Obsidian plugin)
aliases: [michaelpporter/breadcrumbs, obsidian-breadcrumbs]
updated: 2026-08-13
sources:
  - ../../../../raw/research/obsidian-wiki-linking/index.md
  - ../../../../raw/research/obsidian-wiki-linking/sources.md
confidence: extracted
tags: [obsidian, dataview, hierarchy, navigation]
---

Breadcrumbs (`michaelpporter/breadcrumbs`) is an `relates_to::[[obsidian]]` plugin aimed at hierarchical/associative navigation, heavier than a pure graph-view enhancement. It ships five default typed "edge fields" (`up`, `down`, `same`, `next`, `prev`), each fully renameable/extensible — this repo's own vocabulary (`depends_on`, `supersedes`, …) could become custom edge fields without a rewrite.

It reads structure from **whatever a vault already uses**: frontmatter properties, `depends_on::[[dataview]]`-style inline fields, tags, or naming schemes (Dendron-style, Johnny.Decimal, dates, custom regex) — so it layers directly on top of this repo's existing `rel::[[target]]` lines (see `uses::[[typed-wiki-links]]`) with no authoring change required. It derives *implied inverse relations* automatically (if A is `up` from B, B is `down` from A — directly relevant to this repo's `supersedes`/`superseded_by` pair), and adds a breadcrumb trail plus tree/matrix side panels and Mermaid/Markmap/Canvas export.

**Fit note from the source research:** Breadcrumbs' mental model is hierarchy-first (up/down/next/prev); this repo's vocabulary is mostly associative/flat (`relates_to`, `contradicts`, `caused`, `fixed`), so adopting it would need custom edge-field mapping rather than a drop-in fit. Not currently adopted.

**Automated install (`derived_from::[[obsidian-setup-automation]]`).** Same headless mechanism as the other two plugins — GitHub Releases API fetch of `manifest.json`/`main.js`/`styles.css` into `.obsidian/plugins/<manifest-id>/`, enabled via `community-plugins.json`; no running Obsidian instance needed. **Not an automatic win for `/task-audit`**: Breadcrumbs *could* visualize task dependency graphs live, but only after either `/task-audit`'s Step 2e is changed to also emit `depends_on::[[TASK-NNN]]`/`blocks::[[TASK-NNN]]` inline fields alongside its existing `> **Depends on**: [...]` blockquote, or Breadcrumbs is configured with a custom regex source matching that blockquote directly (Breadcrumbs supports custom naming-scheme sources for exactly this case). Installing the plugin alone does not deliver this — it's flagged as its own follow-on task.
