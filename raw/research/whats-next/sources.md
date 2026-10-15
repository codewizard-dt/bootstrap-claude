---
topic: a new skill that combines 'power-mode', 'roadmp-assess', and 'task-assess' .. some tasks aren't part of a roadmap! this skill should assess ALL open work and prioritize from there. maybe soimething silly like '/whats-next
slug: whats-next
researched: 2026-09-20
---

# Primary Sources — `/whats-next`

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/skills/power-mode/SKILL.md` | 2026-09-20 | Dispatch on roadmap/task path or ID only; ≥5-agent parallelism mandate; `bypassPermissions` agents; autonomous loop; Single-Task Executor resume rule (`pending-uat` + UAT file → stage 3) |
| S2 | codebase | `lib/skills/roadmap-assess/SKILL.md` | 2026-09-20 | Roadmap-only scope; rank precedence (hard dependency → functional priority → momentum); auto-close write side-effect; reuses `roadmap-next`'s Parse-a-roadmap "as written" |
| S3 | codebase | `lib/skills/task-assess/SKILL.md` | 2026-09-20 | Index-driven; Step 2 auto-checks steps and moves completed tasks; Step 5 always overwrites `dependency-graph.md`; dependency resolved only when task leaves active index; wave computation |
| S4 | codebase | `lib/skills/bug-assess/SKILL.md` | 2026-09-20 | Batch-triage `AskUserQuestion` + edits; rank precedence (blocking → priority → severity → impact) |
| S5 | codebase | `lib/skills/uat-assess/SKILL.md` | 2026-09-20 | "Strictly read-only" pattern; auto-runnable vs manual-only definition; unblocking-power ranking; permitted-tools list |
| S6 | codebase | `lib/skills/prd-assess/SKILL.md` | 2026-09-20 | Read-only; status-not-directory rule; PRD tier ranking |
| S7 | codebase | `lib/skills/adr-assess/SKILL.md` | 2026-09-20 | Read-only; per-block ranking; gated-count signal for proposed decisions |
| S8 | codebase | `lib/skills/roadmap-next/SKILL.md` | 2026-09-20 | Shared "Parse a roadmap" procedure; wave cap of 3; `pending-uat` action mapping |
| S9 | codebase | `lib/skills/tackle/SKILL.md` | 2026-09-20 | Roadmap Auto-Discovery is roadmap-first; task survey ranks on `status` alone; sets `pending-uat`; index text says status "now directly distinguishes `todo` / `in-progress` / `pending-uat` (see lifecycle)" |
| S10 | codebase | `wiki/work/tasks/lifecycle.md` | 2026-09-20 | Status enum `todo \| in-progress \| done \| trashed` (no `pending-uat`); `depends_on`/`blocks`/`parallel_safe_with` array schema; no priority/effort field |
| S11 | codebase | `lib/skills/_shared/SKILL-BOILERPLATE.md` | 2026-09-20 | Contract-tested Prereqs grammar (one lifecycle reference form); Edit-hygiene rules |
| S12 | codebase | `lib/skills/_shared/ID-RESOLUTION.md` | 2026-09-20 | 3- and 4-digit IDs coexist; resolve by integer; archive scope only for tasks/uat/bugs |
| S13 | codebase | Serena memory `skills/format-and-model-selection` | 2026-09-20 | New-skill checklist (frontmatter, category, model tiers, README/CLAUDE.md registration); skill edits not live until `install-global.sh` runs |
| S14 | codebase | `wiki/work/{tasks,roadmaps,bugs,uat,decisions,requirements}/index.md` | 2026-09-20 | Live active-item lists; stale roadmap progress figures; ROADMAP-0014 Phase 4 task set incl. TASK-0120 "per-skill contract test" |
| S15 | codebase | Serena `search_for_pattern` sweeps of `wiki/work/tasks/TASK-*.md` for `^status:`, `^depends_on:`, `^blocks:` | 2026-09-20 | 31 active tasks: 24 `pending-uat`, 6 `todo`, 1 `in-progress`; `depends_on` line 7 and `blocks` line 8 in every file; asymmetric edges (0093→0096, 0095→0114, 0097→0121); TASK-0121 in-progress with pending-uat prerequisites |
| S16 | codebase | Serena `search_for_pattern` `\[\[TASK-\d+` over `wiki/work/roadmaps/` | 2026-09-20 | Roadmap membership: 26 of 31 tasks in active roadmaps; 5 orphans; per-roadmap checked counts vs. index; archived ROADMAP-009 still shows an unchecked `[[TASK-073]]` |
| S17 | codebase | Serena `search_for_pattern` `^(status\|priority\|severity):[^\n]*` over `wiki/work/bugs/` | 2026-09-20 | 9 active bugs, all `status: open`, all `priority: "—"`; severities 3 high / 3 medium / 3 low |
| S18 | codebase | Serena `search_for_pattern` `^status:` over `wiki/work/uat/UAT-*.md` | 2026-09-20 | 24 active UATs, all `status: pending` |
| S19 | codebase | `wiki/knowledge/entities/components/power-mode-skill.md` | 2026-09-20 | Single-Task Executor shrunk to a pointer per TASK-0100; orchestrator-worker topology |
| S20 | codebase | `wiki/knowledge/concepts/wiki-multi-writer-safety.md` | 2026-09-20 | Concurrent writes to shared `index.md`/`log.md` are a documented risk; no locking adopted |
| S21 | environment | Session available-skills list vs. `lib/skills/` directory listing | 2026-09-20 | Installed set still lists `task-audit`, `decision-*`, `req-*`, `task-add`, `uat-generate`, `bug-file`; repo has `task-assess`, `adr-*`, `prd-*`, `task-create`, `uat-create`, `bug-create` |
| S22 | codebase | Serena `search_for_pattern` tool behaviour (empirical, this session) | 2026-09-20 | `.*` under default multiline returned 459,518 chars; `multiline=false` + `^` returned `{}`; bare `TASK-*.md` glob returned `{}` while `wiki/work/tasks/TASK-*.md` worked |
| S23 | context7 | `/websites/code_claude` — "skill frontmatter fields context: fork, allowed-tools, disable-model-invocation" | 2026-09-20 | `context: fork`, `background`, `model`, `effort`, `disable-model-invocation` semantics |
| S24 | context7 | `/websites/code_claude` — "subagents cannot spawn other subagents nested" | 2026-09-20 | Default nesting depth of three; `Agent` tool withheld at limit |
| S25 | web | https://www.planview.com/resources/articles/wip-limits/ | 2026-09-20 | "Stop starting, start finishing" as the core WIP-limit principle |
| S26 | web | https://www.ruzora.com/blog/wip-limits-and-littles-law | 2026-09-20 | Little's Law: lead time = WIP ÷ throughput; more WIP lengthens lead time |
| S27 | web | https://frameworklist.com/compare/rice-vs-wsjf | 2026-09-20 | RICE vs. WSJF inputs; both divide value by a size term so small bets float up |
| S28 | web | https://www.kaizenko.com/wsjf-and-cost-of-delay-prioritizing-for-economic-value-throughput/ | 2026-09-20 | WSJF scores are relative estimates; dependency mapping must accompany scoring |
| S29 | web | https://agility-at-scale.com/principles/product-economics/ | 2026-09-20 | CD3 (cost of delay divided by duration) origin with Reinertsen; WSJF derives from it |
| S30 | web | https://asana.com/resources/critical-path-method | 2026-09-20 | Critical path = longest dependent sequence; float/slack; CPM needs accurate estimates |
| S31 | web | https://en.wikipedia.org/wiki/Topological_sorting | 2026-09-20 | Topological sort gives a valid order; critical-path algorithms build on it; cycle detection |
| S32 | codebase | `wiki/work/bugs/lifecycle.md` | 2026-09-20 | Bug schema: `severity` and `priority` required; `open → triaged → in-progress → closed` |

## Excerpts

### S1 — power-mode SKILL.md
`lib/skills/power-mode/SKILL.md`
> **Spawning a parallel agent team is MANDATORY whenever tasks are collision-safe.**

> Every agent spawned in power-mode MUST include `mode: "bypassPermissions"`

> Resume from the first incomplete stage by reading the task's `status:` — `todo`/`in-progress` starts at 1; `pending-uat` with no UAT file starts at 2, with one starts at 3; `done`/`trashed` → report and stop.

### S3 — task-assess SKILL.md
`lib/skills/task-assess/SKILL.md`
> Do **not** scan the directory directly. The index is authoritative for active tasks.

> **Always run this step** (regardless of flags). Write the generated graph to its own file, `wiki/work/tasks/dependency-graph.md`

### S5 — uat-assess SKILL.md
`lib/skills/uat-assess/SKILL.md`
> This skill is strictly read-only: it never runs a case, never flips a status, never creates a file, and never asks questions.

### S9 — tackle SKILL.md
`lib/skills/tackle/SKILL.md`
> `index.md` carries no progress columns — it lists title + one-line summary + `status` only, and `status` now directly distinguishes `todo` / `in-progress` / `pending-uat` (see [lifecycle](../tasks/lifecycle.md))

### S10 — tasks lifecycle
`wiki/work/tasks/lifecycle.md`
> | `status` | yes | `todo \| in-progress \| done \| trashed` |

### S13 — Serena memory skills/format-and-model-selection
> **A skill edit is not live until `install-global.sh` runs** — the `~/.claude/skills/` copy is an rsync of `lib/skills/`.

### S20 — wiki-multi-writer-safety
`wiki/knowledge/concepts/wiki-multi-writer-safety.md`
> The problem of two or more agents writing to the same shared wiki file (a family `index.md`, `wiki/index.md`, or `wiki/log.md`) at the same time, corrupting or losing one write.

### S23 — Claude Code docs, skills (Context7)
https://code.claude.com/docs/en/skills
> `context` | No | Set to `fork` to run in a forked subagent context.

> The forked subagent runs in the [background](/docs/en/sub-agents#run-subagents-in-foreground-or-background): you keep working while it runs, and its result arrives in your conversation when it completes. Set `background: false` in the frontmatter to instead wait for the result in the turn that invoked the skill.

### S24 — Claude Code docs, subagents (Context7)
https://code.claude.com/docs/en/sub-agents
> By default, a subagent can spawn subagents of its own, up to three layers below the main conversation.

### S25 — Planview, "Why We Need WIP Limits"
https://www.planview.com/resources/articles/wip-limits/
> The main idea behind WIP limits can be explained by this simple phrase: Stop starting, start finishing.

### S26 — Ruzora, "WIP Limits and Little's Law"
https://www.ruzora.com/blog/wip-limits-and-littles-law
> Lead time equals WIP divided by throughput.

> With throughput roughly fixed, more WIP means longer lead times, so everything takes longer to finish (Little's Law).

### S27 — Framework, "RICE vs WSJF"
https://frameworklist.com/compare/rice-vs-wsjf
> Both RICE and WSJF reduce a backlog to a single number, and both divide value by a size term so small bets float up.

> Cost of Delay is a composite of three relative scores: User-Business Value, Time Criticality, and Risk Reduction or Opportunity Enablement.

### S28 — Kaizenko, "WSJF and Cost of Delay"
https://www.kaizenko.com/wsjf-and-cost-of-delay-prioritizing-for-economic-value-throughput/
> Dependency mapping has to happen alongside WSJF scoring.

### S29 — Agility at Scale, "Product Economics"
https://agility-at-scale.com/principles/product-economics/
> While CoD measures the economic impact of delay per unit time, CD3 measures the economic return rate of an investment—the bang for buck. This metric originated with Don Reinertsen

### S30 — Asana, "Critical path method"
https://asana.com/resources/critical-path-method
> The critical path method (CPM) is a project scheduling technique that identifies the longest sequence of dependent tasks required to complete a project.

> It requires accurate estimates. The effectiveness of CPM depends on how accurately you can estimate the duration for each task.

### S31 — Wikipedia, "Topological sorting"
https://en.wikipedia.org/wiki/Topological_sorting
> Otherwise, the graph must have at least one cycle and therefore a topological sort is impossible.

> By definition, the solution of a scheduling problem that includes a precedence graph is a valid solution to topological sort (irrespective of the number of machines), however, topological sort in itself is not enough to optimally solve a scheduling optimisation problem.
