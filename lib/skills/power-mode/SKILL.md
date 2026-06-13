---
name: power-mode
description: Reference guide for running agent teams with bypassed permissions in a dev container — covers CLI flags, Agent tool mode param, and per-agent frontmatter. When invoked with a single roadmap file path, acts as a goal-driven orchestrator that drives the roadmap to 100% completion. When invoked with a single task file path, runs tackle → uat-generate → uat-auto once and stops.
category: executing
model: claude-sonnet-4-6
argument-hint: "[roadmap-file-path | task-file-path]"
disable-model-invocation: false
user-invocable: true
---

# Agent Permissions — Headless Agent Team Runs

Use this skill whenever you need to run an agent team (orchestrator + team members) inside a dev container without permission prompts.

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
- Running collision-safe tasks one at a time is a **performance failure** equivalent to not using power-mode at all. It is forbidden.
- The same mandate applies to UAT generation (Phase 2) and UAT execution (Phase 3) — parallelize every phase for every collision-safe group of tasks.

**Collision check protocol before each wave:**
1. List the files each task in the wave is expected to touch (read each task file's Steps section).
2. Group tasks that share no file paths — each group is safe to run in parallel.
3. Spawn all agents in the safe group simultaneously in a single message with multiple Agent tool calls.
4. Only serialize tasks within a group if a direct dependency is declared in the task file.

---

## Single-Task Executor

**Trigger:** `/power-mode <path/to/TASK-NNN.md>` with no additional instructions.

**Goal:** Drive one task through the full tackle → UAT-generate → UAT-auto pipeline exactly once, then stop.

**AUTONOMOUS EXECUTION MANDATE:** Execute all three phases without pausing, asking questions, or awaiting approval. The only valid stopping point is after `/uat-auto` completes and the file-move housekeeping is done. No iteration — this is a one-shot run.

### Single-task pipeline

**Phase 1 — Tackle**

Spawn one agent to tackle the task:

```
Agent({
  description: "Tackle <TASK-NNN>",
  prompt: "Run /tackle <task-path>.

IMPORTANT: Follow .docs/guides/mcp-tools.md for all file and code operations. Use Serena (mcp__serena__*) for ALL file/directory exploration and ALL code editing. Never use ls, cat, find, grep, sed, awk, or any shell command to inspect or modify files.

IMPORTANT: If at any point you are not 100% sure how to fix an issue or which implementation strategy to use, invoke /research first and act on its recommendation before proceeding.",
  mode: "bypassPermissions"
})
```

Wait for the agent to complete before proceeding.

**Phase 2 — Generate UAT tests**

Spawn one agent to generate UAT tests:

```
Agent({
  description: "UAT generate <TASK-NNN>",
  prompt: "Run /uat-generate <task-path>.

IMPORTANT: Follow .docs/guides/mcp-tools.md for all file and code operations. Use Serena (mcp__serena__*) for ALL file/directory exploration and ALL code editing.",
  mode: "bypassPermissions"
})
```

Wait for the agent to complete before proceeding.

**Phase 3 — Run UATs**

Spawn one agent to run the UAT:

```
Agent({
  description: "UAT auto <TASK-NNN>",
  prompt: "Run /uat-auto <uat-path> (infer the UAT file path from the task path — same NNN slug, under wiki/work/uat/).

CRITICAL: After the automated UAT run completes you MUST complete Step 7 in full before stopping:
1. git mv the UAT file to wiki/work/uat/completed/
2. git mv the task file to wiki/work/tasks/completed/
3. Remove the task row from wiki/work/tasks/README.md
4. Flip the matching roadmap checkbox if any, and update the task path in the roadmap

IMPORTANT: UAT tests recorded as [FAIL: auto-judge: UI test requires human verification] are expected — /uat-auto does not run UI tests. These do NOT block task completion. Proceed with Step 7 even if human-verification tests remain pending.

IMPORTANT: If any tests remain as - [ ] Pass because stub indicators were detected, do NOT mark the task as complete. Leave the UAT file in wiki/work/uat/ and report the stub-detected tests in your summary.",
  mode: "bypassPermissions"
})
```

Done. No further iteration.

---

## Roadmap-to-Completion Orchestrator

**Trigger:** `/power-mode <path/to/ROADMAP-NNN.md>` with no additional instructions.

**Goal:** Drive the roadmap to completion — every item through the full tackle → UAT-generate → UAT-auto pipeline — by looping through waves of parallelizable work until no implementation work remains.

**AUTONOMOUS EXECUTION MANDATE:** Once triggered, drive the roadmap to completion without stopping. Do NOT pause between waves to report progress. Do NOT ask the user for permission to start the next phase or wave. Do NOT summarize and wait for approval. The only valid stopping point is when `/roadmap-next` reports no items remaining in the implementation pipeline. A roadmap item is considered complete once it has been through the full tackle → uat-generate → uat-auto pipeline — UAT tests that require human verification do NOT block loop progression. Any pause that requires user input before this point is a failure mode.

### Forbidden actions in orchestrator mode

- ❌ Stopping after a wave or phase completes to ask "shall I continue?"
- ❌ Reporting phase summary and awaiting user approval before the next wave
- ❌ Asking clarifying questions about scope, naming, or strategy mid-run
- ❌ Treating a roadmap "Phase" boundary as a natural stopping point
- ❌ Blocking loop progression because some UAT tests require human verification
- ❌ Running collision-safe tasks sequentially instead of spawning a parallel agent team — this is a performance failure, not a safe default
- ❌ Spawning fewer than 5 agents in parallel when 5 or more collision-safe tasks are available in the current wave

### Orchestrator loop

Run this loop until `/roadmap-next <file>` reports no items remaining in the implementation pipeline:

**Step 1 — Get the next wave**

Invoke `/roadmap-next <file>` to identify the next group of parallelizable unchecked items.

**Step 2 — Materialize inline placeholders**

For any item that is an inline placeholder (no existing task file link), spawn a task-creation agent:

```
Agent({
  description: "Create task for <item>",
  prompt: "Run /task-add for this roadmap item: '<item description>'. Link the resulting task back into the roadmap file at wiki/work/roadmaps/<file>.

/research your task. You are running autonomously — make all scope, naming, and structuring decisions yourself without asking questions. Infer reasonable defaults from the roadmap context and existing task files in wiki/work/tasks/.

IMPORTANT: Follow .docs/guides/mcp-tools.md for all file and code operations. Use Serena (mcp__serena__*) for ALL file/directory exploration and ALL code editing. Never use ls, cat, find, grep, sed, awk, or any shell command to inspect or modify files.",
  mode: "bypassPermissions"
})
```

Wait for all task-creation agents to complete before proceeding.

**Step 3 — Three-phase pipeline for the wave**

Run the full tackle → UAT-generate → UAT-auto pipeline (see below) for all tasks in the current wave. **Apply the Parallelization Mandate:** spawn all collision-safe tasks simultaneously — minimum 5 agents when 5+ tasks are available. Do the same for UAT-generate and UAT-auto phases.

> **Note on `/uat-auto` behavior:** `/uat-auto` does not run UI tests — they are always recorded as `[FAIL: auto-judge: UI test requires human verification]` and require a subsequent `/uat-walk`. These pending tests do **not** block loop progression — a task is considered implemented once the automated UAT run completes, regardless of pending human-verification tests. If stub indicators are detected in the implementation, those tests remain pending (`FAIL: auto-judge: Stub detected - implementation required`) and the task stays in `wiki/work/tasks/` until the feature is implemented and re-tested.

**Step 4 — Repeat**

**Immediately** return to Step 1 without pausing, reporting to the user, or requesting confirmation. The loop is mandatory — do not stop between iterations. The only exit condition is `/roadmap-next` reporting no items remaining in the implementation pipeline (every item has been through tackle → uat-generate → uat-auto, even if some UAT tests still await human verification).

### Minimal orchestrator prompt (for nested orchestrators)

When you need to hand this off to a sub-orchestrator agent, use this compact brief:

```
Agent({
  description: "Drive <ROADMAP-NNN> to completion",
  prompt: "Your goal is to drive the roadmap at <path> to completion — every item through the full tackle → uat-generate → uat-auto pipeline.

Loop until no items remain in the implementation pipeline:
1. Run /roadmap-next <path> to get the next parallelizable wave.
2. For inline placeholders, run /task-add and link the task into the roadmap. Make all scope, naming, and structuring decisions autonomously — infer reasonable defaults from the roadmap context and existing task files; never ask clarifying questions.
3. Run the three-phase pipeline: /tackle each task (parallel per wave — MANDATORY: minimum 5 simultaneous agents when 5+ collision-safe tasks are available; never serialize collision-safe tasks) → /uat-generate each completed task (parallel — same rule) → /uat-auto each UAT file (parallel when files don't collide). After each /uat-auto run, verify that both the UAT file and task file were moved to their completed/ directories and the task row was removed from wiki/work/tasks/README.md — if not, do it now before proceeding. UAT tests that require human verification do NOT block this step.
4. Repeat from step 1.

Stop ONLY when /roadmap-next reports no items remaining in the implementation pipeline. UAT tests marked as requiring human verification are expected and do not block loop completion. Never pause between waves to ask the user for permission to continue.

IMPORTANT: Follow .docs/guides/mcp-tools.md for all file and code operations. Use Serena (mcp__serena__*) for ALL file/directory exploration and ALL code editing. Never use ls, cat, find, grep, sed, awk, or any shell command to inspect or modify files.

IMPORTANT: If at any point you are not 100% sure how to fix an issue or which implementation strategy to use, invoke /research first and act on its recommendation before proceeding.",
  mode: "bypassPermissions"
})
```

---

---

## The core problem

`--dangerously-skip-permissions` on the **parent** CLI does **not** propagate to team members. Each agent process has its own permission context. There is no global "cascade" setting — you must configure every layer explicitly.

---

## Layer 1 — Parent CLI (the orchestrator)

Start the top-level Claude Code session with one of:

```bash
claude --dangerously-skip-permissions
# or equivalently:
claude --permission-mode bypassPermissions
```

Inside a dev container this is the process that reads user messages and calls the Agent tool.

---

## Layer 2 — Team members spawned via the Agent tool (no `.md` file)

Pass `mode: "bypassPermissions"` on every `Agent(...)` call:

```json
Agent({
  "description": "short description",
  "prompt": "full task brief...",
  "mode": "bypassPermissions"
})
```

**All valid `mode` values:**

| Value | Behaviour |
|---|---|
| `bypassPermissions` | Skips all permission checks — use in isolated/dev-container environments |
| `acceptEdits` | Auto-approves file edits only |
| `dontAsk` | Only pre-approved tools run (fully non-interactive) |
| `auto` | Classifier-based approval (requires Team/Enterprise/API plan) |
| `plan` | Plan-first, then requires approval before acting |
| `default` | Prompts on every tool call |

---

## Layer 3 — Named agents with a `.claude/agents/<agent>.md` file

Add `permissionMode` to the frontmatter:

```yaml
---
name: my-agent
description: Does X
permissionMode: bypassPermissions
---
```

This sets the default for every invocation of that named agent, even if the caller omits `mode`.

---

## Mandatory rules for all team members

**Whenever you spawn any team member using the Agent tool — regardless of the skill or context — you MUST include `mode: "bypassPermissions"` on every call.** This is not optional in power-mode runs; omitting it causes the team member to prompt for permissions and block headless execution.

**Every team member prompt MUST include this MCP-tools instruction:**

> Follow `.docs/guides/mcp-tools.md` for all file and code operations. Use Serena (`mcp__serena__*`) for ALL file/directory exploration (`list_dir`, `find_file`, `search_for_pattern`) and ALL code editing. Never use `ls`, `cat`, `find`, `grep`, `sed`, `awk`, or any other shell command to inspect or modify files — the shell is for running programs only. Use the `Read`/`Edit`/`Write` tools only for markdown and config files.

**Team members MUST invoke `/research` before attempting any solution when:**
- they are not 100% confident about the correct fix or approach
- they encounter an unfamiliar error, API, or library behaviour
- they are choosing between two or more implementation strategies

The `/research` skill runs codebase analysis, Context7 doc lookups, and Brave web search in a single pass and returns a ranked recommendation. Team members must not guess or proceed on partial knowledge — use `/research` first, then act on its output.

---

## Canonical pattern for this project's `/now` skill

When `/now` or `/tackle` assembles an agent team for a headless run, every `Agent(...)` call must include `"mode": "bypassPermissions"` and the prompt must include the `/research` instruction:

```
Agent({
  description: "Tackle task 065",
  prompt: "...task brief...

IMPORTANT: Follow .docs/guides/mcp-tools.md for all file and code operations. Use Serena (mcp__serena__*) for ALL file/directory exploration (list_dir, find_file, search_for_pattern) and ALL code editing. Never use ls, cat, find, grep, sed, awk, or any shell command to inspect or modify files. Use Read/Edit/Write only for markdown and config files.

IMPORTANT: If at any point you are not 100% sure how to fix an issue or which implementation strategy to use, invoke the /research skill first and act on its recommendation before proceeding.",
  mode: "bypassPermissions",
  subagent_type: "claude"
})
```

---

## "Tackle these tasks and then UAT them" pipeline

When the user says anything like:
- *"tackle these tasks and then UAT them"*
- *"tackle X, Y, Z and run the UATs"*
- *"implement these and then test them"*

…interpret it as this **three-phase pipeline** (never collapse phases or skip context resets):

### Phase 1 — Tackle (mandatory parallel agent team — minimum 5 agents when collision-safe)

Assemble one agent team member per task using `/tackle`. **Parallelization is mandatory** for all collision-safe tasks — never run them one at a time. When the wave contains 5 or more collision-safe tasks, spawn all 5+ agents simultaneously in a single message. Tasks that share file paths must be serialized; all others must run in parallel.

```
Agent({ description: "Tackle TASK-NNN", prompt: "...", mode: "bypassPermissions" })
Agent({ description: "Tackle TASK-MMM", prompt: "...", mode: "bypassPermissions" })
Agent({ description: "Tackle TASK-PPP", prompt: "...", mode: "bypassPermissions" })
Agent({ description: "Tackle TASK-QQQ", prompt: "...", mode: "bypassPermissions" })
Agent({ description: "Tackle TASK-RRR", prompt: "...", mode: "bypassPermissions" })
// ... one per task in the wave, all in the same message
```

Wait for **all** team members to complete before proceeding.

### Phase 2 — Generate UAT tests (clear context first)

After all team members finish, **reset context** (`/clear` or start a fresh agent) before generating UAT files. This prevents stale implementation details from polluting the test-generation prompt.

Invoke `/uat-generate <task_path>` for each completed task (can be parallelized — UAT generation is read-only):

```
Agent({ description: "UAT generate TASK-NNN", prompt: "/uat-generate wiki/work/tasks/NNN-slug.md", mode: "bypassPermissions" })
```

Wait for all UAT generation to complete.

### Phase 3 — Run UATs autonomously (clear context first)

**Reset context again** before running tests. Then invoke `/uat-auto` for each generated UAT file:

```
Agent({
  description: "UAT auto TASK-NNN",
  prompt: "/uat-auto wiki/work/uat/NNN-slug.md

CRITICAL: After the automated UAT run completes you MUST complete Step 7 in full before stopping:
1. git mv the UAT file to wiki/work/uat/completed/
2. git mv the task file to wiki/work/tasks/completed/
3. Remove the task row from wiki/work/tasks/README.md
4. Flip the matching roadmap checkbox and update the task path in the roadmap
Do not stop after emitting the summary — the file moves are mandatory.

IMPORTANT: UAT tests recorded as [FAIL: auto-judge: UI test requires human verification] are expected — /uat-auto does not run UI tests. These do NOT block task completion. Proceed with Step 7 even if human-verification tests remain pending.

IMPORTANT: If any tests remain as - [ ] Pass because stub indicators were detected in the implementation, do NOT mark the task as complete. Leave the UAT file in wiki/work/uat/ and report the stub-detected tests in your summary. The task cannot be considered done until the stubs are implemented and the tests pass.",
  mode: "bypassPermissions"
})
```

`/uat-auto` records failures for human triage — do not run it in parallel with other team members that write to the same files.

### Summary

```
Phase 1: tackle (parallel agent team)
  ↓  wait for all
  ↓  /clear
Phase 2: uat-generate (parallel, read-only)
  ↓  wait for all
  ↓  /clear
Phase 3: uat-auto (parallel if no collisions)
```

---

## What does NOT work

- Setting `"defaultMode": "bypassPermissions"` in `.claude/settings.json` — does not cascade to team members.
- `skipDangerousModePermissionPrompt: true` in settings — only suppresses the one-time confirmation prompt, does not enable bypass mode or affect team members.
- The parent's `--dangerously-skip-permissions` CLI flag alone — only covers the parent process.

Tracked upstream: GitHub issues #40241, #37442, #58663.

---

## Quick checklist

- [ ] Parent process started with `--dangerously-skip-permissions` or `--permission-mode bypassPermissions`
- [ ] Every `Agent(...)` call includes `"mode": "bypassPermissions"`
- [ ] Any named agent `.md` files include `permissionMode: bypassPermissions` in frontmatter
- [ ] Every team member prompt includes the MCP-tools / Serena instruction (no `ls`, `grep`, `cat`, etc.)
- [ ] Every team member prompt includes the `/research`-before-guessing instruction
- [ ] **Parallelization Mandate followed:** collision-safe tasks spawned simultaneously — minimum 5 agents when 5+ available; no sequential runs of collision-safe work
- [ ] Collision check performed before each wave (compared file paths across task Steps sections)
- [ ] Proceed with maximum efficiency and groundedness
