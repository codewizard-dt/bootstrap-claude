---
id: permission-mode-control-survival
title: Control Survival Across Permission Modes
aliases: [control-survival matrix, what survives bypass, bypassPermissions enforcement, protected paths]
updated: 2026-07-29
sources:
  - ../../../raw/research/bypass-mode-enforcement/index.md
  - ../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../raw/research/deny-rules-vs-hooks/index.md
confidence: ambiguous
supersedes: [agent-sandbox-escape-vectors]
tags: [security, claude-code, permissions, bypass, sandbox, hooks]
---

# Control Survival Across Permission Modes

The single most decision-relevant table in this repo's agent-hardening research: **which controls still enforce when the permission mode is turned down**, especially under `--dangerously-skip-permissions` (`bypassPermissions`).

| Control | `default` | `acceptEdits` | `bypassPermissions` |
|---|---|---|---|
| `permissions.deny` | Enforced | Enforced | **Enforced** — "apply in every mode" |
| `permissions.ask` | Prompts | Prompts | **Prompts** — explicitly exempted from bypass |
| `permissions.allow` | Pre-approves | Pre-approves | **No effect** — everything is already approved |
| PreToolUse hook, exit 2 | Blocks | Blocks | **Blocks** — runs on every tool call, before permission rules are evaluated |
| **Built-in protected paths** (`.claude`, `.git`, `.gitconfig`, `.zshrc`, `.zshenv`, `.zprofile`, `.bashrc`, `.bash_profile`, `.profile`, `.envrc`, `.npmrc`, `.mcp.json`, `.claude.json`) | Prompted | Prompted | **Allowed — protection gone** |
| `rm -rf /` / `rm -rf ~` circuit breaker | Prompts | Prompts | Prompts (incl. inside `$(…)`/`<(…)` since v2.1.208) |
| `/sandbox` (Seatbelt / bubblewrap) | OS-enforced | OS-enforced | **OS-enforced — independent of permission mode** |
| Managed settings | Highest precedence | Highest precedence | Highest precedence |
| `CLAUDE.md` prose | No enforcement | No enforcement | No enforcement |

*(`dontAsk` mode is the one place protected-path writes are **denied** rather than prompted, and where `ask` rules become denials.)*

## The counter-intuitive part

The instinct is that bypass mode erases user-authored controls and leaves only built-in safety. **It is the reverse.** Deny rules, ask rules, hooks, and the sandbox all survive; the thing that disappears is Claude Code's own built-in protected-path guard. A `permissions.deny` entry is therefore the *only* user-authorable control still covering `~/.claude/settings.json`, `~/.claude/hooks/**`, and `~/.zshrc` under bypass.

The practical consequence for relates_to::[[settings-deny-list]] is that its two highest-value groups — the settings/hooks self-modification lock and the shell-profile lock — have their **highest marginal value in exactly the mode they were feared to be useless in**. Calling the deny list "real but partial protection for interactive sessions" is precisely backwards. Note also that `permissions.allow` cannot re-open a protected path even in modes that prompt: the safety check runs *before* allow rules are evaluated.

> **Contradiction:** the earlier research report contradicts::[[agent-sandbox-escape-vectors]] claims (§C7, `raw/research/agent-sandbox-escape-vectors/index.md:107`) that "**`bypassPermissions` mode still gates writes to `.claude`**". The later report supersedes::[[bypass-mode-enforcement]] (`raw/research/bypass-mode-enforcement/index.md`, Key Findings §3) disproves it against the official per-mode table: protected-path writes are **Allowed** under `bypassPermissions`. Report 3 supersedes report 1 on this point, and the table above is the corrected form. `raw/` is immutable, so the source report is left unedited by design. The same report also documents that this repo's own `lib/hooks/README.md:14-19` and `:311-312` assert the opposite error in the other direction — that deny rules are *not* enforced under bypass — which is likewise false and is scheduled for correction under implements::[[TASK-026]].

## Reliability caveats worth carrying

- **Hooks under bypass**: two GitHub issues (#20946, #47810) report PreToolUse hooks firing asynchronously — exit 2 returning *after* the tool call landed, five `git commit`s succeeding despite denials — or silently ceasing after a background task completes. Both are **closed, unconfirmed, on very old builds** (v2.1.19, v2.1.107 vs. current ~v2.1.219). Treat as low-confidence historical noise, but never make a hook the *sole* control for something a deny rule could also cover.
- **`ask` in a headless run**: `ask` rules survive bypass and still prompt — but in a non-interactive `-p` session there is nobody to answer. The docs do not state the resolution. See the open question below.

> **Contradiction (open):** relates_to::[[bypass-mode-enforcement]] recommends a **hook** for package-install consent, arguing that an `ask` rule in a headless `-p` bypass run "has nobody to answer" and becomes a hang or an effective hard block *(the report marks this as inference — no primary source)*. The later report contradicts::[[deny-rules-vs-hooks]] recommends `permissions.ask` and explicitly says not to build a hook for it, on the grounds that `ask` cannot be silenced and a hook cannot relax it anyway — but it does not address the headless case. **Unresolved.** The reconciliation that fits both: `ask` for interactive sessions, and the headless `power-mode` / `uat-auto-plus` path is exactly where tier 3 (`/sandbox`) is the answer rather than either rule. Carried on relates_to::[[consent-requires-a-yes-path]].

## This repo's bypass surface

Bypass is not hypothetical here — it is wired into five places: `lib/skills/power-mode/SKILL.md` (every spawned subagent MUST use `mode: "bypassPermissions"` — the largest surface), `lib/skills/uat-auto-plus/SKILL.md`, and three scripts invoking `claude -p --dangerously-skip-permissions` (`setup-strict-typechecks.sh:28`, `setup-deployment.sh:104`, `migrate-project.sh:228`).

That inventory decides the lockdown options. `disableBypassPermissionsMode: "disable"` **works from any scope** — a solo developer can self-lock without MDM — but must not be set here, because it would break all five. Managed settings are likewise self-applicable (macOS `/Library/Application Support/ClaudeCode/`, one `sudo tee`; not MDM-only), but two of the three keys are traps: `allowManagedPermissionRulesOnly` would silently nullify every rule in `~/.claude/settings.json`, and `allowManagedHooksOnly` would disable every hook this repo installs. The right move for the bypass path is uses::[[claude-code-sandbox]] — see relates_to::[[three-tier-agent-control-model]].
