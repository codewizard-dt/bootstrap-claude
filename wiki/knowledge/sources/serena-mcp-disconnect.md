---
id: serena-mcp-disconnect
title: "Research: Serena MCP server disconnects mid-session"
updated: 2026-07-07
sources:
  - ../../../raw/research/serena-mcp-disconnect/index.md
  - ../../../raw/research/serena-mcp-disconnect/sources.md
tags: [serena, hooks, mcp, reliability, bug]
---

# Research: Serena MCP server disconnects mid-session

Root-cause investigation into a reported symptom: the `uses::[[Serena Health-Tracking Hook]]` (added 2026-07-06, commit `5752eed`) appears to disconnect Serena's MCP server "almost every time" a session starts. The bug was reproduced **live, in real time, during the research itself** — a strong evidentiary anchor for every claim below.

**Trigger chain**: this repo's `.serena/project.yml` enables only `bash`, `markdown`, `yaml` — not `typescript`/`javascript` — despite `lib/hooks/*.js`, `lib/scripts/*.js`, and `bin/cli.js` being real JS code. Per the global LSP-first rule, an agent's first move on any code file is `mcp__serena__get_symbols_overview`. Calling that on one of this repo's own `.js` files throws a deterministic, benign error: `ValueError: Cannot extract symbols from file <path>. Active languages: ['bash', 'markdown', 'yaml']`.

**The kill bug**: `classifySerenaFailure()` (`lib/hooks/lib/serena.js`) doesn't recognize that error string against its narrow tool-level regex, so it falls through to the documented default "Unknown ⇒ transport." The transport branch then calls `attemptSerenaRestart()`, which finds the process still alive (it just answered!) and — on the mistaken premise that "alive but erroring" means "hung" — `pkill`s it. **A responded error proves the process is alive, not hung**; see `relates_to::[[Responded Error Proves Liveness]]`. Since there is no documented way to reconnect a stdio MCP server mid-session, the kill is effectively permanent for the rest of that session.

**Empirical confirmation**: `ps aux` showed the `bootstrap-claude` Serena process gone immediately after three parallel `get_symbols_overview` failures on this repo's own hook files, while two other concurrently open projects' Serena processes were untouched — ruling out a global outage and pinning the kill to this exact hook firing.

**A second, compounding bug**: `serena-usage-tracker.js` does an unsynchronized `read → mutate → write` on the shared per-project state file (`~/.claude/state/lsp-ready-<hash>`). Three parallel failures in the same session raced: `error_count` recorded 2 instead of 3 (a lost write), and — worse — the state settled at `should_enforce: true` even though `healthy: false` and the process was confirmed dead. That inconsistent state then hard-blocked a plain `Bash ls`/`find` fallback moments later, reproducing the exact deadlock a fresh session would hit at `SessionStart` (when `nav_count`/`warmup_done` are wiped to zero and Gate 1 has no headroom to survive a bad race outcome).

## Recommendation (from the report)

Two independent fixes, both needed: (A) general hook-logic fix — never `pkill` on a responded error, flip `classifySerenaFailure`'s unknown-payload default from `transport` to `tool`, and atomicize/lock the state-file read-modify-write; (B) this-repo-specific — add `typescript` to `.serena/project.yml` so this repo's own JS surface gets real symbol support instead of a guaranteed parse failure on every navigation attempt.

See the full report at [raw/research/serena-mcp-disconnect/index.md](../../../raw/research/serena-mcp-disconnect/index.md) and its source register (including the live-reproduction evidence: process list, corrupted state file, verbatim error strings) at [sources.md](../../../raw/research/serena-mcp-disconnect/sources.md).
