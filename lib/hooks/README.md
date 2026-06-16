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
| `serena-usage-tracker.js` | `PostToolUse` / Serena tools | Tracks successful Serena calls in `~/.claude/state/lsp-ready-<hash>` for the read-guard gate decisions. |
| `serena-session-reset.js` | `SessionStart` | Wipes stale Serena nav state at session start so "surgical mode" doesn't carry over across sessions. |

`git-protected-ops-block.js` is wired **without** an `if:` filter on purpose: it
does its own matching in JS (splitting on `;`, `&&`, `||`, `|` and handling
`git -C …`, `--no-pager`, etc.), so enforcement never depends on the same
permission-matcher path that lets compound/piped commands slip past a `deny` rule.

### Shared library

| File | Used by |
|------|---------|
| `lib/serena.js` | All Serena hooks — intent→tool mapping, `isAllowedPath`, block-message builders |
| `lib/serena-languages.js` | `lib/serena.js` — reads `.serena/project.yml` to scope enforcement to configured languages |

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
        "matcher": "mcp__serena__find_symbol|mcp__serena__find_referencing_symbols|mcp__serena__get_symbols_overview|mcp__serena__find_file|mcp__serena__search_for_pattern|mcp__serena__list_dir",
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
