---
id: power-mode-skill
title: Power Mode Skill
aliases: [power-mode, /power-mode]
updated: 2026-09-13
sources:
  - ../../../../raw/research/ai-agent-architecture-observability/index.md
confidence: extracted
tags: [orchestration, skill, agent-team]
---

`lib/skills/power-mode/SKILL.md` is this repository's heavyweight orchestrator: given a roadmap path it drives every item, and given a task path it drives that one task, through a `tackle → uat-generate → uat-auto` pipeline via a parallel agent team. It mandates a minimum team size of 5 collision-safe agents per wave (fewer only when fewer than 5 collision-safe tasks exist in the current wave), determined by a collision-check protocol that groups tasks by non-overlapping file paths before spawning. Every spawned agent receives `mode: "bypassPermissions"` and a fixed footer instruction (Serena-first tool use; invoke `/research` before proceeding on any uncertainty).

Architecturally this is a **hierarchical orchestrator-worker pattern**: power-mode itself is the lead/orchestrator, never a peer in a group-chat topology, and workers operate on disjoint file sets rather than shared mutable state — `implements::[[Multi-Agent Orchestration Patterns]]`'s "orchestrator + isolated subagents" pattern, which external 2026 production research identifies as the topology that survives at scale (in contrast to peer/GroupChat coordination, which failed in production). `relates_to::[[Now Skill]]` is the lighter-weight sibling for smaller/less parallelizable work. Neither skill currently emits any tracing/timing telemetry of its own; `uses::[[Claude Code OpenTelemetry Export]]` would give free visibility into these agent-team executions once enabled.
