---
id: obsidian-wiki-linking
title: Obsidian and Typed Wiki Linking
updated: 2026-08-13
sources:
  - ../../../raw/research/obsidian-wiki-linking/index.md
  - ../../../raw/research/obsidian-wiki-linking/sources.md
confidence: extracted
tags: [obsidian, dataview, wiki-conventions, typed-links]
---

Research answering: does this repo's `rel::[[target]]` typed-link convention (`wiki/conventions.md` §3) actually rely on an Obsidian plugin, or is it a bespoke invention? **It is neither purely bespoke nor currently plugin-dependent.** `relates_to::[[obsidian]]`'s native `[[wikilink]]` syntax is untyped by design — confirmed against Obsidian's own docs, the only built-in customization is display text (`[[Page|Alias]]`), which changes appearance, not meaning. The `rel::[[target]]` pattern this repo uses instead turns out to be **exactly `uses::[[dataview]]`'s "full-line inline field" syntax** (`key:: value` on its own line), independently arrived at rather than copied — see `uses::[[typed-wiki-links]]` for the full breakdown.

Crucially, **this repo currently consumes zero plugins for it.** An exhaustive search found no `​```dataview` query blocks anywhere in the vault, so today the convention is a human/LLM-readable annotation only — it renders as plain markdown plus a clickable link with or without Dataview installed, and nothing queries, filters, or visualizes by relation type yet. Two mature plugins build directly on Dataview's index if that payoff is ever wanted: `relates_to::[[graph-link-types]]` (colors/labels graph-view edges by relation type) and `relates_to::[[breadcrumbs-plugin]]` (hierarchical/associative trail + tree/matrix navigation with auto-implied inverse relations). Both would consume the existing syntax with zero authoring changes. A fifth tool, `relates_to::[[wikilink-types-plugin]]`, solves the identical problem (near-identical pitch: "a link only tells you two notes are connected, not how") but through an incompatible `@type`-in-alias mechanic, and ships an AI-agent "Vault Linker" skill worth noting as prior art for LLM-proposed relationship discovery — a pattern this repo's `/wiki-lint` could grow toward.

**Recommendation from the source research:** no change is required for correctness — the design is sound as-is, consistent with `raw/llm-wiki.md`'s "just a git repo of markdown files" goal. If the querying/visualization payoff is ever wanted, Dataview alone is the lowest-friction next step since it requires no changes to any existing page.
