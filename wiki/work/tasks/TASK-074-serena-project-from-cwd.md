---
id: TASK-074
aliases: [TASK-074]
title: "Switch all Serena install commands to --project-from-cwd for worktree support"
status: todo
created: 2026-08-24
updated: 2026-08-24
depends_on: []
blocks: []
parallel_safe_with: [TASK-031, TASK-039, TASK-060, TASK-067, TASK-071, TASK-072, TASK-073]
uat: ""
tags: [serena, mcp, worktrees, dev-tooling]
---

# TASK-074 — Switch all Serena install commands to `--project-from-cwd` for worktree support

## Objective

Every place this repo registers or documents registering the Serena MCP server passes an explicit, resolved-at-registration-time `--project "$PROJECT_DIR"` (or `"$(pwd)"`) path. Per the user's explicit direction, switch all of them to `--project-from-cwd` instead, so Serena resolves its project root from its own process's working directory at server-start time — which follows wherever the MCP client actually launches it from, including inside a git worktree, instead of baking in whatever absolute path happened to be current when `claude mcp add` was originally run.

Target registration shape (verbatim from the user):

```json
"serena": {
  "type": "stdio",
  "command": "uvx",
  "args": [
    "--from",
    "git+https://github.com/oraios/serena",
    "serena",
    "start-mcp-server",
    "--context",
    "claude-code",
    "--project-from-cwd"
  ],
  "env": {}
}
```

## Approach

Three real "install command" sites carry the old `--project <path>` form and need updating; a fourth step verifies the new flag actually exists before rolling it out anywhere. Scope confirmed with the user: live install code + its direct docs, not historical wiki/research pages that merely show the old form as a past example.

1. `lib/scripts/install-mcps.sh` (~line 342-344) — the actual `claude mcp add --scope local serena -- uvx ...` invocation `install-global.sh`/`setup-project.sh`/`update-project.sh` all eventually run.
2. `lib/scripts/bootstrap-serena.sh` (line 51) — the fallback error message that tells a user how to register Serena manually when `.serena/project.yml` bootstrap fails; must stay in sync with what `install-mcps.sh` actually runs, or the suggested manual command would silently drift from the real one.
3. `CLAUDE.md` (line 80) — the "Manual setup steps" § 1 Serena entry, documented for humans running the registration by hand.

Do not touch: `test/command-class-hooks.test.js`'s hardcoded example command (tests generic hook pattern-matching against *a* Serena-shaped command, not the real flag set — changing it isn't required for this task, though confirm it still exercises the same hook behavior either way), and wiki/research pages under `wiki/knowledge/`, `raw/research/`, `wiki/work/uat/archive/` that document the old form as historical fact about a past state — those are ground-truth records of what was true when written, not live instructions, and editing them would misrepresent history.

## Steps

### 1. Verify `--project-from-cwd` is real before touching anything <!-- agent: general-purpose -->

- [ ] Run `uvx --from git+https://github.com/oraios/serena serena start-mcp-server --help` (or equivalent) and confirm `--project-from-cwd` is a documented, supported flag on whatever Serena version `uvx` resolves today. If it does not exist or behaves differently than expected (e.g. requires a different invocation form, or is only available on an unreleased branch), STOP and report back rather than proceeding with the remaining steps — do not silently substitute a guess.
- [ ] If confirmed, note the exact Serena version/commit this was verified against in this task's `## Notes` section, so a future drift is traceable.

### 2. Update `install-mcps.sh`'s live registration call <!-- agent: general-purpose -->

- [ ] In `lib/scripts/install-mcps.sh` (~line 340-346), change the `claude mcp add --scope local serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$PROJECT_DIR"` invocation to end with `--project-from-cwd` instead of `--project "$PROJECT_DIR"` — matching the user's exact target args list (`--from`, `git+https://github.com/oraios/serena`, `serena`, `start-mcp-server`, `--context`, `claude-code`, `--project-from-cwd`).
- [ ] Check the surrounding `( cd "$PROJECT_DIR" && ... )` subshell (visible in the current code) — since `--project-from-cwd` now makes the invocation's cwd load-bearing (previously it was redundant with the explicit `--project` arg), confirm this `cd` is still correct and sufficient, and leave a short comment noting *why* the `cd` now matters if that isn't already obvious from the surrounding code.
- [ ] Check the nearby legacy-`.mcp.json`-migration prompt this same file's schema doc references (`install-mcps.sh:328`, the `.mcp.json` already registers 'serena' at project scope with a machine-specific `--project` path" flow) — confirm the re-add path after migration also goes through the same updated invocation, not a separate hardcoded copy.

### 3. Update `bootstrap-serena.sh`'s fallback message <!-- agent: general-purpose -->

- [ ] In `lib/scripts/bootstrap-serena.sh` (line 51), update the `echo "... claude mcp add --scope local serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project \"$PROJECT_DIR\""` message to match Step 2's new invocation exactly (`--project-from-cwd` in place of `--project \"$PROJECT_DIR\"`) — this message must stay byte-for-byte consistent with what `install-mcps.sh` actually runs, since it's the manual-recovery instructions shown when auto-bootstrap fails.

### 4. Update `CLAUDE.md`'s manual setup docs <!-- agent: general-purpose -->

- [ ] In `CLAUDE.md` (line 80, "Manual setup steps" § 1 Serena MCP), update the documented `claude mcp add --scope local serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"` command the same way. Keep the existing surrounding parenthetical explaining local scope's rationale (avoids language-config bleed across projects, avoids leaking a machine-specific path into a shareable `.mcp.json`) — add a short clause noting `--project-from-cwd` is what makes this registration worktree-safe (previously a fixed `--project "$(pwd)"` path could go stale or point at the wrong checkout when invoked from inside a linked worktree).

### 5. Tests <!-- agent: general-purpose -->

- [ ] Check `test/command-class-hooks.test.js` (~line 650) and any `test/install-mcps*.test.js`/`test/run-project-sync.test.js` assertions that pattern-match on the literal `--project "..."` arg shape for Serena registration — update any that would break against the new `--project-from-cwd` form (as opposed to the ones intentionally testing generic hook behavior against *a* Serena-shaped command, which don't need to change per this task's Approach).
- [ ] Run the full suite (`npm test`) and confirm it passes before marking this task's implementation complete.

## Notes

