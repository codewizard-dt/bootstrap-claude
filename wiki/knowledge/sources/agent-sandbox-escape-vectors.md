---
id: agent-sandbox-escape-vectors
title: "Research: Agent Sandbox-Escape Vectors Relevant to Claude Code"
aliases: [sandbox escape research, persistence vectors research, agent escape vectors]
updated: 2026-07-29
sources:
  - ../../../raw/research/agent-sandbox-escape-vectors/index.md
confidence: ambiguous
tags: [security, claude-code, permissions, sandbox, threat-model]
superseded_by: [bypass-mode-enforcement]
---

# Research: Agent Sandbox-Escape Vectors Relevant to Claude Code

Threat-model survey (researched 2026-07-29) of the persistence and code-execution primitives an agent like Claude Code can be driven into, and — for each — which control actually addresses it. The framing claim: **Claude Code's permission system is a string-matching allow/ask/deny layer enforced by the CLI, not by the model and not by the OS.** Almost every "sandbox escape" in the report is really a persistence primitive reachable through the Bash tool once any permissive `Bash(...)` rule exists. relates_to::[[claude-code-permission-system]]

**Verified rule syntax.** The report pins down, against official docs, the four path-prefix types (`//` absolute, `~/` home, `/` anchored at the *settings source*, bare/`./` relative to cwd), the "first match in deny → ask → allow order wins, specificity is irrelevant" precedence, and the load-bearing authoring gotcha for this repo: a rule in **user settings** with a single leading slash anchors at `~/.claude/`, not at the filesystem root. It also establishes that only `Edit(path)` and `Read(path)` rules are consulted — `Write`, `NotebookEdit`, `Glob`, and `MultiEdit` path rules are accepted and then silently ignored with a startup warning. Symlinks are checked on both the link and its target, and **deny fires if either matches**, which is what makes deny rules extend through symlink escapes. These facts live on relates_to::[[claude-code-permission-system]].

**Bypass classes.** Eight classes (B1–B8) are catalogued: command chaining, interpreter indirection (`bash -c`, `python -c`, `node -e`), dev-runner wrappers (`devbox run`, `npx`, `docker exec`), wrapper stripping, absolute-path invocation (`/bin/rm` vs `rm`), quoting/variable indirection, the alternate PowerShell tool, and argument injection through a whitelisted command (CVE-2025-54795). The unifying conclusion is the organizing principle of this whole research cluster: derived_from::[[deny-matches-a-spelling-not-a-capability]].

**Vectors and controls.** Nine vectors (C1–C9) are enumerated with a per-vector control matrix — shell-profile persistence, launchd/cron/at, `curl | sh`, the repo's own `.env` source-vs-read gap, git `core.fsmonitor`/buried-bare-repo execution, `DYLD_INSERT_LIBRARIES`/`LD_PRELOAD`, self-modification of `~/.claude/settings.json` and hooks, `osascript`/Apple Events, and symlink escapes. Catalogued on relates_to::[[agent-persistence-vectors]]. The recommendation is a layered posture — path deny rules, then a PreToolUse hook for command *classes*, then the OS sandbox as the only real boundary: implements::[[three-tier-agent-control-model]], with uses::[[claude-code-sandbox]] as tier 3. Directly drives implements::[[TASK-026]] (tier 1, the deny list) and implements::[[TASK-027]] (tier 2, the hooks).

> **Contradiction:** this report claims (§C7, `raw/research/agent-sandbox-escape-vectors/index.md:107`) that "**`bypassPermissions` mode still gates writes to `.claude`**". The later research report contradicts::[[bypass-mode-enforcement]] (`raw/research/bypass-mode-enforcement/index.md`) disproves it: Claude Code's built-in protected-path list (`.claude`, `.gitconfig`, `.zshrc`, `.zshenv`, `.npmrc`, `.mcp.json`) is **Allowed** under `bypassPermissions` — the built-in protection disappears in exactly that mode. Report 3 supersedes this page on that single point; the durable form of the correction lives on superseded_by::[[permission-mode-control-survival]]. `confidence: ambiguous` on this page reflects that one flagged claim, not the rest of the report, which is otherwise directly extracted.
