---
id: andrej-karpathy
title: Andrej Karpathy
aliases: [Karpathy]
updated: 2026-07-06
sources:
  - ../../../../raw/research/wiki-tooling-improvements/index.md
tags: [llm-wiki, pattern-author]
---

Co-founder of OpenAI and former Tesla AI director. Published the **LLM Wiki** gist (`gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`) on 2026-04-04, describing a pattern where an LLM agent incrementally builds and maintains a persistent, structured markdown wiki — sources, entity pages, concept pages, cross-references, contradictions — instead of re-deriving synthesis from raw documents via RAG on every query.

This repo's `raw/llm-wiki.md` is a direct copy of this gist, and `implements::[[wiki-tooling-improvements|the wiki tooling improvements research]]` traces at least three independent public reimplementations of the pattern (`uses::[[claude-obsidian]]`, `ar9av/obsidian-wiki`, `MehmetGoekce/llm-wiki`) that emerged in the ~3 months after publication, each converging independently on the same missing pieces (session-handoff caching, provenance tagging, multi-writer safety).
