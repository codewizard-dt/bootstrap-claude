---
name: power-mode
description: Orchestrator for parallel agent teams. When invoked with a roadmap file path, drives every item through the full tackle → uat-create → uat-auto pipeline until complete. When invoked with a task file path, runs that pipeline once in the current session and stops.
category: executing
model: claude-sonnet-5
argument-hint: "[roadmap-file-path | task-file-path | TASK-NNNN]"
disable-model-invocation: false
user-invocable: true
---

# Power Mode — Agent Team Orchestrator

Use this skill to drive tasks or roadmaps to completion using a parallel agent team. The primary goal is efficiency: collision-safe tasks must always run in parallel. You are the primary orchestrator. Use agent teams for parallel work. 

---

## Dispatch — Roadmap vs Task

**Trigger:** `/power-mode <path>` with no additional instructions.

Inspect the path argument:
- Path contains `roadmap` or matches `ROADMAP-NNNN` → **Roadmap-to-Completion Orchestrator** (see below)
- Path contains `task` or matches `TASK-NNNN` → **Single-Task Executor** (a pointer at the tackle → uat-create → uat-auto pipeline; see below)
- A task **ID** instead of a path (`TASK-0086`, `task 86`) → resolve it to its file with `find_file` on `TASK-<zero-padded NNNN>-*.md` under `wiki/work/tasks/`, then run the **Single-Task Executor** on that path. A bare number with no `TASK`/`ROADMAP` prefix is ambiguous — stop and ask which one is meant.

---

## Parallelization Mandate

**Spawning a parallel agent team is MANDATORY whenever tasks are collision-safe.** Collision-safe means the tasks do not write to the same files or shared state. When in doubt, read the task steps — if file paths do not overlap, they are collision-safe.

- **Minimum team size: 5 agents** when 5 or more collision-safe tasks are available in the current wave.
- If the wave has fewer than 5 tasks, spawn one agent per task — still parallel, never sequential.
- Running collision-safe tasks one at a time is a **performance failure**. It is forbidden.
- The mandate applies equally to UAT generation (Phase 2) and UAT execution (Phase 3).

**Collision check protocol before each wave:**
1. List the files each task is expected to touch (read each task file's Steps section).
2. Group tasks that share no file paths — each group is safe to run in parallel.
3. Spawn all agents in the safe group simultaneously in a single message with multiple Agent tool calls.
4. Only serialize tasks within a group if a direct dependency is declared in the task file.

---

## Team Member Requirements

Every agent spawned in power-mode MUST include `mode: "bypassPermissions"` and the following footer appended to its prompt:

```
IMPORTANT: Follow wiki/guides/mcp-tools.md for all file and code operations. Use Serena (mcp__serena__*) for ALL file/directory exploration and ALL code editing. Never use ls, cat, find, grep, sed, awk, or any shell command to inspect or modify files. Use Read/Edit/Write only for markdown and config files.

IMPORTANT: If at any point you are not 100% sure how to fix an issue or which implementation strategy to use, invoke /research first and act on its recommendation before proceeding.
```

All agent call examples below omit this footer for brevity — it is always required.

---

## Agent Lifecycle — Reap Finished and Idle Agents (CRITICAL)

Named agents become teammates that **persist after their work is done** — a finished or idle agent keeps its panel row and process until it is explicitly shut down. Never leave them lingering. You are responsible for fully terminating every agent you spawn.

**Reap sweep — run at each of these points:**
- Immediately after every "Wait for all to complete" (end of each phase)
- At the end of every wave, before returning to Step 1
- Periodically while waiting on long-running agents (roughly every few minutes of wall-clock time, or whenever you are notified an agent finished)
- Before the final report / stopping point

**Sweep procedure:**
1. Call `ListAgents` to enumerate the agents you spawned this run.
2. For each agent that is **finished** (reported completion, or its result already arrived) or **idle** (no activity and awaiting input it will never get), collect its report first, then terminate it:
   - `SendMessage` the agent a shutdown request (e.g. "Work complete — shut down now."), and confirm it disappears from `ListAgents`.
   - If it is still listed afterwards, or is hung/stuck, stop it with `TaskStop` using its task ID.
3. Re-run `ListAgents` and verify that no finished or idle agent from a completed phase remains. Repeat step 2 until the list is clean.

**Rules:**
- Never terminate an agent that is still actively working — only finished or idle ones.
- Never begin the next phase or wave while finished/idle agents from the previous one are still alive.
- Never spawn a replacement for a stuck agent without terminating the stuck one first.
- Do not treat "the agent returned its result" as termination — it is not. Termination is confirmed only when the agent no longer appears in `ListAgents`.
- The final state on stopping must be **zero** power-mode agents remaining.

---

## Single-Task Executor

**Trigger:** `/power-mode <path/to/TASK-NNNN.md>` (or a `TASK-NNNN` ID, resolved per Dispatch) with no additional instructions.

A single task has nothing to parallelize, so this mode is only a pointer — no agent team, no reap sweep. Same autonomous mandate as the roadmap loop: take the task to completion. Run these three skills in order in the current session (Skill tool), without pausing, asking questions, or awaiting approval between them:

1. `/tackle <task-path>`
2. `/uat-create <task-path>`
3. `/uat-auto <uat-path>` — same NNNN slug, under `wiki/work/uat/`

Resume from the first incomplete stage by reading the task's `status:` — `todo`/`in-progress` starts at 1; `pending-uat` with no UAT file starts at 2, with one starts at 3; `done`/`trashed` → report and stop.

Stop after `/uat-auto` returns. On all-pass, its own UAT-CORE Closure procedure handles task/UAT status, archiving, index rows, and the roadmap checkbox. UI tests are run in a real browser by `/uat-auto` through the Playwright MCP — expect them to pass or fail on evidence, not to be deferred wholesale. Tests left as `[FAIL: auto-judge: ... requires human verification]` (bare manual, visual-only UI Expected, Playwright unavailable) or stub-detected `- [ ] Pass` are an acceptable resting state, not a blocker — report them in the summary.

---

## Roadmap-to-Completion Orchestrator

**Trigger:** `/power-mode <path/to/ROADMAP-NNNN.md>` with no additional instructions.

**Goal:** Drive the roadmap to completion — every item through the full tackle → UAT-create → UAT-auto pipeline — looping through waves of parallelizable work until no implementation work remains.

**AUTONOMOUS EXECUTION MANDATE:** Once triggered, drive the roadmap to completion without stopping. Do NOT pause between waves to report progress or ask for permission to continue. The only valid stopping point is when `/roadmap-next` reports no items remaining. A roadmap item is complete once it has been through the full pipeline — UAT tests requiring human verification do NOT block loop progression.

### Forbidden actions in orchestrator mode

- ❌ Stopping after a wave or phase to ask "shall I continue?"
- ❌ Asking clarifying questions about scope, naming, or strategy mid-run
- ❌ Treating a roadmap "Phase" boundary as a stopping point
- ❌ Blocking loop progression because some UAT tests require human verification

### Orchestrator loop

Run until `/roadmap-next <file>` reports no items remaining:

**Step 1 — Get the next wave**

Invoke `/roadmap-next <file>` to identify the next group of parallelizable unchecked items.

**Step 2 — Materialize inline placeholders**

For any item that is an inline placeholder (no existing task file link), spawn a task-creation agent:

```
Agent({
  description: "Create task for <item>",
  prompt: "Run /task-create for this roadmap item: '<item description>'. Link the resulting task back into the roadmap file at wiki/work/roadmaps/<file>. Run /research before writing the task. Make all scope, naming, and structuring decisions autonomously — infer reasonable defaults from the roadmap context and existing task files in wiki/work/tasks/. [append team member footer]",
  mode: "bypassPermissions"
})
```

Wait for all task-creation agents to complete, then reap them (see Agent Lifecycle).

**Step 3 — Three-phase pipeline for the wave**

Run tackle → UAT-create → UAT-auto for all tasks in the current wave. Apply the Parallelization Mandate at every phase.

Phase 1 — Tackle (parallel, minimum 5 agents when 5+ collision-safe tasks available):
```
Agent({ description: "Tackle TASK-NNNN", prompt: "Run /tackle <path>. [append team member footer]", mode: "bypassPermissions" })
Agent({ description: "Tackle TASK-MMM", prompt: "Run /tackle <path>. [append team member footer]", mode: "bypassPermissions" })
// ... one per task, all in the same message
```

Wait for all to complete.

Phase 2 — Generate UAT tests (parallel, read-only):
```
Agent({ description: "UAT create TASK-NNNN", prompt: "Run /uat-create <task-path>. [append team member footer]", mode: "bypassPermissions" })
// ... one per task, all in the same message
```

Wait for all to complete.

Phase 3 — Run UATs (parallel when UAT files don't collide):
```
Agent({
  description: "UAT auto TASK-NNNN",
  prompt: "Run /uat-auto <uat-path>.

Note: on all-pass, /uat-auto's own UAT-CORE Closure procedure already flips the task to done, archives both files, removes index rows, and auto-checks the matching roadmap checkbox — no need to instruct any of that here.

UI tests (UAT-UI-*) MUST be run with the Playwright MCP — load its deferred tools via ToolSearch (query 'playwright browser') and follow /uat-auto's browser channel (UAT-CORE Step 4 channel 3). Do NOT record a UI test as needing human verification without having attempted the browser run; the only acceptable deferrals are a visual-only Expected or Playwright genuinely unavailable (say which in your report).

Tests recorded as [FAIL: auto-judge: ... requires human verification] for those reasons, or bare manual cases, do NOT block this step. If stub-detected tests remain, that's /uat-auto's own expected behavior — it leaves the file in place; report the stubs. [append team member footer]",
  mode: "bypassPermissions"
})
```

**Step 4 — Reap and repeat**

Run the reap sweep (see Agent Lifecycle): terminate every finished or idle agent from this wave and verify via `ListAgents` that none remain. Then immediately return to Step 1. No pausing, no reporting, no confirmation. Loop until `/roadmap-next` reports no items remaining, then run a final reap sweep so zero power-mode agents remain.

