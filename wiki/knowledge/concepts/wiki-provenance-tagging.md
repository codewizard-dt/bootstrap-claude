---
id: wiki-provenance-tagging
title: Wiki Provenance Tagging
aliases: [provenance tracking, confidence tagging]
updated: 2026-07-06
sources:
  - ../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../raw/research/wiki-tooling-improvements/sources.md
tags: [wiki-tooling, confidence, contradiction-detection]
---

Tagging individual claims or whole wiki pages by how directly they're supported by source material, so contradiction/staleness detection has a concrete signal instead of relying purely on an LLM's judgment. The `ar9av/obsidian-wiki` reimplementation of `derived_from::[[Andrej Karpathy]]`'s LLM Wiki pattern tags every claim as `extracted` (default), `^[inferred]` (LLM synthesis), or `^[ambiguous]` (sources disagree), with a `provenance:` frontmatter block summarizing the mix per page — and its wiki-lint equivalent flags pages that drift into mostly speculation.

This is the same instinct as this project's own `/research` skill's Phase 5 rule (mark unsupported claims as *"inference — no primary source"* rather than fabricating a citation) — just formalized as page-level frontmatter instead of an inline note.

**Zero-migration status**: this repo's `wiki/conventions.md` already reserves `confidence`, `tier`, and `last_verified` as frontmatter keys, explicitly described as "populated later by overlays... safe to ignore until then." Activating this pattern requires no schema change — only teaching `/wiki-ingest` to populate the fields and `/wiki-lint` to check them (e.g., flag a newly-ingested page with no `extracted`-tagged claims at all).
