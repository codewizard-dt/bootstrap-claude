---
id: now-skill
title: Now Skill
aliases: [now, /now]
updated: 2026-09-13
sources:
  - ../../../../raw/research/ai-agent-architecture-observability/index.md
confidence: extracted
tags: [orchestration, skill, agent-team]
---

`lib/skills/now/SKILL.md` is this repository's lightweight orchestrator: given a task description, it recalls relevant Serena memories, optionally runs `/research` for unfamiliar technology/architecture decisions, assembles a plan, and delegates each step to a subagent — capped at an absolute maximum of 3 concurrent sub-processes. It updates project memory after completion (`mcp__serena__edit_memory` / `write_memory`) so non-obvious knowledge discovered during execution persists.

Like `relates_to::[[Power Mode Skill]]`, this is a hierarchical orchestrator-worker implementation — `now` is the single lead agent, workers are always subordinate, never peers — matching the topology `implements::[[Multi-Agent Orchestration Patterns]]` identifies as production-durable, at a smaller team-size ceiling suited to less-parallelizable work than power-mode's 5-agent minimum.
