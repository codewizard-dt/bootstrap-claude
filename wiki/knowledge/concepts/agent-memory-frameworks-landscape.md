---
id: agent-memory-frameworks-landscape
title: Agent Memory Frameworks Landscape
aliases: [Mem0, Zep, Graphiti, Letta, MemGPT, A-Mem]
updated: 2026-07-06
sources:
  - ../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../raw/research/wiki-tooling-improvements/sources.md
tags: [agent-memory, mem0, zep, letta, a-mem]
---

Survey of the 2025–2026 wave of dedicated agent-memory frameworks, evaluated against this repo's markdown-only LLM Wiki approach.

- **Mem0** — managed vector-based memory layer, "integrate memory in three lines of code," AWS Agent SDK's default memory provider (186M API calls in Q3 2025), $24M raised. Optional graph layer (Mem0g) added then removed from the OSS v3 rewrite (still offered on the hosted Platform).
- **Zep / Graphiti** — temporal knowledge graph built on Neo4j; tracks fact-validity windows ("what was true when"); leads on temporal-reasoning benchmarks (LongMemEval) but at higher latency/cost than vector-only approaches.
- **Letta (formerly MemGPT)** — OS-inspired tiered memory (core/recall/archival) the agent self-manages via tools; the agent-as-operating-system metaphor from the original MemGPT paper.
- **`uses::[[Hindsight]]`** — targets cross-subagent shared memory specifically for coding-agent harnesses like Claude Code.
- **A-MEM** (arXiv 2502.12110) — Zettelkasten-inspired dynamic memory: atomic "memory notes" with LLM-driven linking and "memory evolution" (existing notes update when new ones are linked). This is the academic root of the "A-Mem-style link discovery" already name-checked as a future overlay in this repo's own `wiki/conventions.md`.

**Key counter-evidence against defaulting to any of these**: Letta's own August 2025 benchmark found a plain-filesystem agent (conversation transcripts dumped into files, no vector/graph layer) scored 74.0% on the LOCOMO recall benchmark, beating Mem0's graph variant at 68.5% — Letta's own conclusion being that "agents are post-trained to be good at iterative file search, so specialized memory systems add little."

**Implication for this repo**: these frameworks solve episodic/conversational recall at scale — a different problem from this repo's wiki, which is curated, versioned, cross-referenced *domain* knowledge (sources, decisions, tasks). None is recommended as a default dependency; `relates_to::[[Wiki Multi-Writer Safety]]` notes Hindsight specifically as a documented option (not a default) for the one concrete gap — cross-subagent memory sharing — that this landscape actually addresses and this repo's architecture doesn't yet solve.
