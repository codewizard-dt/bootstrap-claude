---
topic: "Recent hook changes to Serena MCP health-checking appear to be causing Serena's MCP server to disconnect mid-session, almost every session"
slug: serena-mcp-disconnect
researched: 2026-07-07
---

# Primary Sources — Serena MCP server disconnects mid-session

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/hooks/lib/serena.js` (post-`5752eed`, lines 375–510) | 2026-07-07 | `classifySerenaFailure()`, `isSerenaProcessAlive()`, `attemptSerenaRestart()`, `shouldEnforceSerena()`, state-file read/write functions — the core misclassification + kill logic |
| S2 | codebase | `lib/hooks/serena-usage-tracker.js` (full file) | 2026-07-07 | `handleSuccess()`/`handleFailure()` — how a Serena tool failure drives classification, restart, and fail-open; confirms unsynchronized `readStateFile → mutate → writeStateFile` |
| S3 | codebase | `lib/hooks/serena-first-read-guard.js` (full file) | 2026-07-07 | Gate 1 (`warmup_done`) / Gate 4 / Gate 5 logic — shows a fresh session blocks the first code `Read` until a Serena nav call succeeds, and only skips enforcement if `shouldEnforceSerena()` is false |
| S4 | codebase | `~/.claude/settings.json` — `hooks.PostToolUse` / `hooks.PostToolUseFailure` entries | 2026-07-07 | Confirms `serena-usage-tracker.js` is wired to both events with matcher `mcp__serena__.*\|mcp__plugin_[^_]+_serena__.*` |
| S5 | codebase | `.serena/project.yml` (bootstrap-claude) | 2026-07-07 | `languages: [bash, markdown, yaml]` — confirms `typescript`/`javascript` is NOT enabled for this project despite `lib/hooks/*.js`, `lib/scripts/*.js`, `bin/cli.js` being real JS code |
| S6 | codebase (live reproduction) | `mcp__serena__get_symbols_overview` tool_response, this session | 2026-07-07 | Verbatim error: `ValueError: Cannot extract symbols from file lib/hooks/lib/serena.js. Active languages: ['bash', 'markdown', 'yaml']` — the exact trigger, reproduced 3× in parallel against `lib/hooks/lib/serena.js`, `lib/hooks/serena-session-reset.js`, `lib/hooks/serena-usage-tracker.js` |
| S7 | tool output (live reproduction) | System reminder immediately following S6, this session | 2026-07-07 | `"The following MCP servers have disconnected: serena"` and the full list of `mcp__serena__*` tools becoming unavailable — the disconnect event itself, observed in real time right after the ValueError batch |
| S8 | shell (live reproduction) | `ps aux \| grep -i serena` output, this session | 2026-07-07 | No `serena start-mcp-server ... /Users/davidtaylor/Repositories/bootstrap-claude` process present; sibling processes `... /Users/davidtaylor/Repositories/portfolio_v2` and `... /Users/davidtaylor/Repositories/gauntlet/demand-letter` are alive and running — proves the kill was scoped to exactly this project, not a global outage |
| S9 | filesystem (live reproduction) | `~/.claude/state/lsp-ready-6d7a97f1dd99` (md5 of `/Users/davidtaylor/Repositories/bootstrap-claude`, first 12 hex chars) | 2026-07-07 | `health.last_error` matches S6 verbatim; `health.healthy: false`; `health.error_count: 2` (not 3 — a lost write); `health.should_enforce: true` — the inconsistent post-race state that re-armed enforcement despite the process being dead |
| S10 | codebase | `lib/hooks/serena-session-reset.js` (full file) | 2026-07-07 | `SessionStart` hook wipes the per-project state file (`nav_count`/`warmup_done` reset to zero) every new session — the reason Gate 1 is live at the very start of every session, when the first-file-is-JS trigger is most likely to fire |
| S11 | codebase | `git log --oneline -20 -- lib/hooks/` and `git show --stat 5752eed` | 2026-07-07 | Confirms commit `5752eed` ("Add Serena health tracking with fail-open enforcement, project-scoped guards, and hook consolidation", 2026-07-06) is the commit that introduced the health-tracking/restart machinery being investigated |
| S12 | Auto Memory | `hooks/serena-health-tracking` memory file | 2026-07-07 | Corroborates the design intent and self-acknowledged limitation: *"There is NO documented way to reconnect a stdio MCP server mid-session; 'restart' is best-effort only. Fail-open + success-based recovery is the guaranteed path."* — confirms the author already knew restarts can't truly succeed, which sharpens why triggering the kill on a false premise is the critical defect |

## Excerpts

### S1 — `lib/hooks/lib/serena.js`
`/Users/davidtaylor/Repositories/bootstrap-claude/lib/hooks/lib/serena.js` (lines 449–509)
> ```
> function classifySerenaFailure(errorPayload) {
>   ...
>   // Unknown ⇒ transport (assess health rather than silently ignore).
>   return 'transport';
> }
> ...
> /**
>  * Best-effort restart of a hung Serena server for `projectDir`: if a process
>  * exists it is (presumably hung) killed, we wait ~1s, then re-probe. Returns
>  * whether a live process remains afterwards. Never throws; budget < ~2s.
>  * There is no documented way to reconnect a stdio MCP server mid-session, so
>  * a successful "restart" only happens if the host respawns the process.
>  */
> function attemptSerenaRestart(projectDir) {
>   try {
>     if (isSerenaProcessAlive(projectDir)) {
>       try { execSync(`pkill -f '${serenaProcPattern(projectDir)}'`, { stdio: 'pipe' }); } catch {}
>       try { execSync('sleep 1'); } catch {}
>     }
>     return isSerenaProcessAlive(projectDir);
>   } catch {
>     return false;
>   }
> }
> ```

### S6 — Live reproduction: the ValueError trigger
Tool result from `mcp__serena__get_symbols_overview` on `lib/hooks/lib/serena.js`, this session, 2026-07-07
> `Error executing tool get_symbols_overview: ValueError: Cannot extract symbols from file lib/hooks/lib/serena.js. Active languages: ['bash', 'markdown', 'yaml']`

### S7 — Live reproduction: the disconnect notice
System reminder, this session, immediately after S6, 2026-07-07
> "The following MCP servers have disconnected. Their instructions above no longer apply: serena"
> "The following deferred tools are no longer available (their MCP server disconnected). Do not search for them — ToolSearch will return no match: mcp__serena__..." (full tool list)

### S8 — Live reproduction: process list
`ps aux | grep -i serena | grep -v grep`, this session, 2026-07-07
> ```
> ...python .../bin/serena start-mcp-server --context claude-code --project /Users/davidtaylor/Repositories/portfolio_v2
> ...python .../bin/serena start-mcp-server --context claude-code --project /Users/davidtaylor/Repositories/gauntlet/demand-letter
> ```
> (No entry for `/Users/davidtaylor/Repositories/bootstrap-claude`.)

### S9 — Live reproduction: corrupted health state
`~/.claude/state/lsp-ready-6d7a97f1dd99`, read this session, 2026-07-07
> ```json
> "health": {
>   "should_enforce": true,
>   "healthy": false,
>   "error_count": 2,
>   "last_error": "Error executing tool get_symbols_overview: ValueError: Cannot extract symbols from file lib/hooks/serena-usage-tracker.js. Active languages: ['bash', 'markdown', 'yaml']",
>   "last_check": 1783446017493,
>   "notified": false
> }
> ```

### S12 — Auto Memory: `hooks/serena-health-tracking`
`~/.claude/projects/-Users-davidtaylor-Repositories-bootstrap-claude/memory/hooks_serena-health-tracking.md` (read via `mcp__serena__read_memory`), 2026-07-07
> "There is NO documented way to reconnect a stdio MCP server mid-session; 'restart' is best-effort only. Fail-open + success-based recovery is the guaranteed path."
