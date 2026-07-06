# Serena Health Tracking & Fail-Open Enforcement (v2.8.0)

## Contract
Serena is ASSUMED HEALTHY (zero happy-path overhead). When a Serena tool call fails, health is assessed per-project; if unhealthy, a best-effort restart is attempted; if no live process remains, ALL Serena-first guards fail open (exit 0) for the rest of the session. Recovery is automatic on the next successful Serena call.

## State
Health lives inside the existing per-project state file `~/.claude/state/lsp-ready-<md5(cwd).slice(0,12)>` under a `health` key: `{ should_enforce, healthy, error_count, last_error, last_check, notified }`. Missing file/key ⇒ enforce. `serena-session-reset.js` wipes the file at SessionStart (health resets per session — correct, since MCP server lifecycle is per-session).

## Key code (lib/hooks/, mirrored to ~/.claude/hooks/ by install-global.sh)
- `lib/serena.js`: `getStateFilePath/readStateFile/writeStateFile`, `shouldEnforceSerena`, `classifySerenaFailure` ('tool' = not-found/no-results → keep enforcing; 'transport'/unknown → assess), `isSerenaProcessAlive(projectDir)` (pgrep scoped to `serena start-mcp-server` + project path), `attemptSerenaRestart` (pkill scoped + 1s + re-probe, <2s, never throws), `isOutsideProject`, `extractSymbolsFromPattern`/`isCodeSymbol(token, opts)` (unified symbol detection).
- `serena-usage-tracker.js` is the SINGLE state writer, registered under BOTH `PostToolUse` and `PostToolUseFailure` with matcher `mcp__serena__.*|mcp__plugin_[^_]+_serena__.*` (wired in ~/.claude/settings.json). Success → restores health (nav_count still gated to the 6 nav tools). Failure → classify → assess → restart → fail-open write + ONE-TIME systemMessage.
- All 7 guards call `shouldEnforceSerena(readStateFile(getStateFilePath()))` before any block decision.

## Project-root scoping (user rule, same release)
SERENA-FIRST never applies to paths outside the project root — `isOutsideProject` is wired into read/edit/write guards (file_path), Grep/Glob guards (path param), and serena-bash-grep-block.js (segment allowed when every path target escapes the project; `$VAR`-led unresolvable paths allowed for read-only exploration commands, still blocked for in-place edits).

## Gotchas
- There is NO documented way to reconnect a stdio MCP server mid-session; "restart" is best-effort only. Fail-open + success-based recovery is the guaranteed path.
- A benign empty `{}` PostToolUse tool_response is a NO-OP (not transport) — routing it to the transport path would pkill a live healthy server.
- Tool-level failures never flip `should_enforce` in either direction; only transport failures disable and only genuine successes re-enable.
- Upstream `claude-code-lsp-enforcement-kit` was deliberately NOT synced (deferred); it has diverged.

## Related same-release changes
- Skills condensed ~15-50% (suite 596KB → 515KB); UAT family shares `uat-walk/UAT-CORE.md` (Steps 1-5), referenced by uat-walk/uat-auto/uat-auto-plus via `~/.claude/skills/uat-walk/UAT-CORE.md`.
- `lib/scripts/lib.sh` (bash-3.2-safe) now holds `resolve_project_dir`, `mcp_installed`, `serena_installed`, `detect_installed_mcps`, `run_project_sync`, `prompt_yn`, `prompt_scope`; 8 setup scripts source it.
- Project-local `.claude/settings.local.json` Stop hook (install-global reminder) now stays silent while subagent transcripts (`<session>/subagents/agent-*.jsonl`) were written in the last 5 min, keeping its sentinel for a later stop.
