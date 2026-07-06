---
id: claude-obsidian
title: claude-obsidian
aliases: [AgriciDaniel/claude-obsidian]
updated: 2026-07-06
sources:
  - ../../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../../raw/research/wiki-tooling-improvements/sources.md
tags: [second-brain, llm-wiki, obsidian]
---

MIT-licensed, productized reimplementation of `derived_from::[[Andrej Karpathy]]`'s LLM Wiki pattern for Obsidian + Claude Code (`github.com/AgriciDaniel/claude-obsidian`, 358+ GitHub stars). Ships 15 Claude Code skills, multi-agent support, methodology modes (LYT/PARA/Zettelkasten/Generic), and a "10-principle thinking framework."

Two features directly relevant to this repo's own wiki design, both absent from this repo's current implementation:

- **Hot cache** (`wiki/hot.md`, `relates_to::[[LLM Wiki Hot Cache]]`): a compact (~500-word) session summary — Last Updated, Key Recent Facts, Recent Changes, Active Threads — regenerated at the end of every session and read first at the start of the next one.
- **Per-file advisory locking** (`scripts/wiki-lock.sh`, added in v1.7, `relates_to::[[Wiki Multi-Writer Safety]]`): parallel ingest sub-agents acquire a lock before writing, closing what the changelog calls "a latent multi-writer corruption hole."

v1.7 "Compound Vault" also added hybrid retrieval (contextual prefix + BM25 + cosine rerank, following Anthropic's Sept 2024 contextual retrieval research) as an alternative to plain index-based lookup once a vault grows large.
