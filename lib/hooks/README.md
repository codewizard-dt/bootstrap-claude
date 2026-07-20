# Hooks

PreToolUse / PostToolUse / SessionStart hook scripts managed by this template.
`./lib/scripts/install-global.sh` (also `npx @codewizard-dt/bootstrap install`)
rsyncs this directory — including `lib/` — to `~/.claude/hooks/`.

**Important:** the install script copies the *scripts* but does **not** wire them
into `~/.claude/settings.json`. Hook *registration* is a global-settings concern
and must be added once, by hand, using the snippets below. Without the wiring the
scripts sit on disk and never run.

## Why hooks (vs. allow/deny permission rules)

The permissions `deny` list is **not consulted** when an agent runs in
`bypassPermissions` mode (`--dangerously-skip-permissions`, power-mode teammates,
or any subagent spawned with `mode: bypassPermissions`). `PreToolUse` hooks, by
contrast, fire in **every** permission mode and for **subagent** tool calls. So a
hook is the only reliable enforcement point for "this must never run, even under
bypass." Keep a matching `deny` entry too — belt-and-suspenders for normal modes.

---

## Scripts

### Safety / policy hooks

| Script | Matcher | Blocks |
|--------|---------|--------|
| `env-file-guard.js` | `Read\|Write\|Edit\|MultiEdit` | Reading or writing any `.env` file (`.env`, `.env.local`, etc.) — `.env.example` is allowed |
| `mv-absolute-path-block.js` | `Bash` (`if: Bash(mv *)`) | `mv` to an absolute path outside the project root |
| `git-protected-ops-block.js` | `Bash` (no `if:`) | `git stash` / `git restore` / `git checkout` in any command segment |

### Serena-first enforcement hooks (ported from `claude-code-lsp-enforcement-kit`)

These hooks enforce Serena as the primary tool for code navigation and editing.
They are sourced from `claude-code-lsp-enforcement-kit` — this is the single
source of truth; changes here propagate on the next `install-global.sh` run.

| Script | Event / Matcher | Purpose |
|--------|-----------------|---------|
| `serena-bash-grep-block.js` | `PreToolUse` / `Bash` | Blocks `grep`/`rg` on code symbols, `cat`/`head`/`tail` on code files, `ls`/`find`/`tree` on code dirs, `sed -i`/`awk -i`/`perl -i` in-place edits. Suggests Serena equivalents. |
| `serena-first-guard.js` | `PreToolUse` / `Grep` | Blocks the built-in Grep tool when the pattern contains a code symbol (camelCase, PascalCase, snake_case_fn). |
| `serena-first-glob-guard.js` | `PreToolUse` / `Glob` | Blocks Glob patterns that encode a code symbol name (use `find_symbol` instead). |
| `serena-first-read-guard.js` | `PreToolUse` / `Read` | Gate-based Read guard: requires Serena warmup before code Reads; warns/blocks on excessive Reads without Serena navigation. |
| `serena-edit-guard.js` | `PreToolUse` / `Edit\|MultiEdit` | Hard-blocks Edit / MultiEdit on code files; directs to `replace_symbol_body` / `replace_content`. |
| `serena-write-guard.js` | `PreToolUse` / `Write` | Hard-blocks Write on *existing* code files; new files pass through (no symbols to preserve). |
| `serena-pre-delegation.js` | `PreToolUse` / `Agent` | Warns/blocks implement-phase Agent spawns that lack `## LSP CONTEXT` in their prompt. |
| `serena-usage-tracker.js` | `PostToolUse` + `PostToolUseFailure` / Serena tools | Tracks successful Serena calls in `~/.claude/state/lsp-ready-<hash>` for the read-guard gate decisions, **and** drives health tracking / fail-open enforcement (see below). |
| `serena-session-reset.js` | `SessionStart` | Wipes stale Serena nav state at session start so "surgical mode" doesn't carry over across sessions. |

`git-protected-ops-block.js` is wired **without** an `if:` filter on purpose: it
does its own matching in JS (splitting on `;`, `&&`, `||`, `|` and handling
`git -C …`, `--no-pager`, etc.), so enforcement never depends on the same
permission-matcher path that lets compound/piped commands slip past a `deny` rule.

### Health tracking & fail-open enforcement

The Serena guards block Grep/Read/Edit/Write/Bash and demand Serena tools. If the
Serena MCP server crashes or hangs, that would trap the agent between broken
Serena calls and blocked fallbacks. To prevent this, enforcement is **fail-open**:

- **Scoped to the project root — out-of-project paths always pass.** Serena is
  registered per-project and can only operate on files inside the project root,
  so any tool call whose target path resolves *outside* the root passes through
  untouched: Read/Edit/Write on an out-of-project `file_path`, Grep/Glob with a
  `path` param outside the root, and Bash read/exploration commands
  (`ls`/`find`/`cat`/`grep` …) whose every path target is an absolute or `~`
  path outside the root — or an unresolvable shell-variable path like
  `ls "$SDIR"` (Serena-first is agent guidance, not a security boundary, so a
  path that can't be proven in-project is allowed for reads). In-place edits
  (`sed -i` etc.) with variable paths remain blocked as before; out-of-project
  absolute edit paths pass (Serena can't reach them anyway). `isOutsideProject()`
  in `lib/serena.js` is the shared resolver (`~`/relative expansion + a
  trailing-separator containment check).
- **Assumed healthy by default.** Every guard reads the per-project state file
  (`~/.claude/state/lsp-ready-<md5(cwd)>`) and enforces unless it finds
  `health.should_enforce === false`. A missing file, legacy file without a
  `health` field, or 24h-expired file all mean *enforce* (assume healthy). The
  cost is one small JSON stat+read per guarded call.
- **Failures drive the decision.** `serena-usage-tracker.js` sees every Serena
  call outcome (success **and** failure) and classifies failures:
  - *tool-level* (e.g. "symbol not found", "no results", or a benign decline
    like "cannot extract symbols" for a file type not enabled in
    `.serena/project.yml`) — the server answered, the query just missed or was
    declined for an expected reason. Record the error, **keep enforcing**. An
    unrecognized error string also defaults here — a hook only runs because
    the MCP round-trip completed with a payload to classify, which already
    proves the server responded.
  - *transport-level* (timeout / connection closed / broken pipe / a genuinely
    empty payload) — probe the OS for a Serena process bound to this
    project's `--project` path, **diagnostically only** (the process is never
    terminated: a live process that just answered, even with an error, has
    already proven it isn't hung, and there is no documented way to
    reconnect a stdio MCP server mid-session — killing it has no realistic
    upside and a confirmed downside). If a live process remains, keep
    enforcing, just record the error; if none remains, write
    `health.should_enforce = false` and emit a **one-time** `systemMessage`
    notice that Serena-first enforcement is disabled for the session.
- **Auto-recovery.** The next **successful** Serena call restores
  `health` to enforcing/healthy (and re-arms the one-time notice), so enforcement
  comes back automatically once Serena reconnects or the session restarts
  (`serena-session-reset.js` wipes the file at SessionStart).
- **Gate 1 deadlock backstop.** `serena-first-read-guard.js` tracks
  `warmup_block_count` — consecutive Gate 1 blocks with no successful Serena
  call in between. If it reaches 3 (an unforeseen error type evaded the
  classification above, or Serena never gets a call attempted at all), the
  guard escalates to the same circuit breaker — `health.should_enforce =
  false` plus a one-time notice — rather than blocking indefinitely. It
  escalates the shared flag, not just this one guard, so the deadlock can't
  simply relocate to the next guard hook. Resets to 0 on the next successful
  Serena call, same as the rest of `health`.

**Version compatibility.** `PostToolUseFailure` fires on failed tool calls
(including MCP tools, in every permission mode) but is a newer event; its `error`
payload is undocumented and handled defensively. On Claude Code builds without
`PostToolUseFailure`, failed Serena calls still reach the same script via the
`PostToolUse` error-shaped `tool_response` — so the wiring registers
`serena-usage-tracker.js` on **both** events with the same matcher, and either
path produces the same health outcome. There is no documented way to reconnect a
stdio MCP server mid-session, so the process is never killed on the theory that
the host might respawn it — fail-open + auto-recovery (or the Gate 1 backstop,
as a last resort) is the only guaranteed path back to a working session.

### Shared library

| File | Used by |
|------|---------|
| `lib/serena.js` | All Serena hooks — intent→tool mapping, `isAllowedPath`, block-message builders, per-project state file (`getStateFilePath`/`readStateFile`/`writeStateFile`/`shouldEnforceSerena`/`defaultFlag`/`defaultHealth`), an advisory lock + atomic read-modify-write helper (`acquireLock`/`releaseLock`/`updateStateFile`) used by every hook that writes the state file, failure classification + process health (`classifySerenaFailure`/`isSerenaProcessAlive` — diagnostic only, never terminates the process), and consolidated symbol detection (`isCodeSymbol`/`extractSymbolsFromPattern`) |
| `lib/serena-languages.js` | `lib/serena.js` — reads `.serena/project.yml` to scope enforcement to configured languages |

### State file JSON schema

One file per project cwd, `~/.claude/state/lsp-ready-<md5(cwd).slice(0,12)>`,
written via `updateStateFile()` (locked, atomic) by `serena-usage-tracker.js`
and `serena-first-read-guard.js`:

```jsonc
{
  "cwd": "/path/to/project",
  "warmup_done": false,          // Gate 1: has a Serena nav call ever succeeded this session?
  "nav_count": 0,                // successful nav calls since warmup (Gates 4/5)
  "read_count": 0,               // len(read_files)
  "read_files": [],              // code files already Read this session
  "warmup_block_count": 0,       // consecutive Gate 1 blocks — resets on any success, see backstop above
  "cold_start_retries": 0,
  "timestamp": 0,                // last write; entries older than 24h are treated as missing
  "last_tool": "",
  "health": {
    "should_enforce": true,      // false ⇒ every guard fails open for this project
    "healthy": true,
    "error_count": 0,
    "last_error": null,
    "last_check": 0,
    "notified": false            // one-time systemMessage already shown for this outage
  }
}
```

A sibling `<path>.lock` file exists only transiently, for the duration of a
single read-modify-write cycle (a few ms). It self-heals: a lock older than
750ms is treated as orphaned (its holder crashed) and is cleared by the next
acquirer rather than blocking on it.

---

## Required `~/.claude/settings.json` wiring

Add these under `hooks`. If a block already exists for a given matcher, add the
hook objects to its existing `hooks` array rather than creating a second block.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-session-reset.js"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/env-file-guard.js"
          }
        ]
      },
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-first-read-guard.js"
          }
        ]
      },
      {
        "matcher": "Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-edit-guard.js"
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-write-guard.js"
          }
        ]
      },
      {
        "matcher": "Grep",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-first-guard.js"
          }
        ]
      },
      {
        "matcher": "Glob",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-first-glob-guard.js"
          }
        ]
      },
      {
        "matcher": "Agent",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-pre-delegation.js"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-bash-grep-block.js"
          },
          {
            "type": "command",
            "command": "node ~/.claude/hooks/mv-absolute-path-block.js",
            "if": "Bash(mv *)"
          },
          {
            "type": "command",
            "command": "node ~/.claude/hooks/git-protected-ops-block.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__serena__.*|mcp__plugin_[^_]+_serena__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-usage-tracker.js"
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "mcp__serena__.*|mcp__plugin_[^_]+_serena__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-usage-tracker.js"
          }
        ]
      }
    ]
  }
}
```

The `PostToolUse` matcher is broadened from the six navigation tools to **all**
Serena tools so every call feeds health tracking; the tracker gates the read-guard
nav counters internally (only the six nav/exploration tools advance the gate, as
before). The `PostToolUseFailure` block points at the same script — see
[Health tracking & fail-open enforcement](#health-tracking--fail-open-enforcement)
for why both events are wired. If your Claude Code build does not support
`PostToolUseFailure`, that block is simply ignored and the `PostToolUse` error
path still catches failures.

Recommended companion `deny` entries (belt-and-suspenders for normal modes):

```json
{
  "permissions": {
    "deny": [
      "Bash(git stash:*)",
      "Bash(git restore:*)",
      "Bash(git checkout:*)"
    ]
  }
}
```

Hooks load at session start, so restart any running session after wiring.
