---
id: alias-linker
title: Alias Linker
aliases: [johannrichard/alias-linker]
updated: 2026-08-15
sources:
  - ../../../../raw/research/obsidian-alias-link-resolution/index.md
  - ../../../../raw/research/obsidian-alias-link-resolution/sources.md
confidence: extracted
tags: [obsidian, wikilinks, aliases, plugin]
---

Alias Linker (`johannrichard/alias-linker`, plugin id `alias-linker`, self-described "experimental") is a `relates_to::[[obsidian]]` community plugin that extends Obsidian's link-lookup step with an alias fallback: Obsidian tries its normal filename resolution first, and only if that fails does Alias Linker check whether any note's `aliases:` frontmatter matches the link text. Applied consistently across graph view, backlinks, embeds, and preview link state — not just click-navigation. When multiple notes share an alias, the nearest one (by folder distance from the linking note) wins. Fully reversible: disabling it instantly returns to stock Obsidian behavior.

**Why this repo needs it (`derived_from::[[obsidian-alias-link-resolution]]`).** Obsidian's core wikilink resolver never consults frontmatter at all — not this repo's own `id:` field, and, confirmed by an Obsidian moderator as intentional design (not a bug), not even Obsidian's *native* `aliases:` property either. A bare `[[TASK-009]]` — exactly how every work-item skill in this repo writes cross-references — never resolves unless the file is literally named `TASK-009.md`. Since every work-item file here is named `TASK-NNN-slug.md`, every `[[TASK-NNN]]`/`[[UAT-NNN]]`/`[[BUG-NNNN]]`/`[[DEC-NNNN]]` link across the whole wiki is affected. Alias Linker plus a one-line `aliases: [TASK-NNN]` addition to each work-item's frontmatter fixes every existing and future occurrence at once, with zero changes to any link text.

Moderately maintained (12 releases over ~2 years, latest 1.0.2 released the month before this research), not one of Obsidian's flagship high-download plugins — carries more trust risk than `uses::[[dataview]]`-tier plugins already bundled in this repo's installer, which is why it's judged an opt-in addition to the existing `obsidian.plugins` consent gate rather than silently assumed safe. Not yet installed in this repo.
