---
name: power-mode
description: Orchestrator for parallel agent teams. When invoked with a roadmap file path, drives every item through the full tackle → uat-generate → uat-auto pipeline until complete. When invoked with a task file path, runs that pipeline once and stops.
category: executing
model: claude-sonnet-5
argument-hint: "[roadmap-file-path | task-file-path]"
disable-model-invocation: false
user-invocable: true
---

# Power Mode — Agent Team Orchestrator

Use this skill to drive tasks or roadmaps to completion using a parallel agent team. The primary goal is efficiency: collision-safe tasks must always run in parallel. You are the primary orchestrator. Use agent teams for parallel work. 

---

## Dispatch — Roadmap vs Task

**Trigger:** `/power-mode <path>` with no additional instructions.

Inspect the path argument:
- Path contains `roadmap` or matches `ROADMAP-NNN` → **Roadmap-to-Completion Orchestrator** (see below)
- Path contains `task` or matches `TASK-NNN` → **Single-Task Executor** (see below)

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

## Single-Task Executor

**Trigger:** `/power-mode <path/to/TASK-NNN.md>` with no additional instructions.

**Goal:** Drive one task through the full tackle → UAT-generate → UAT-auto pipeline exactly once, then stop.

**AUTONOMOUS EXECUTION MANDATE:** Execute all three phases without pausing, asking questions, or awaiting approval. The only valid stopping point is after `/uat-auto` completes and the file-move housekeeping is done.

**Phase 1 — Tackle**

```
Agent({
  description: "Tackle <TASK-NNN>",
  prompt: "Run /tackle <task-path>. [append team member footer]",
  mode: "bypassPermissions"
})
```

Wait for the agent to complete.

**Phase 2 — Generate UAT tests**

```
Agent({
  description: "UAT generate <TASK-NNN>",
  prompt: "Run /uat-generate <task-path>. [append team member footer]",
  mode: "bypassPermissions"
})
```

Wait for the agent to complete.

**Phase 3 — Run UATs**

```
Agent({
  description: "UAT auto <TASK-NNN>",
  prompt: "Run /uat-auto <uat-path> (infer the UAT file path from the task path — same NNN slug, under wiki/work/uat/).

Note: on all-pass, /uat-auto's own UAT-CORE Closure procedure already flips the task to done, archives both files, removes index rows, and auto-checks the matching roadmap checkbox (if any) — you do not need to instruct any of that here; it happens natively. Just wait for it to complete and report its summary.

UAT tests recorded as [FAIL: auto-judge: UI test requires human verification] do NOT block task completion — /uat-auto does not run UI tests. Treat these as an acceptable resting state, not a blocker.

If any tests remain as - [ ] Pass because stub indicators were detected, that's expected — /uat-auto leaves the task in place rather than closing it. Report the stub-detected tests in your summary. [append team member footer]",
  mode: "bypassPermissions"
})
```

Done. No further iteration.

---

## Roadmap-to-Completion Orchestrator

**Trigger:** `/power-mode <path/to/ROADMAP-NNN.md>` with no additional instructions.

**Goal:** Drive the roadmap to completion — every item through the full tackle → UAT-generate → UAT-auto pipeline — looping through waves of parallelizable work until no implementation work remains.

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
  prompt: "Run /task-add for this roadmap item: '<item description>'. Link the resulting task back into the roadmap file at wiki/work/roadmaps/<file>. Run /research before writing the task. Make all scope, naming, and structuring decisions autonomously — infer reasonable defaults from the roadmap context and existing task files in wiki/work/tasks/. [append team member footer]",
  mode: "bypassPermissions"
})
```

Wait for all task-creation agents to complete.

**Step 3 — Three-phase pipeline for the wave**

Run tackle → UAT-generate → UAT-auto for all tasks in the current wave. Apply the Parallelization Mandate at every phase.

Phase 1 — Tackle (parallel, minimum 5 agents when 5+ collision-safe tasks available):
```
Agent({ description: "Tackle TASK-NNN", prompt: "Run /tackle <path>. [append team member footer]", mode: "bypassPermissions" })
Agent({ description: "Tackle TASK-MMM", prompt: "Run /tackle <path>. [append team member footer]", mode: "bypassPermissions" })
// ... one per task, all in the same message
```

Wait for all to complete.

Phase 2 — Generate UAT tests (parallel, read-only):
```
Agent({ description: "UAT generate TASK-NNN", prompt: "Run /uat-generate <task-path>. [append team member footer]", mode: "bypassPermissions" })
// ... one per task, all in the same message
```

Wait for all to complete.

Phase 3 — Run UATs (parallel when UAT files don't collide):
```
Agent({
  description: "UAT auto TASK-NNN",
  prompt: "Run /uat-auto <uat-path>.

Note: on all-pass, /uat-auto's own UAT-CORE Closure procedure already flips the task to done, archives both files, removes index rows, and auto-checks the matching roadmap checkbox — no need to instruct any of that here.

UAT tests recorded as [FAIL: auto-judge: UI test requires human verification] do NOT block this step. If stub-detected tests remain, that's /uat-auto's own expected behavior — it leaves the file in place; report the stubs. [append team member footer]",
  mode: "bypassPermissions"
})
```

**Step 4 — Repeat**

Immediately return to Step 1. No pausing, no reporting, no confirmation. Loop until `/roadmap-next` reports no items remaining.

