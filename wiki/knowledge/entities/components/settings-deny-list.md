---
id: settings-deny-list
title: Canonical Settings Deny List
aliases: [settings-deny.json, deny list, merge-settings-deny]
updated: 2026-07-29
sources:
  - ../../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../../raw/research/deny-rules-vs-hooks/index.md
  - ../../../../raw/research/bypass-mode-enforcement/index.md
confidence: extracted
tags: [component, security, permissions, deny-list, bootstrap]
---

# Canonical Settings Deny List

`lib/scripts/templates/settings-deny.json` — the deny rules this repo merges into every developer's `~/.claude/settings.json`. Merging is done by `lib/scripts/merge-settings-deny.js`, invoked from `install-global.sh`, and is **additive-only**: it never removes a user's existing rules. This is tier 1 of relates_to::[[three-tier-agent-control-model]].

**These rules are enforced in every permission mode**, `bypassPermissions` included — the premise that once blocked this work (that bypass nullifies deny) is false. Better still, the built-in protected-path guard that partially covers `.claude`/`.zshrc`/`.npmrc` in other modes is **switched off** under bypass, so the self-modification and shell-profile entries here have their highest marginal value in exactly the mode they were feared useless in. See supersedes::[[permission-mode-control-survival]] for the full matrix. This file is also **merged with `sandbox.filesystem` into a single boundary**, so it strengthens rather than duplicates uses::[[claude-code-sandbox]].

**Current state (2026-07-29, after implements::[[TASK-026]]):** 118 entries — 93 `Bash(...)`, 13 `Edit(...)`, 12 `Read(...)`, and **zero `Write(...)`**, up from 36 before the audit. The zero-`Write` count is not incidental: `Write(path)` rules are accepted at load and then never consulted, so any `Write(...)` entry here would be decorative. See relates_to::[[claude-code-permission-system]].

**Authoring rules this file must obey**, all derived from the research:

- **`Edit(...)`, never `Write(...)`** — the only path rules Claude Code consults are `Edit(path)` and `Read(path)`.
- **`~/` or `//` prefixes only for out-of-project paths.** This file lands in *user settings*, where a single leading slash anchors at `~/.claude/`, not the filesystem root. `Edit(/Users/alice/.zshrc)` would silently protect `~/.claude/Users/alice/.zshrc`.
- **Both spellings for command denies.** `Bash(rm *)` does not block `/bin/rm`; enumerate the absolute path too, or accept that this row is hook territory.
- **Mirror sensitive Bash denies with `PowerShell(...)`** — when Bash is denied, Claude Code has been observed switching to the PowerShell tool to run the equivalent. *Not yet done in the current file — no `PowerShell(...)` entries exist.*
- **Never a pipe-containing pattern.** `Bash(curl * | sh*)` can never match, because rules are matched against subcommands and a subcommand never contains its own separator. There is **no startup warning** for this, so a dead rule ships silently — keep an explanatory comment in the template so nobody re-proposes them. Ship the *targets* instead: bare-interpreter denies (`Bash(sh)`, `Bash(bash)`, `Bash(python)`, …) match the pipe's right-hand subcommand, and process-substitution denies (`Bash(bash <*)`, `Bash(sh <*)`, …) match directly. derived_from::[[per-subcommand-decomposition]]
- **No rule can carry an exception**, deny or ask. If a needed carve-out exists (e.g. permitting `oraios/serena` under `uvx --from git+*`), the rule cannot be a deny — route it to `ask` or to a hook. relates_to::[[consent-requires-a-yes-path]]

**Sibling `ask` list (planned).** The research recommends a `lib/scripts/templates/settings-ask.json` of the same flat-array shape for package installs (`Bash(npm install *)`, `Bash(pip install *)`, `Bash(uvx --from git+*)`, …), delivered by generalizing `merge-settings-deny.js` with a `--key` argument (~15 lines; the target key is hardcoded in exactly one place, line 84) and calling it twice from `install-global.sh`. Deliberately **under-ship** the initial set: the merge is additive-only with **no removal path**, so anything merged into a user's settings is permanent from the tooling's side.

**What it covers.** Shell-profile writes (`Edit(~/.zshrc)`, `~/.zshenv`, `~/.bashrc`, `~/.bash_profile`, `~/.profile`), the self-modification surface (`Edit(~/.claude/settings*.json)`, `Edit(~/.claude/hooks/**)`, `Edit(**/.claude/settings*.json)`, `Edit(**/.claude/hooks/**)`), LaunchAgents, credential reads (`Read(~/.ssh/**)`, `Read(~/.aws/credentials)`, `Read(**/.env)`), and the deny-addressable command spellings (`crontab`, `launchctl`, `at`, `osascript`, `curl`, `wget`). Vector-by-vector mapping: relates_to::[[agent-persistence-vectors]].

**What it explicitly does not do.** It is defense-in-depth, not a boundary — derived_from::[[deny-matches-a-spelling-not-a-capability]]. Interpreter indirection, pipelines, variable indirection, and any subprocess that opens a file itself walk straight past it. Those belong to the tier-2 hooks in relates_to::[[bootstrap-claude-hooks]] (implements::[[TASK-027]], still `todo`) and to uses::[[claude-code-sandbox]]. Note the reach limit that also *reduces* friction: rules only see commands Claude types into a Bash tool call, so this repo's own script-internal `npm install -g @playwright/mcp@latest` (`install-mcps.sh:197`) and `uvx --from git+…` (`bootstrap-serena.sh:35`) are subprocesses and unaffected. Any guide shipped alongside this file must say so, because a 118-entry deny list is exactly the artifact that produces false confidence.

Where the tier-1/tier-2 line is drawn per rule: relates_to::[[deny-rules-vs-hooks]]. Why one rule can match half a command line: relates_to::[[per-subcommand-decomposition]]. Which of these survive a mode change: relates_to::[[permission-mode-control-survival]].
