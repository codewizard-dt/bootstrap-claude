# Hooks

PreToolUse hook scripts managed by this template. `./lib/scripts/install-global.sh`
(also `npx @codewizard-dt/bootstrap install`) rsyncs this directory to `~/.claude/hooks/`.

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

## Scripts

| Script | Matcher | Blocks |
|--------|---------|--------|
| `mv-absolute-path-block.js` | `Bash` (`if: Bash(mv *)`) | `mv` to an absolute path outside the project root |
| `git-protected-ops-block.js` | `Bash` (no `if:`) | `git stash` / `git restore` / `git checkout` in any command segment |

`git-protected-ops-block.js` is wired **without** an `if:` filter on purpose: it
does its own matching in JS (splitting on `;`, `&&`, `||`, `|` and handling
`git -C …`, `--no-pager`, etc.), so enforcement never depends on the same
permission-matcher path that lets compound/piped commands slip past a `deny` rule.

## Required `~/.claude/settings.json` wiring

Add these under `hooks.PreToolUse`. If a `Bash` matcher block already exists, add
the hook objects to its `hooks` array rather than creating a second block.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
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
    ]
  }
}
```

Recommended companion `deny` entries (prefix `:*` form covers all subcommands):

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
