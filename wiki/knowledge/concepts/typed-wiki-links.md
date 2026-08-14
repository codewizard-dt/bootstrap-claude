---
id: typed-wiki-links
title: Typed Wiki Links
aliases: [rel::[[target]] convention, typed links]
updated: 2026-08-13
sources:
  - ../../../raw/research/obsidian-wiki-linking/index.md
  - ../../../raw/research/obsidian-wiki-linking/sources.md
confidence: extracted
tags: [wiki-conventions, dataview, obsidian, typed-links]
---

`wiki/conventions.md` §3 defines this repo's `rel::[[target]]` typed-link convention (e.g. `implements::[[REQ-012]]`, `supersedes::[[DEC-0003#D2]]`) with a fixed vocabulary: `derived_from`, `supersedes`, `superseded_by`, `implements`, `uses`, `depends_on`, `contradicts`, `relates_to`, `caused`, `fixed`. **This is not a bespoke invention** — it is `uses::[[dataview]]`'s standard "inline field" syntax, specifically the "full-line field" rule: a line consisting entirely of `key:: value` is parsed by Dataview as one metadata field, and the value half can be a wikilink. This repo's own convention independently arrived at exactly that pattern.

**Current status: purely declarative, zero plugin dependency.** `relates_to::[[obsidian]]`'s core wikilinks are untyped by design — a plain `[[link]]` only says two notes are connected, never *how*. Without Dataview installed, a `rel::[[target]]` line simply renders as plain text followed by a normal clickable link; nothing breaks and nothing is required. Confirmed by exhaustive search: **no `​```dataview` query blocks exist anywhere in this repo** as of this ingest, so the vocabulary is currently human/LLM-readable only — grep-able and meaningful to an agent reading the file, but not queried, filtered, or visualized by any tool.

**Optional enhancement layers, addable later with zero authoring changes:** `relates_to::[[dataview]]` (query/filter/table by relation type — the only plugin `raw/llm-wiki.md` itself names, described there as generating "dynamic tables and lists"), `relates_to::[[graph-link-types]]` (labels/colors graph-view edges by relation type), and `relates_to::[[breadcrumbs-plugin]]` (hierarchical/associative trail + tree/matrix navigation, auto-implied inverse relations e.g. `supersedes` → `superseded_by`). All three consume the existing `rel::[[target]]` syntax unmodified. By contrast, `relates_to::[[wikilink-types-plugin]]` solves the identical problem but with an incompatible `@type`-in-alias storage mechanic — adopting it would require migrating existing links rather than layering on top.

**Design rationale:** keeping the convention plugin-free by default matches `raw/llm-wiki.md`'s explicit goal that the wiki remains "just a git repo of markdown files" — any plugin adopted is an enhancement layer on top of syntax that already degrades gracefully, never a hard dependency for `/wiki-*` skills, which read files directly rather than querying Dataview.

**Automating plugin *installation* is a separate, follow-on concern from this convention.** `relates_to::[[obsidian-setup-automation]]` establishes that the app and all three plugins are fully scriptable (native package managers for the app; GitHub Releases API + manifest-id-driven directory naming for the plugins) without touching how any page authors its `rel::[[target]]` lines — the convention itself does not change. That research also draws a sharper line than this page previously did on *which* skills benefit once the plugins are present: `/wiki-lint`'s and `raw/llm-wiki.md`'s graph-view guidance improve for free (relation labels just appear), but `/task-audit` does not, because its dependency block is a bespoke blockquote rather than this convention's inline-field syntax.
