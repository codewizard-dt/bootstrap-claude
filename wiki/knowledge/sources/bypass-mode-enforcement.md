---
id: bypass-mode-enforcement
title: "Research: Which Claude Code controls survive --dangerously-skip-permissions"
aliases: [bypass mode research, bypassPermissions enforcement, skip-permissions research]
updated: 2026-07-29
sources:
  - ../../../raw/research/bypass-mode-enforcement/index.md
confidence: extracted
supersedes: [agent-sandbox-escape-vectors]
tags: [security, claude-code, permissions, bypass, hooks, sandbox]
---

# Research: Which Claude Code controls survive `--dangerously-skip-permissions`

Researched 2026-07-29 to unblock TASK-026, whose deny-list work was held on the premise that `bypassPermissions` nullifies deny rules. **The premise is false**, and the docs say so in one sentence: *"These controls apply in every mode, including `bypassPermissions`: deny rules and explicit ask rules"*. `permissions.allow`, by contrast, has **no effect** under bypass, because everything is already approved. Deny-first precedence is absolute and scope-independent. Full matrix on derived_from::[[permission-mode-control-survival]].

**The finding that inverts the risk assessment**: the control bypass actually destroys is Claude Code's **built-in protected-path list** — `.claude`, `.git`, `.gitconfig`, `.zshrc`, `.zshenv`, `.zprofile`, `.bashrc`, `.bash_profile`, `.profile`, `.envrc`, `.npmrc`, `.mcp.json`, `.claude.json`. Writes to those are *prompted* in `default`/`acceptEdits`, *denied* in `dontAsk`, and **allowed** under `bypassPermissions`. So a `permissions.deny` entry is the only user-authorable control still covering them there, and the deny list's two highest-value groups — the settings/hooks self-modification lock and the shell-profile lock — are worth **more** under bypass than under normal mode, not less. contradicts::[[agent-sandbox-escape-vectors]] on exactly this point.

**PreToolUse hooks run in every mode.** The docs never say it in those words but establish it structurally: hooks fire on every tool call in the agentic loop, `PreToolUse` receives a `permission_mode` input field whose documented values include `"bypassPermissions"`, and exit code 2 *"stops the tool call before permission rules are evaluated"*. Honest caveat carried forward: two GitHub issues (#20946, #47810) report hooks executing asynchronously or silently ceasing under bypass — both **closed, unconfirmed, on very old builds** (v2.1.19 / v2.1.107 vs. current ~v2.1.219). Low-confidence historical noise, but reason enough never to make a hook the *sole* control for anything the deny list could also cover. relates_to::[[bootstrap-claude-hooks]].

**The repo's own docs were wrong.** `lib/hooks/README.md:14-19` and `:311-312` assert that deny rules are "not consulted" / "not enforced" under bypass — the stated rationale for the entire hooks directory. The hooks remain justified, but for the better reason: **deny matches a literal command spelling while a hook parses the command** (`/bin/rm` vs `rm`, `bash -c`, `python -c`), and a hook can return a *message* to Claude via stderr on exit 2. relates_to::[[deny-matches-a-spelling-not-a-capability]].

**The sandbox is not a permission mode** and is unaffected by one: *"The operating system enforces the sandbox boundary on the running process, so it holds regardless of what the model chose to run."* It also merges with Read/Edit deny rules into a single boundary, so tier-1 entries strengthen rather than duplicate it. Limits: it covers Bash and its children only — Read/Edit/Write go through the permission system directly. uses::[[claude-code-sandbox]].

**Managed settings are self-applicable, not MDM-only** (macOS `/Library/Application Support/ClaudeCode/`, one `sudo tee`), but two of the three lockdown keys are traps for this repo: `allowManagedPermissionRulesOnly` would silently nullify every entry in `~/.claude/settings.json`, and `allowManagedHooksOnly` would disable every hook this repo installs. `disableBypassPermissionsMode` works from any scope — a solo developer can self-lock without MDM — but must **not** be set here, because bypass is wired into five surfaces: `power-mode` (every spawned subagent), `uat-auto-plus`, and three setup scripts (`setup-strict-typechecks.sh:28`, `setup-deployment.sh:104`, `migrate-project.sh:228`).

**Verdict:** ship the deny list unblocked (relates_to::[[settings-deny-list]], implements::[[TASK-026]]); keep the Tier-2 hook with the corrected rationale (implements::[[TASK-027]]); recommend `/sandbox` specifically for the `power-mode` / `uat-auto-plus` path, since that is the entire bypass surface. relates_to::[[three-tier-agent-control-model]].
