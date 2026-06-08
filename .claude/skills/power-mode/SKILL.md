---
name: power-mode
description: Reference guide for running agent teams with bypassed permissions in a dev container — covers CLI flags, Agent tool mode param, and per-agent frontmatter. When invoked with a single roadmap file path and no other instructions, acts as a goal-driven orchestrator that drives the roadmap to 100% completion.
model: claude-sonnet-4-6
argument-hint: "[roadmap-file-path]"
disable-model-invocation: false
user-invocable: true
---

# Agent Permissions — Headless Agent Team Runs

Use this skill whenever you need to run an agent team (orchestrator + team members) inside a dev container without permission prompts.

---

## Roadmap-to-Completion Orchestrator

**Trigger:** `/power-mode <path/to/ROADMAP-NNN.md>` with no additional instructions.

**Goal:** Drive the roadmap to 100% completion — all checklist items checked — by looping through waves of parallelizable work until nothing remains.

### Orchestrator loop

Run this loop until `/roadmap-next <file>` reports no unchecked items:

**Step 1 — Get the next wave**

Invoke `/roadmap-next <file>` to identify the next group of parallelizable unchecked items.

**Step 2 — Materialize inline placeholders**

For any item that is an inline placeholder (no existing task file link), spawn a task-creation agent:

```
Agent({
  description: "Create task for <item>",
  prompt: "Run /task-add for this roadmap item: '<item description>'. Link the resulting task back into the roadmap file at .docs/roadmaps/<file>.

/research your task. You are running autonomously — make all scope, naming, and structuring decisions yourself without asking questions. Infer reasonable defaults from the roadmap context and existing task files in .docs/tasks/.

IMPORTANT: Follow .docs/guides/mcp-tools.md for all file and code operations. Use Serena (mcp__serena__*) for ALL file/directory exploration and ALL code editing. Never use ls, cat, find, grep, sed, awk, or any shell command to inspect or modify files.",
  mode: "bypassPermissions"
})
```

Wait for all task-creation agents to complete before proceeding.

**Step 3 — Three-phase pipeline for the wave**

Run the full tackle → UAT-generate → UAT-auto pipeline (see below) for all tasks in the current wave.

> **Note on `/uat-auto` behavior:** `/uat-auto` does not run UI tests — they are always recorded as `[FAIL: auto-judge: UI test requires human verification]` and require a subsequent `/uat-walk`. If stub indicators are detected in the implementation, those tests remain pending (`FAIL: auto-judge: Stub detected - implementation required`) and the task stays in `.docs/tasks/` until the feature is implemented and re-tested.

**Step 4 — Repeat**

Return to Step 1. Continue until `/roadmap-next` confirms the roadmap is fully checked off.

### Minimal orchestrator prompt (for nested orchestrators)

When you need to hand this off to a sub-orchestrator agent, use this compact brief:

```
Agent({
  description: "Drive <ROADMAP-NNN> to completion",
  prompt: "Your goal is to drive the roadmap at <path> to 100% completion.

Loop until all items are checked:
1. Run /roadmap-next <path> to get the next parallelizable wave.
2. For inline placeholders, run /task-add and link the task into the roadmap. Make all scope, naming, and structuring decisions autonomously — infer reasonable defaults from the roadmap context and existing task files; never ask clarifying questions.
3. Run the three-phase pipeline: /tackle each task (parallel per wave) → /uat-generate each completed task (parallel) → /uat-auto each UAT file (sequential per file). After each all-pass UAT run, verify that both the UAT file and task file were moved to their completed/ directories and the task row was removed from .docs/tasks/README.md — if not, do it now before proceeding.
4. Repeat from step 1.

Stop only when /roadmap-next reports no unchecked items.

IMPORTANT: Follow .docs/guides/mcp-tools.md for all file and code operations. Use Serena (mcp__serena__*) for ALL file/directory exploration and ALL code editing. Never use ls, cat, find, grep, sed, awk, or any shell command to inspect or modify files.

IMPORTANT: If at any point you are not 100% sure how to fix an issue or which implementation strategy to use, invoke /research first and act on its recommendation before proceeding.

IMPORTANT: /uat-auto does not run UI tests — they always record as [FAIL: auto-judge: UI test requires human verification] and require a manual /uat-walk after the automated run. Do not treat these failures as blocking task completion. If stub-detected tests remain pending after /uat-auto, the task is not complete — the feature must be implemented first.",
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

### Phase 1 — Tackle (agent team, parallel where safe)

Assemble one agent team member per task using `/tackle`. Tasks in the same dependency wave (from `/roadmap-next`) can run concurrently; tasks that depend on each other must run sequentially.

```
Agent({ description: "Tackle TASK-NNN", prompt: "...", mode: "bypassPermissions" })
Agent({ description: "Tackle TASK-MMM", prompt: "...", mode: "bypassPermissions" })
```

Wait for **all** team members to complete before proceeding.

### Phase 2 — Generate UAT tests (clear context first)

After all team members finish, **reset context** (`/clear` or start a fresh agent) before generating UAT files. This prevents stale implementation details from polluting the test-generation prompt.

Invoke `/uat-generate <task_path>` for each completed task (can be parallelized — UAT generation is read-only):

```
Agent({ description: "UAT generate TASK-NNN", prompt: "/uat-generate .docs/tasks/NNN-slug.md", mode: "bypassPermissions" })
```

Wait for all UAT generation to complete.

### Phase 3 — Run UATs autonomously (clear context first)

**Reset context again** before running tests. Then invoke `/uat-auto` for each generated UAT file:

```
Agent({
  description: "UAT auto TASK-NNN",
  prompt: "/uat-auto .docs/uat/NNN-slug.md

CRITICAL: After all tests pass you MUST complete Step 7 in full before stopping:
1. git mv the UAT file to .docs/uat/completed/
2. git mv the task file to .docs/tasks/completed/
3. Remove the task row from .docs/tasks/README.md
4. Flip the matching roadmap checkbox and update the task path in the roadmap
Do not stop after emitting the summary — the file moves are mandatory.

IMPORTANT: If any tests remain as [FAIL: auto-judge: UI test requires human verification] after the run, that is expected behavior — /uat-auto does not run UI tests. Those tests require a human walkthrough via /uat-walk.

IMPORTANT: If any tests remain as - [ ] Pass because stub indicators were detected in the implementation, do NOT mark the task as complete. Leave the UAT file in .docs/uat/ and report the stub-detected tests in your summary. The task cannot be considered done until the stubs are implemented and the tests pass.",
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
- [ ] Always parallelize tasks that do not collide, including during /tackle and /uat-auto phases
- [ ] Proceed with maximum efficiency and groundedness
