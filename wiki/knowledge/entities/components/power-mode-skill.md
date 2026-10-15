---
id: power-mode-skill
title: Power Mode Skill
aliases: [power-mode, /power-mode]
updated: 2026-09-20
sources:
  - ../../../../raw/research/ai-agent-architecture-observability/index.md
  - ../../../../raw/research/wiki-skill-simplification/index.md
  - ../../../../raw/research/whats-next/index.md
confidence: extracted
tags: [orchestration, skill, agent-team]
---

`lib/skills/power-mode/SKILL.md` is this repository's heavyweight orchestrator: given a roadmap path it drives every item through a `tackle → uat-create → uat-auto` pipeline via a parallel agent team, while a task path is handled by a short pointer at that three-skill pipeline rather than by the orchestrator team. It mandates a minimum team size of 5 collision-safe agents per wave (fewer only when fewer than 5 collision-safe tasks exist in the current wave), determined by a collision-check protocol that groups tasks by non-overlapping file paths before spawning. Every spawned agent receives `mode: "bypassPermissions"` and a fixed footer instruction (Serena-first tool use; invoke `/research` before proceeding on any uncertainty).

Architecturally this is a **hierarchical orchestrator-worker pattern**: power-mode itself is the lead/orchestrator, never a peer in a group-chat topology, and workers operate on disjoint file sets rather than shared mutable state — `implements::[[Multi-Agent Orchestration Patterns]]`'s "orchestrator + isolated subagents" pattern, which external 2026 production research identifies as the topology that survives at scale (in contrast to peer/GroupChat coordination, which failed in production). `relates_to::[[Now Skill]]` is the lighter-weight sibling for smaller/less parallelizable work. Neither skill currently emits any tracing/timing telemetry of its own; `uses::[[Claude Code OpenTelemetry Export]]` would give free visibility into these agent-team executions once enabled.

`relates_to::[[wiki-skill-boilerplate-duplication]]` found that this skill's two modes were not equally load-bearing: the **Roadmap-to-Completion Orchestrator** mode is genuinely distinct (loop/materialization/wave logic no other skill has), but the **Single-Task Executor** mode added close to zero logic beyond sequencing `/tackle` → `/uat-create` → `/uat-auto` with a "don't stop between phases" footer. That shrink has since been done: the Single-Task Executor is now a short pointer at `/tackle` → `/uat-create` → `/uat-auto`, per [[TASK-0100]].

`relates_to::[[whats-next]]` (research, 2026-09-20) found that `power-mode` can only be pointed at a roadmap or a single task, so it cannot see work outside a roadmap (5 of 31 active tasks and all 9 bugs at the time). The recommendation is to keep it the sole executor and add one dispatch form — a comma-separated task-ID list that skips the roadmap loop's Steps 1–2 and runs the three-phase pipeline plus the reap sweep once — so a read-only `/whats-next --go` can hand it a ranked wave; its existing per-task resume rule (`pending-uat` with a UAT file starts at `/uat-auto`) already suits that. Not yet implemented. See `relates_to::[[cross-family-work-prioritization]]`.

evolved_by::[[TASK-003]] fixed two stale `wiki/work/tasks/README.md` references (pre-dating the wiki2 migration to `index.md`-based active lists) at the lines documenting the Roadmap-to-Completion Orchestrator's task-removal step.
evolved_by::[[TASK-0100]]
