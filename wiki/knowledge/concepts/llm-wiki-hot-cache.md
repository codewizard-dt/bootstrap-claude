---
id: llm-wiki-hot-cache
title: LLM Wiki Hot Cache
aliases: [hot cache, session-handoff cache, L1/L2 cache architecture]
updated: 2026-07-06
sources:
  - ../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../raw/research/wiki-tooling-improvements/sources.md
tags: [wiki-tooling, memory, session-handoff]
---

A small, always-read-first file that summarizes "what changed last session," so an LLM wiki maintainer doesn't rebuild context from scratch (or scan the full append-only log) at the start of every session. Independently converged on by at least two separate reimplementations of `derived_from::[[Andrej Karpathy]]`'s LLM Wiki gist:

- `uses::[[claude-obsidian]]` calls it `wiki/hot.md` — regenerated at the end of every session with sections for Last Updated, Key Recent Facts, Recent Changes (Created/Updated/Flagged), and Active Threads, capped around ~500 words.
- `MehmetGoekce/llm-wiki` frames the same idea as an "L1/L2 cache architecture": auto-loaded rules/recent-context in memory (L1) vs. the deep wiki content itself (L2), explicitly calling this "the key insight Karpathy's gist does not mention."

This pattern is structurally analogous to `uses::[[Claude Code Auto Memory]]`'s own compaction-survival design (small, disk-backed, always re-injected) — a hot cache is essentially a hand-rolled version of the same idea, scoped to wiki-domain state rather than user-behavior state.

**Status in this repo**: not yet implemented. `wiki/log.md` is chronological and append-only but not designed to be read as a compact summary — resuming work requires scanning it. The `/primer` skill exists specifically to "refresh codebase context via Serena memories" and is the natural place to also read a hot-cache file first, once one exists. Recommended as a no-regret, zero-dependency addition (see `contradicts::` none — this is additive to existing skills, not a replacement).
