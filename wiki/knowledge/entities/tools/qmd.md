---
id: qmd
title: qmd
aliases: [tobi/qmd]
updated: 2026-07-06
sources:
  - ../../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../../raw/research/wiki-tooling-improvements/sources.md
tags: [search, wiki-tooling]
---

Local CLI search engine for markdown knowledge bases (`github.com/tobi/qmd`), combining BM25 full-text search, vector semantic search, and local LLM re-ranking — all running on-device via `node-llama-cpp`. Ships both a CLI and an MCP server interface.

Named explicitly in `derived_from::[[Andrej Karpathy]]`'s original gist (and copied into this repo's `raw/llm-wiki.md`) as the recommended search layer "once your wiki grows past a few hundred pages." Confirmed (as of 2026-07) still actively maintained and, if anything, more capable than at the gist's writing — community write-ups report it "cuts token usage by 95%+" by retrieving relevant snippets instead of loading whole files into context.

**Status for this repo**: correctly deferred. This repo's `wiki/` is currently empty — the index-file-as-search approach the gist describes as sufficient "at moderate scale (~100 sources, ~hundreds of pages)" has not yet been stress-tested here. Revisit if/when a synced project's wiki grows large enough that `/wiki-query` reading the full index becomes slow or imprecise.
