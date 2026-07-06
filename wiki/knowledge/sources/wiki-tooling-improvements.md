---
id: wiki-tooling-improvements
title: "Research: Improving the LLM Wiki tooling"
updated: 2026-07-06
sources:
  - ../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../raw/research/wiki-tooling-improvements/sources.md
tags: [wiki-tooling, memory, second-brain]
---

# Research: Improving the LLM Wiki tooling

Research into what has changed in the "second brain" / LLM-wiki ecosystem since `derived_from::[[Andrej Karpathy]]`'s original gist, and what's directly portable to this repo's own `raw/llm-wiki.md` implementation.

**Central finding**: this repo's `wiki/conventions.md` already reserves frontmatter keys (`confidence`, `tier`, `last_verified`, `supersedes`, `superseded_by`, `scope`) explicitly for "confidence scoring, knowledge lifecycle, hybrid search, A-Mem-style link discovery" as future "zero-migration add-ons" — the gap isn't design, it's that no skill or hook populates them yet.

Three independent public reimplementations of the same gist — `uses::[[claude-obsidian]]`, `ar9av/obsidian-wiki`, and `MehmetGoekce/llm-wiki` — converged, without coordinating with each other, on the same three missing pieces:

1. **A session-handoff "hot cache"** (see `relates_to::[[LLM Wiki Hot Cache]]`) — a small always-read-first file summarizing what changed last session, so context isn't rebuilt from scratch every time.
2. **Provenance/confidence tagging** (see `relates_to::[[Wiki Provenance Tagging]]`) — tagging claims as extracted vs. inferred vs. ambiguous, directly activating this repo's already-reserved frontmatter.
3. **Multi-writer safety** (see `relates_to::[[Wiki Multi-Writer Safety]]`) — advisory locking for concurrent agent writes to shared index files, a real risk given this repo's heavy subagent orchestration (`power-mode`, `tackle`).

Separately, **Claude Code itself shipped a first-party memory system** (`uses::[[Claude Code Auto Memory]]`) — cross-project, compaction-surviving, typed (user/feedback/project/reference) — that this repo's wiki schema has no bridging convention for. The risk is silent duplication or contradiction between "what Auto Memory remembers about the user" and "what the wiki knows about the project," since both now coexist in every session.

The research also surveyed dedicated agent-memory frameworks (`relates_to::[[Agent Memory Frameworks Landscape]]` — Mem0, Zep/Graphiti, Letta/MemGPT, `uses::[[Hindsight]]`, A-Mem) and concluded they solve a different problem (episodic/conversational recall at scale) than this repo's wiki (curated, versioned, cross-referenced domain knowledge). Letta's own benchmark — a plain-filesystem agent beating a dedicated graph-memory framework on long-context recall — is direct evidence that markdown-only remains a defensible choice at this repo's current scale, not a compromise.

## Recommendation (from the report)

Adopt now, in order of cost: (1) hot-cache file + (2) a short "Auto Memory vs. wiki" bridging note in `CLAUDE.md` — both zero-dependency documentation/skill changes — then (3) provenance tagging (activates already-reserved frontmatter). Hold multi-writer locking until `power-mode`/`tackle` show concrete concurrent-write corruption, not just theoretical risk. Hold dedicated memory frameworks (Hindsight etc.) as a documented option in `raw/llm-wiki.md`'s "Optional: CLI tools" section, not a default.

See the full report at [raw/research/wiki-tooling-improvements/index.md](../../../raw/research/wiki-tooling-improvements/index.md) and its source register at [sources.md](../../../raw/research/wiki-tooling-improvements/sources.md).
