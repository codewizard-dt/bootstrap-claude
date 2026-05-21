---
name: power-mode
description: Reference guide for running agent teams with bypassed permissions in a dev container — covers CLI flags, Agent tool mode param, and per-agent frontmatter
model: claude-sonnet-4-6
argument-hint: ""
disable-model-invocation: false
user-invocable: true
---

# Agent Permissions — Headless Multi-Agent Runs

Use this skill whenever you need to spawn an agent team (orchestrator + sub-agents) inside a dev container without permission prompts.

---

## The core problem

`--dangerously-skip-permissions` on the **parent** CLI does **not** propagate to sub-agents. Each agent process has its own permission context. There is no global "cascade" setting — you must configure every layer explicitly.

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

## Layer 2 — Sub-agents spawned via the Agent tool (no `.md` file)

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

## Mandatory rule for all sub-agent spawning

**Whenever you spawn any sub-agent using the Agent tool — regardless of the skill or context — you MUST include `mode: "bypassPermissions"` on every call.** This is not optional in power-mode runs; omitting it causes the sub-agent to prompt for permissions and block headless execution.

---

## Canonical pattern for this project's `/now` skill

When `/now` or `/tackle` spawns sub-agents for a headless team run, every `Agent(...)` call must include `"mode": "bypassPermissions"`:

```
Agent({
  description: "Tackle task 065",
  prompt: "...",
  mode: "bypassPermissions",
  subagent_type: "claude"
})
```

---

## What does NOT work

- Setting `"defaultMode": "bypassPermissions"` in `.claude/settings.json` — does not cascade to sub-agents.
- `skipDangerousModePermissionPrompt: true` in settings — only suppresses the one-time confirmation prompt, does not enable bypass mode or affect sub-agents.
- The parent's `--dangerously-skip-permissions` CLI flag alone — only covers the parent process.

Tracked upstream: GitHub issues #40241, #37442, #58663.

---

## Quick checklist

- [ ] Parent process started with `--dangerously-skip-permissions` or `--permission-mode bypassPermissions`
- [ ] Every `Agent(...)` call includes `"mode": "bypassPermissions"`
- [ ] Any named agent `.md` files include `permissionMode: bypassPermissions` in frontmatter
