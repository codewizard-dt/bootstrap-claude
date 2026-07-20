---
id: serena-health-tracking-hook
title: "Serena Health-Tracking Hook"
aliases: [classifySerenaFailure, attemptSerenaRestart, Serena fail-open enforcement]
updated: 2026-07-07
sources:
  - ../../../raw/research/serena-mcp-disconnect/index.md
  - ../../../raw/research/serena-mcp-disconnect/sources.md
tags: [hooks, serena, reliability, bug]
---

# Serena Health-Tracking Hook

This repo's own fail-open health-tracking system for the Serena MCP server, added 2026-07-06 in commit `5752eed` ("Add Serena health tracking with fail-open enforcement, project-scoped guards, and hook consolidation"). Lives in `lib/hooks/lib/serena.js` (shared helper: `classifySerenaFailure`, `isSerenaProcessAlive`, `attemptSerenaRestart`, per-project JSON state file at `~/.claude/state/lsp-ready-<md5(cwd)>`) and `lib/hooks/serena-usage-tracker.js` (the `PostToolUse`/`PostToolUseFailure` hook that drives it). Mirrored to `~/.claude/hooks/` by `install-global.sh`, so it applies across every project, not just this repo. `lib/hooks/serena-first-read-guard.js`, `serena-session-reset.js`, and the other SERENA-FIRST guards all gate on the `should_enforce` flag this system maintains.

**Intended contract**: assume Serena is healthy (zero happy-path overhead); on a Serena tool failure, classify it as tool-level (bad query, server fine — keep enforcing) or transport-level (process down — assess and possibly disable enforcement); recover automatically on the next success.

**Bug found** (`derived_from::[[Research: Serena MCP server disconnects mid-session]]`, reproduced live): the classifier's default for unrecognized error strings is `'transport'`, and the transport-branch handler `attemptSerenaRestart()` `pkill`s the process whenever it finds one still alive after a failure — but a process that answered (even with an error) is provably not hung, so this fires on ordinary, expected tool-level errors and kills a healthy server. See `relates_to::[[Responded Error Proves Liveness]]` for the general anti-pattern. A second, compounding bug: the per-project state file is read-modified-written with no locking, so concurrent Serena tool calls can race and leave the enforcement flag (`should_enforce: true`) inconsistent with the actual (dead) process state — hard-blocking even the Read/Bash fallback this system is supposed to open up. Both bugs were caught live in the same research session that documents them, with process-list and state-file evidence.

**Status as of 2026-07-07**: bugs identified and documented with a concrete fix recommendation (stop killing on a responded error; default unknown failures to tool-level, not transport; atomicize the state-file writes); not yet patched in the codebase. `wiki/work/tasks/` should be checked for a filed fix task before assuming this is still open.
