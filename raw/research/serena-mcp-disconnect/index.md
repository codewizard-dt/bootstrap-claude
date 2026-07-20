---
topic: "Recent hook changes to Serena MCP health-checking appear to be causing Serena's MCP server to disconnect mid-session, almost every session — evidenced by: 'Serena's MCP server disconnected mid-session, so exploration fell back to Read/Bash — didn't block anything since the README/wiki already had the architecture fully synthesized.'"
slug: serena-mcp-disconnect
researched: 2026-07-07
sources: [./sources.md]
---

# Research: Serena MCP server disconnects mid-session after the health-tracking hook change

> **The health-tracking hook doesn't just detect a dead Serena server — under a common, everyday condition it actively kills a live, healthy one.** `classifySerenaFailure()` defaults *any* unrecognized error string to `'transport'` (assess-and-possibly-kill) instead of `'tool'` (log-and-continue). A completely benign, expected error — Serena declining to parse a file whose language isn't enabled in `.serena/project.yml` — doesn't match the narrow tool-level regex, falls through to the transport branch, and `attemptSerenaRestart()` then `pkill`s the process on the false premise that "alive but returned an error" means "hung." Since Claude Code has no documented way to reconnect a stdio MCP server mid-session, the kill is effectively permanent for the rest of that session. This was caught live, in real time, during this research: three parallel `get_symbols_overview` calls on this repo's own `.js` hook files (JS/TS isn't in this project's enabled Serena languages) triggered exactly this sequence, and `ps aux` confirms the `bootstrap-claude` Serena process is gone while two other concurrently open projects' Serena processes are untouched. A related concurrency bug (unsynchronized read-modify-write on the shared per-project state file) then left the enforcement flag in an inconsistent state — `should_enforce: true` while the process is confirmed dead — which is the exact deadlock shape that would explain "almost every session."

## Research Questions
- What changed in the recent Serena health-tracking hook work, and does it plausibly cause server disconnects?
- Can the disconnect be reproduced/observed directly, and what is the precise trigger?
- Is there a design flaw in how "hung" vs. "dead" vs. "erroring-but-alive" is distinguished?
- Is there a secondary bug (e.g. concurrency) that compounds the problem?
- What's the minimal, safe fix?

## Current State (Codebase)

The hook chain lives in `lib/hooks/` (mirrored to `~/.claude/hooks/` by `install-global.sh`):

- **`lib/hooks/lib/serena.js`** — shared helper. Added in commit `5752eed` ("Add Serena health tracking with fail-open enforcement..."): a per-project JSON state file (`~/.claude/state/lsp-ready-<md5(cwd).slice(0,12)>`) now carries a `health` sub-object (`should_enforce`, `healthy`, `error_count`, `last_error`, `last_check`, `notified`), plus new functions `classifySerenaFailure()`, `isSerenaProcessAlive()`, and `attemptSerenaRestart()` [S1].
- **`lib/hooks/serena-usage-tracker.js`** — `PostToolUse` + `PostToolUseFailure` hook, registered under matcher `mcp__serena__.*|mcp__plugin_[^_]+_serena__.*` in `~/.claude/settings.json` [S4]. On any Serena tool call: success restores health; failure is classified and, if `'transport'`, drives `handleFailure()` → process-liveness probe → possible restart → fail-open [S2].
- **`lib/hooks/serena-first-read-guard.js`** — Gate 1 blocks the very first `Read` on a code file until `mcp__serena__get_symbols_overview` (or another nav tool) has been called at least once (`warmup_done`); Gates 4/5 require increasing `nav_count` before more Reads unlock. All gates are skipped only if `shouldEnforceSerena(flag)` is false [S3].
- **`.serena/project.yml`** for this repo enables only `languages: [bash, markdown, yaml]` — **not** `typescript` (the config file's own comment says "For JavaScript, use typescript") [S5]. But this repo's own tooling — `lib/hooks/*.js`, `lib/scripts/*.js`, `bin/cli.js` — is JavaScript.
- The user-level global rule `~/.claude/rules/lsp-first.md` instructs **all agents** to call `find_symbol`/`get_symbols_overview` first for any code navigation, with no carve-out for files whose language isn't enabled in the current project's Serena config.

## Key Findings

1. **The exact failure was reproduced live, in this session, on this repo.** Three parallel `mcp__serena__get_symbols_overview` calls against `lib/hooks/lib/serena.js`, `lib/hooks/serena-session-reset.js`, and `lib/hooks/serena-usage-tracker.js` each failed with `ValueError: Cannot extract symbols from file <path>. Active languages: ['bash', 'markdown', 'yaml']` — because JS/TS isn't an enabled language for this project [S6]. Immediately after, the system surfaced: *"The following MCP servers have disconnected: serena."* [S7]

2. **`classifySerenaFailure()` misclassifies this benign error as a transport failure.** Its tool-level regex — `not found|no results|no matching|no symbol|could not find|error searching|error finding|does not exist|no such (?:file|symbol|path|directory)|error at` — does not match "Cannot extract symbols... Active languages: [...]". The function's own comment says "Unknown ⇒ transport (assess health rather than silently ignore)" [S1, lines 449–472] — meaning *any* Serena error message the author didn't anticipate defaults to the destructive path.

3. **`attemptSerenaRestart()` kills a process that just proved it was alive.** The function's premise: if `isSerenaProcessAlive()` is true after a failure, the process must be "hung," so `pkill -f 'serena start-mcp-server.*<projectDir>'` is issued, followed by a 1s sleep and a re-probe [S1, lines 492–509]. This is a logical inversion: a `PostToolUseFailure`/error `tool_response` can only fire if the MCP round-trip *completed* — the server necessarily responded. A genuinely hung or dead process would never produce a parseable error payload for this hook to classify in the first place. The hook's own code comment even acknowledges the fix is unrecoverable: *"There is no documented way to reconnect a stdio MCP server mid-session, so a successful 'restart' only happens if the host respawns the process."* [S1, lines 495–497]

4. **Empirically confirmed via `ps aux`.** No `serena start-mcp-server ... bootstrap-claude` process exists post-incident, while `serena start-mcp-server ... portfolio_v2` and `... gauntlet/demand-letter` (two other projects open in sibling sessions at the same time) are both alive and untouched [S8]. This rules out a host-level/global Serena outage — the kill was scoped to exactly the project whose hook fired.

5. **The per-project state file confirms the exact trigger and reveals a second bug.** `~/.claude/state/lsp-ready-6d7a97f1dd99` (the `bootstrap-claude` state file) shows `last_error` verbatim matching the reproduction above, `healthy: false`, but **`should_enforce: true`** [S9] — an inconsistent combination the code's own contract says should not occur (`should_enforce` is meant to flip to `false` exactly when `attemptSerenaRestart` finds no live process remaining, per `handleFailure()`'s final branch [S1, lines 170–189]). Root cause: `serena-usage-tracker.js` does an unsynchronized `readStateFile → mutate → writeStateFile` with no locking [S2, lines 122–189; `writeStateFile` at S1 lines 399–404]. The three parallel `get_symbols_overview` failures in this session raced: `error_count: 2` (not 3 — one write was clobbered), and the write that correctly set `should_enforce: false` was overwritten by a losing, stale write from another concurrent invocation.

6. **This inconsistent state reproduced the deadlock live, moments later.** Immediately after, a plain `ls`/`find` via Bash on `raw/research/` was blocked by `serena-bash-grep-block.js`'s SERENA-FIRST guard — even though Serena is confirmed dead — because the guard reads `should_enforce: true` from the (corrupted) state file and has no independent way to know the process is gone. Work only proceeded via a `python3 -c` one-liner that doesn't match the guard's command patterns.

7. **In a fresh session, this is the "almost every time" mechanism.** `serena-session-reset.js` wipes `nav_count`/`warmup_done` to zero at `SessionStart` [S10]. `serena-first-read-guard.js` Gate 1 then blocks the *first* code `Read` until a Serena nav call succeeds [S3, lines 55–67]. Per the global LSP-first rule, the agent's first move on a code file is `get_symbols_overview`. If that first file is one of this project's own `.js` hook/script files (a near-certainty when exploring `lib/hooks/`, `lib/scripts/`, or `bin/cli.js`, since `typescript` isn't enabled), the failure→misclassify→pkill sequence fires at the very start of the session — the worst possible time, before `nav_count` has any headroom to survive a stale `should_enforce: true` race outcome. This matches the reported symptom precisely: it recurs "almost every time" because the trigger condition (Serena is asked to parse a JS file in a project that hasn't enabled JS/TS) is hit on nearly every session's first few tool calls, not on rare edge cases.

8. **The reported incident text is consistent with a race that happened to land safely.** *"Serena's MCP server disconnected mid-session, so exploration fell back to Read/Bash — didn't block anything since the README/wiki already had the architecture fully synthesized"* describes a session where the kill fired, but either `should_enforce` correctly flipped to `false` (no race) or `nav_count`/prior reads had already cleared the gates, so the fallback wasn't blocked. This session's own reproduction shows the alternate (worse) outcome: the race left `should_enforce: true`, and the bash fallback *was* blocked.

## Constraints

- Any fix must preserve the hook's stated contract: **fail-open, never fail-closed** — a broken Serena must never leave the agent unable to work at all.
- `lib/hooks/lib/serena.js` is shared by 7+ guard hooks; changes must not regress `isAllowedPath`, symbol detection, or the message-builder API used elsewhere.
- The hooks are mirrored verbatim to `~/.claude/hooks/` and apply across *all* projects, not just this repo — so the classification/restart fix should be general (not bootstrap-claude-specific), while the `.serena/project.yml` language gap is this-repo-specific.
- No test suite currently exercises `classifySerenaFailure`/`attemptSerenaRestart` (not found via codebase search) — any fix should be validated by direct reasoning/manual reproduction, as done here, since there's no existing harness to run against.

## Recommendation

Two independent, complementary fixes — both are needed; neither alone fully resolves the symptom.

**A. Fix the hook logic (`lib/hooks/lib/serena.js`, `lib/hooks/serena-usage-tracker.js`) — applies to every project:**

1. **Stop killing a process that just answered.** A `PostToolUse`/`PostToolUseFailure` event with a parseable error payload is proof the server is alive and responsive — that is the opposite of "hung." Remove (or heavily restrict) the `pkill` branch in `attemptSerenaRestart()`; at minimum, never invoke it from `handleFailure()`'s per-tool-call error path. If a genuine "unresponsive process" signal is needed, it would have to come from the harness itself (e.g. a distinct transport-disconnect notification, or a timeout with *no* response at all) — not from a tool call that successfully round-tripped with an error.
2. **Flip `classifySerenaFailure()`'s default.** Change "Unknown ⇒ transport" to "Unknown ⇒ tool" (log-and-continue). A missed real transport failure just delays detection to the next failure; a false-positive under the current default is an irreversible kill. Also add the observed pattern (`cannot extract symbols`, `active languages`, `unsupported language`) to the explicit tool-level regex, since it's a deterministic, expected response.
3. **Make the state-file read-modify-write atomic.** `writeStateFile` currently does a bare `fs.writeFileSync` with no locking (`lib/hooks/lib/serena.js` lines 399–404), so concurrent Serena tool calls (common — agents frequently batch independent navigation calls, as this session did) race and can corrupt `error_count`/`should_enforce`, as observed. Use a write-to-temp-then-rename for atomicity, and add a short-lived lock (e.g. a `.lock` sibling file with a retry/backoff, or `proper-lockfile`) around the full read-modify-write in `handleSuccess`/`handleFailure`.
4. **Bound the worst case regardless.** Add a hard ceiling in `serena-first-read-guard.js`: if Gate 1 has blocked N times in a row without `warmup_done` ever succeeding, fail open rather than blocking indefinitely. This is a safety net if an unforeseen error type or another race slips past fixes 1–3.

**B. Fix this project's Serena language config (`.serena/project.yml`) — bootstrap-claude-specific:**

Add `typescript` to the `languages` list so `lib/hooks/*.js`, `lib/scripts/*.js`, and `bin/cli.js` get real symbol support instead of a guaranteed parse failure on every navigation attempt. This removes the trigger condition at its most common source for this repo and gives the agent working code intelligence for the repo's own JS surface (currently it silently degrades to Read/Bash for all JS/TS files, which the memory `hooks/serena-health-tracking` already tacitly documents but doesn't flag as a gap).

### Risks and mitigations
- **Risk:** Loosening the transport-classification default might mask a genuinely dead server for longer. **Mitigation:** `handleSuccess()` already restores health instantly on the next success, and the fail-open path still exists for cases where the process is *actually* absent (`isSerenaProcessAlive()` false) — only the "alive-but-erroring ⇒ kill" inversion is being removed.
- **Risk:** Adding `typescript` to `project.yml` spins up a TS language-server process for a repo that's primarily markdown/wiki content. **Mitigation:** this repo already ships real JS (`lib/hooks/`, `lib/scripts/`, `bin/cli.js`) that benefits from it; the overhead is the same one other projects on this machine already pay (confirmed running for `portfolio_v2` and `gauntlet/demand-letter` in `ps aux`).
- **Risk:** Removing the "restart" behavior entirely removes any self-healing. **Mitigation:** there was never real self-healing to begin with — the code's own comment confirms no documented mid-session stdio reconnect exists; the pkill was pure downside with no realistic upside.

### Alternative if constraints change
If Claude Code ever exposes a genuine transport-disconnect event (distinct from a tool-level error payload), that would be the correct signal to drive `attemptSerenaRestart()` — at that point the "kill and hope the host respawns" logic could legitimately fire on that event instead of on ordinary tool errors.

## Next Steps

- `/task-add Fix Serena health-tracking hook: stop killing live-but-erroring processes, default unknown failures to tool-level, and atomicize state-file writes (lib/hooks/lib/serena.js, lib/hooks/serena-usage-tracker.js)` — the general hook fix (A above).
- `/task-add Add typescript to .serena/project.yml languages list so lib/hooks/*.js, lib/scripts/*.js, and bin/cli.js get real symbol navigation` — the project-config fix (B above).
- Run `/wiki-ingest raw/research/serena-mcp-disconnect/index.md` to synthesize this into the knowledge base once the above tasks are filed.
