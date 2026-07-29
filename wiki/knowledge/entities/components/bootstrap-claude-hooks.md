---
id: bootstrap-claude-hooks
title: lib/hooks — Project-Managed Hook Scripts
aliases: [lib/hooks, PreToolUse hooks, bootstrap hooks]
updated: 2026-07-29
sources:
  - ../../../../raw/research/deny-rules-vs-hooks/index.md
  - ../../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../../raw/research/bypass-mode-enforcement/index.md
confidence: extracted
tags: [component, hooks, security, bootstrap, tier-2]
---

# `lib/hooks` — Project-Managed Hook Scripts

The 12 hook scripts this repo installs to `~/.claude/hooks/` via `install-global.sh` — the Serena-first guards (`serena-first-guard.js`, `serena-edit-guard.js`, `serena-bash-grep-block.js`, `serena-write-guard.js`, `serena-first-read-guard.js`, `serena-first-glob-guard.js`, `serena-pre-delegation.js`, `serena-session-reset.js`, `serena-usage-tracker.js`) plus `env-file-guard.js`, `git-protected-ops-block.js`, and `mv-absolute-path-block.js`. This is tier 2 of relates_to::[[three-tier-agent-control-model]] — the only layer that can gate a command *class* rather than a spelling.

## The hook contract

- **Input**: `tool_input.command` carries the **raw, undecomposed** command string, exactly as Claude will execute it. This is the one place a hook structurally beats a permission rule — it can see the pipeline *shape* (`curl … | sh`) that rules cannot, because rules match after relates_to::[[per-subcommand-decomposition]] has already split it.
- **Blocking**: exit code 2 blocks the call; stderr is fed back to Claude as an error.
- **Structured output**: `hookSpecificOutput.permissionDecision` accepts `"allow" | "deny" | "ask" | "defer"` with a `permissionDecisionReason` (goes to Claude), and a top-level `systemMessage` (goes to the **user**). So a hook can deny-with-explanation rather than blocking silently.

## The stated rationale in `lib/hooks/README.md` is wrong

`lib/hooks/README.md:14-19` states *"The permissions `deny` list is **not consulted** when an agent runs in `bypassPermissions` mode"*, and `:311-312` repeats *"Deny rules are **not enforced** in `bypassPermissions` mode — that is exactly why these hooks exist."* **Both are false.** Deny rules apply in every mode including bypass; hooks also run in every mode. The rationale for the entire hooks directory rests on a false premise and actively misleads anyone deciding where to invest effort. Correction is scheduled under implements::[[TASK-026]]. relates_to::[[permission-mode-control-survival]]

The hooks remain fully justified — for a better reason. **Deny matches a literal command spelling; a hook parses the command.** That limitation is mode-independent, and the docs endorse the split directly: *"To run all Bash commands without prompts except for a few you want blocked, add `\"Bash\"` to your allow list and register a PreToolUse hook that rejects those specific commands."* Hooks also carry a *message* back to Claude via stderr on exit 2, which deny rules cannot. derived_from::[[deny-matches-a-spelling-not-a-capability]]

**Hooks do run under bypass** — establishable structurally rather than by a single sentence: they fire on every tool call in the agentic loop (except `EndConversation`), `PreToolUse` receives a `permission_mode` field whose documented values include `"bypassPermissions"`, and exit 2 *"stops the tool call before permission rules are evaluated"*. Honest caveat: two GitHub issues (#20946, #47810) report hooks executing asynchronously under bypass — exit 2 landing *after* the tool call completed, five `git commit`s succeeding despite denials — or silently ceasing after a background task. Both **closed and unconfirmed on very old builds** (v2.1.19, v2.1.107 vs. current ~v2.1.219). Low-confidence, but reason enough for a standing rule: **never make a hook the sole control for anything the deny list could also cover — keep both.**

## The deployment gap

`install-global.sh` **copies the scripts but does not register them** — `PreToolUse` wiring in `~/.claude/settings.json` is a documented manual one-time step (`lib/hooks/README.md`). Any user who skips it gets **zero enforcement, silently**. This is the decisive practical argument against routing a requirement through a hook when a permission rule can carry it: relates_to::[[settings-deny-list]] merges automatically from the same installer, hooks do not.

A second friction point: TASK-026 shipped `Edit(~/.claude/hooks/**)` and `Edit(~/.claude/settings.json)` denies, so hook enforcement logic now lives in a directory the agent is explicitly forbidden to touch. Good for integrity — it closes the self-modification vector in relates_to::[[agent-persistence-vectors]] — but it means hook fixes require an out-of-band `install-global.sh` re-run.

## What tier 2 should and should not carry

**Should** (only a hook can do these):

- correlating a download-then-execute pair split across two separate tool calls
- inspecting inside `python -c` / `node -e` / `bash -c` payloads
- absolute-path fetcher invocation (`/usr/bin/curl` vs `curl`)
- allowlisting `oraios/serena` while gating other `uvx --from git+` sources — a *deny* provably cannot, since deny carries no allowlist exceptions
- `DYLD_*` / `LD_PRELOAD` assignments, `git -c core.fsmonitor=` neutralization, redirects into profile/settings paths, `source`/`.` of `.env`

**Contested**: package-install consent. relates_to::[[deny-rules-vs-hooks]] says use `permissions.ask` and do not build a hook (a hook cannot relax an ask rule anyway); relates_to::[[bypass-mode-enforcement]] says use a hook, because an `ask` rule in a headless `-p` bypass run has nobody to answer, and exit-2 stderr can name the exact command for the user to run. Unresolved — the callout on derived_from::[[consent-requires-a-yes-path]] carries both positions.

Design guidance carried from the research: *warn-and-log* for medium-risk classes, *exit-2* only for high-risk, so over-broad hooks do not break legitimate workflows. The four new tier-2 hooks are specified in implements::[[TASK-027]] (`todo`).

Note that hooks are a policy layer inside the CLI, not containment — a hook decision cannot bypass a permission rule, and cannot stop a subprocess once it starts. That remains uses::[[claude-code-sandbox]].
