---
topic: "Obsidian and how it's used in this repo as the basis for wiki linking, including the named relations like relates_to:: — and whether that actually uses a plugin"
slug: obsidian-wiki-linking
researched: 2026-08-13
---

# Primary Sources — Obsidian and Typed Wiki Linking

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `raw/llm-wiki.md` (Namespace "LLM Wiki", full body) | 2026-08-13 | Confirms Obsidian's role is the human-side viewer only ("Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase"), names Dataview/Web Clipper/graph view/Marp, and states the wiki must remain "just a git repo of markdown files" |
| S2 | codebase | `wiki/conventions.md` (Namespace "Wiki Conventions", §3 "Typed links") | 2026-08-13 | The `rel::[[target]]` syntax, its fixed vocabulary, and its "declared now, not backfilled" status |
| S3 | codebase | `search_for_pattern` across the repo for `​```dataview` | 2026-08-13 | Confirms zero Dataview query blocks exist anywhere in the repo today — the convention is currently unexecuted |
| S4 | codebase | `wiki/knowledge/entities/tools/claude-obsidian.md`, `wiki/knowledge/concepts/wiki-multi-writer-safety.md`, `wiki/knowledge/entities/people/andrej-karpathy.md` | 2026-08-13 | Confirms `rel::[[target]]` is already in live use (`uses::`, `derived_from::`, `implements::`) and that a `claude-obsidian` entity page exists but no plain "Obsidian" page does |
| S5 | web | https://obsidian.md/help/links | 2026-08-13 | Official Obsidian docs confirm core wikilinks are untyped structural connections; only display text is customizable, not semantics |
| S6 | web | https://blacksmithgu.github.io/obsidian-dataview/ | 2026-08-13 | Dataview's own docs: inline fields via `key:: value` syntax "everywhere in your file," queryable via DQL/inline/JS queries into dynamic tables and lists |
| S7 | web | https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/ | 2026-08-13 | Confirms inline-field syntax and that YAML frontmatter fields are automatically available as Dataview fields too |
| S8 | web | https://deepwiki.com/blacksmithgu/obsidian-dataview/6.3-inline-fields | 2026-08-13 | Structural/source-level confirmation of the "full-line field" parsing rule: a line consisting entirely of `key:: value` is parsed as one metadata field — exactly this repo's `rel::[[target]]` pattern |
| S9 | web | https://community.obsidian.md/plugins/graph-link-types (and https://github.com/natefrisch01/Graph-Link-Types) | 2026-08-13 | Graph Link Types plugin: reads Dataview-indexed fields and renders them as labeled/colored edges in Obsidian's native graph view; example given is `related:: [[Note]]` rendering "related" on the edge |
| S10 | web | https://community.obsidian.md/plugins/breadcrumbs and https://publish.obsidian.md/breadcrumbs-docs/Edge+Fields | 2026-08-13 | Breadcrumbs plugin: 5 default typed "edge fields" (up/down/same/next/prev), fully renameable, reads frontmatter properties, Dataview inline fields, tags, or naming schemes; derives implied inverse relations automatically |
| S11 | web | https://github.com/penfieldlabs/obsidian-wikilink-types and https://forum.obsidian.md/t/wikilink-types-type-inside-a-wikilink-to-add-relationship-types-auto-synced-to-yaml-frontmatter/112470 | 2026-08-13 | Wikilink Types plugin: `@type` syntax typed inside a wikilink alias, autocompleted from a configurable 24-type default set, auto-synced to YAML frontmatter on save; ships a "Vault Linker" Claude Code skill for AI-proposed relationship discovery |

## Excerpts

### S5 — Obsidian official docs, internal links
https://obsidian.md/help/links
> Obsidian's core wikilink syntax does not support native typing or relationship semantics. Wikilinks are untyped connections... The closest the documentation comes to addressing link customization is through display text: "You can change how a link is displayed by customizing its link text" using the pipe syntax `[[Example|Custom name]]`. However, this only affects how the link *appears*, not its semantic meaning.

### S6 — Dataview plugin docs, home page
https://blacksmithgu.github.io/obsidian-dataview/
> Some of your content, like tags and bullet points (including tasks), are available automatically in Dataview. You can add other data through fields, either on top of your file per YAML Frontmatter or in the middle of your content with Inline Fields via the `[key:: value]` syntax.

### S7 — Dataview plugin docs, Adding Metadata
https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/
> For those wanting a more natural-looking annotation, Dataview supports "inline" fields via a `Key:: Value` syntax that you can use everywhere in your file... It is natively supported by Obsidian and explained in its official documentation. All YAML Frontmatter fields will be automatically available as Dataview fields.

### S8 — DeepWiki structural analysis of Dataview's inline-field parser
https://deepwiki.com/blacksmithgu/obsidian-dataview/6.3-inline-fields
> When a line consists entirely of a key-value pair with the `::` separator, it's interpreted as a full-line field... Storage: Fields are stored in the page's metadata as a map of keys to literals.

### S9 — Graph Link Types plugin
https://github.com/natefrisch01/Graph-Link-Types
> Graph Link Types is a plugin for Obsidian.md that enhances the graph-view by rendering link types dynamically. This plugin leverages the Dataview API and PIXI.js... Then, simply add metadata with internal links to your notes using Dataview's syntax. Graph Link Types will render these links as text in the graph view... GraphLinkTypes will display "related" on the link in the graph view.

### S10 — Breadcrumbs plugin
https://community.obsidian.md/plugins/breadcrumbs
> Breadcrumbs lets you add typed links to your notes — up/down, next/prev, or any relationship you define — and builds them into a directed graph. Where Obsidian's own graph only shows that two notes link, Breadcrumbs shows how they relate: which note is the parent, which comes next, which belongs to which... You're not limited to one convention — Breadcrumbs reads structure from whatever you already use: Frontmatter properties (typed links), tags, and Markdown lists.

https://publish.obsidian.md/breadcrumbs-docs/Edge+Fields
> By default, there will be 5 starting fields: up, same, down, next, and prev, representing 5 different directions... you can customise them further... For example, you can model personal relationships using fields like parent, child, and sibling.

### S11 — Wikilink Types plugin
https://community.obsidian.md/plugins/wikilink-types
> Type @ inside wikilink aliases to add relationship types, auto-synced to YAML frontmatter... so Dataview, Graph Link Types, Breadcrumbs, and the rest of the ecosystem can consume it without changes.

https://forum.obsidian.md/t/wikilink-types-type-inside-a-wikilink-to-add-relationship-types-auto-synced-to-yaml-frontmatter/112470
> Obsidian is incredible for connecting notes, but a link only tells you that two notes are connected, not how. "This supersedes that." "This contradicts that." "This was caused by that." That context lives in your head, not in your vault.

https://github.com/penfieldlabs/obsidian-wikilink-types (fetched excerpt)
> The Vault Linker AI skill allows AI agents to analyze vaults and autonomously discover relationships between notes, proposing them in Wikilink Types format for user approval.
