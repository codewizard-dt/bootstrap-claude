---
id: cross-family-work-prioritization
title: Cross-Family Work Prioritization (Tiers, Not Scores)
aliases: [whats-next ranking model, tiered work ranking]
updated: 2026-09-20
sources:
  - ../../../raw/research/whats-next/index.md
  - ../../../raw/research/whats-next/sources.md
confidence: inferred
tags: [prioritization, work-families, kanban, critical-path]
---

The ranking model recommended for a cross-family "what should I do next?" skill over this repo's `wiki/work/` families. It is a **synthesis** — the tier order and the use of graph depth as a proxy are this research's inference, built from Kanban/flow and critical-path ideas and from the precedence rules the existing per-family `*-assess` skills already use.

**Why tiers, not a numeric score.** Numeric frameworks need estimates this wiki does not hold: tasks carry no priority or effort field, and all 9 bugs are untriaged (`priority: "—"`). RICE needs reach/impact/confidence/effort; WSJF needs three cost-of-delay scores plus job size — both would be false precision here. Every existing assess skill instead uses an explicit lexicographic precedence with a one-sentence, user-overridable rationale, so the model follows that convention.

**What is borrowed anyway.** WSJF and CD3 both "divide value by a size term so small bets float up"; Little's Law (lead time = WIP ÷ throughput) and Kanban's "stop starting, start finishing" say in-flight work should outrank new work; the critical-path method says the longest chain of dependents is what delays everything. All three can be approximated without estimates from **item state** and **downstream dependency depth**.

**The tier order** (highest first; within a tier: downstream depth ↓, fan-out ↓, age ↑, ID ↑):
1. *Fix what's broken* — bugs `in-progress`, triaged P0/P1, or `critical`.
2. *Finish what's started* — `in-progress` tasks and `pending-uat` tasks (run the UAT); untriaged bugs promoted here as a single batch row when any is `high`/`critical`.
3. *Unblock* — proposed ADR blocks gating live work; approved PRDs with no downstream.
4. *Start ready work* — `todo` tasks whose dependencies are start-satisfied; inline roadmap items.
5. *Triage & hygiene* — untriaged bugs, stale drafts, index drift.
6. *Blocked* — listed with what each waits on, never ranked as actionable.

**Roadmap membership is a display column, not a ranking input** — otherwise orphan tasks (5 of 31 here) starve behind roadmap work. **A dependency is start-satisfied once the prerequisite is `pending-uat` or `done`, close-satisfied only when `done`** *(inference from live data: TASK-0121 is `in-progress` with `pending-uat` prerequisites)*.

**Observed consequence in this repo** *(inference)*: with 24 of 31 tasks `pending-uat` and 24 of 24 UATs pending, work-in-progress is concentrated in one state, so the bottleneck is verification, not implementation, and the dependency chain `TASK-0118 → 0119 → 0120 → 0121 → 0122 → 0123 → 0124` (depth 6) would head the ranking through its UAT runs.

**If effort/value fields are ever added**, layer a WSJF/CD3 score as a tie-break *inside* each tier; do not replace the tiers.

See `derived_from::[[whats-next]]` for the full research, `relates_to::[[power-mode-skill]]` for the executor that would receive the top wave, and `relates_to::[[multi-agent-orchestration-patterns]]`.
