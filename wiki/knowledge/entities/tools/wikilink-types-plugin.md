---
id: wikilink-types-plugin
title: Wikilink Types (Obsidian plugin)
aliases: [penfieldlabs/obsidian-wikilink-types]
updated: 2026-08-13
sources:
  - ../../../../raw/research/obsidian-wiki-linking/index.md
  - ../../../../raw/research/obsidian-wiki-linking/sources.md
confidence: extracted
tags: [obsidian, typed-links, ai-agent, vault-linker]
---

Wikilink Types (`penfieldlabs/obsidian-wikilink-types`) is a newer `relates_to::[[obsidian]]` plugin targeting the same problem this repo's own typed-link convention exists to solve, with a notably similar pitch: "a link only tells you that two notes are connected, not how. 'This supersedes that.' 'This contradicts that.' 'This was caused by that.'" — near-verbatim the motivation behind `wiki/conventions.md` §3.

**Mechanically it differs entirely from the Dataview-inline-field approach.** Instead of a `rel::[[target]]` full-line field, the author types `@` *inside a wikilink's alias* (e.g. `[[Analysis|The new research @supersedes and @contradicts the previous analysis]]`), picks a relationship type from an autocomplete populated from a configurable default set (24 types, stored in `data.json`), and the plugin auto-writes the resulting relationship into YAML frontmatter on save — explicitly so "users never manually edit YAML."

It ships a **"Vault Linker" Claude Code skill** designed for an AI agent to read a vault and *propose* typed relationships for user approval — the same "LLM proposes, human curates" loop this repo's own `/wiki-lint` and `/wiki-query` skills already implement, just targeting a different plugin's storage format.

**Not directly compatible with this repo's existing convention.** `contradicts::[[typed-wiki-links]]`-style full-line Dataview fields and Wikilink Types' `@type`-in-alias/frontmatter-sync mechanic are two different storage formats; adopting this plugin would require migrating existing `rel::[[target]]` links rather than layering on top of them (unlike `relates_to::[[dataview]]`, `relates_to::[[graph-link-types]]`, and `relates_to::[[breadcrumbs-plugin]]`, which all consume the existing syntax unmodified). Worth revisiting as prior art if this repo ever wants AI-agent-*proposed* linking, but not a drop-in fit today.
