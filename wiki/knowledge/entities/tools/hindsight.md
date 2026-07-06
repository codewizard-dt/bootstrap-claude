---
id: hindsight
title: Hindsight
aliases: [vectorize-io/hindsight, hindsight-memory]
updated: 2026-07-06
sources:
  - ../../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../../raw/research/wiki-tooling-improvements/sources.md
tags: [agent-memory, subagents]
---

Agent memory framework from Vectorize (`github.com/vectorize-io/hindsight`) targeting a specific gap in `uses::[[Claude Code Auto Memory]]`: per-subagent memory directories are siloed from each other, so one subagent's learnings never reach another. Hindsight gives every subagent — plus the orchestrator — one shared, accumulating memory bank instead of N independent `MEMORY.md` files.

Installed via `claude plugin marketplace add vectorize-io/hindsight` + `claude plugin install hindsight-memory`. Architecture: hooks for automatic recall (on prompt submit) and retain (on session stop), plus an MCP server exposing explicit `agent_knowledge_*` tools, plus a skill for subagent creation backed by its own bank. Reports state-of-the-art results on the LongMemEval benchmark.

**Relevance to this repo**: this repo runs heavy concurrent subagent orchestration (`power-mode`, `tackle`, `now`) that could plausibly benefit from shared cross-subagent memory. However, per `relates_to::[[Agent Memory Frameworks Landscape]]`, the research recommendation is to hold off on adopting Hindsight (or any dedicated memory framework) as a default — document it as an option in `raw/llm-wiki.md`'s "Optional: CLI tools" section instead, and only adopt if `power-mode`/`tackle` show observed (not hypothetical) cross-subagent memory-sharing pain.
