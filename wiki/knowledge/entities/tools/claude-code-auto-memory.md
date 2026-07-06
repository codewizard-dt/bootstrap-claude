---
id: claude-code-auto-memory
title: Claude Code Auto Memory
aliases: [Auto Memory]
updated: 2026-07-06
sources:
  - ../../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../../raw/research/wiki-tooling-improvements/sources.md
tags: [claude-code, memory]
---

Anthropic's first-party memory feature for Claude Code, distinct from and complementary to this repo's LLM Wiki pattern. Stores typed memory files — `user`, `feedback`, `project`, `reference` — under `~/.claude/projects/<hash>/memory/`, indexed by a `MEMORY.md`, auto-loaded at session start.

**Key architectural property**: Auto Memory (along with `CLAUDE.md` and unscoped rules) is specifically exempted from context compaction — it survives summarization when conversation-arrived context does not. Per-subagent memory directories also exist (`.claude/agent-memory/<name>/MEMORY.md`, first 200 lines / 25KB auto-injected), but each subagent's directory is siloed from every other subagent's — the gap `uses::[[Hindsight]]` targets with a shared memory bank.

**Open gap**: Auto Memory is cross-project and un-versioned (lives outside the git repo); this repo's wiki (`relates_to::[[LLM Wiki Hot Cache]]`) is per-project and git-versioned. No file in this repo currently documents which facts belong in which system, risking silent duplication or contradiction — see the recommendation in `wiki-tooling-improvements` to add a short bridging note to `CLAUDE.md`.
