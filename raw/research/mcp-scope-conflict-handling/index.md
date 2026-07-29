---
topic: How should install-mcps.sh handle an MCP server that is already registered at project/local scope when it wants to install the shared user-scope server? What solutions exist and which fits this repo?
slug: mcp-scope-conflict-handling
researched: 2026-07-29
sources: [./sources.md]
---

# Research: Handling MCP scope conflicts in `install-mcps.sh`

> When `bootstrap setup` ran on a machine whose project (`steno`) already had a project-scoped stdio `playwright` entry in `.mcp.json`, the shared-HTTP "upgrade path" removed nothing (it only removes user scope) and installed a second, user-scoped registration — producing Claude Code's `[Conflicting scopes]` warning. Because scope precedence is local > project > user, the project stdio entry keeps winning and the shared server is never used. Four remedies were compared; the recommendation is **detect the scope and skip with a migration hint** (Option A), which is implemented in the working tree but intentionally left uncommitted pending review.

## Research Questions
- Why exactly did the conflict occur, and which registration actually wins?
- What are the viable behaviors when setup finds a non-user-scope registration of a server it manages?
- How can scope be detected reliably from a bash 3.2 script (is there structured output)?
- Which behavior fits this repo's existing conventions (never edit project `.mcp.json`, non-interactive safety, additive-only merges)?

## Current State (Codebase)
- `lib/scripts/install-mcps.sh::register_optional_mcp` upgrade path (pre-fix): on "installed but not matching expected", it ran `claude mcp remove <name> -s user` then re-added at user scope — a no-op removal when the existing entry is project-scoped, creating the duplicate [S1].
- The script already declares the constraint "Hint only — never edit a project's `.mcp.json`" in its Darwin-only end-of-run warning block [S2].
- `lib/scripts/lib.sh` house conventions: bash 3.2 only, `grep`-based probes (`mcp_installed`, `mcp_matches`, `serena_installed`), non-interactive runs must degrade safely [S1].
- Working-tree (uncommitted) fix: new `mcp_user_scoped()` helper in `lib.sh` (greps `claude mcp get` for `Scope: User`) + a guard in the upgrade path that skips and prints the migration command when the entry is not user-scoped.

## Key Findings
- Scope precedence is **1. Local, 2. Project, 3. User**; Claude Code connects once using the highest-precedence definition and does not merge fields — so after the buggy run, the project stdio entry still wins and the shared HTTP server is unused [S4].
- The `[Conflicting scopes]` warning is real UX damage: OAuth tokens are stored per endpoint, and `/mcp` tells the user to remove one entry manually [S5].
- `claude mcp get <name>` prints a stable-looking `Scope: User config (…)` / project line but has **no `--json` flag** (`claude mcp get --help` shows only `-h`), so text-grep is the only scriptable detection; it must fail safe [S3].
- Grep for the project's `.mcp.json` (the `serena_installed` technique) detects project scope but misses local scope and requires `PROJECT_DIR`; `claude mcp get` run from the project cwd covers local + project + user uniformly [S1][S3].

## Constraints
- Never modify a project's `.mcp.json` without explicit user action — it is often team-shared/committed config (steno's carries clickup, figma, guru, playwright as deliberate project choices; the serena entry there was added by bootstrap's own setup script, wrongly — see [mcp-add-scope-writes](../mcp-add-scope-writes/index.md)) [S2][S5].
- Non-interactive invocations (`bootstrap install`, headless update) must not prompt and must not take destructive action.
- bash 3.2; no jq dependency; detection must degrade safely if `claude mcp get` output format changes.

## Solution Comparison

| Criteria | A. Detect scope → skip + hint | B. Auto-remove project entry | C. Interactive migrate prompt | D. Silent skip |
|----------|------------------------------|------------------------------|-------------------------------|----------------|
| **Approach** | If entry isn't user-scoped, don't install; print exact `claude mcp remove <name> -s project` migration command | Remove the project `.mcp.json` entry, then install user-scope shared server | In `--interactive` mode ask y/N before removing project entry; skip in non-interactive | Treat project entry as authoritative; say nothing |
| **Pros** | No conflict ever created; respects team config; works identically in both modes; user stays in control | Converges every machine to the shared server automatically | User consent makes removal legitimate | Simplest |
| **Cons** | Requires one manual command to migrate | Edits team-shared, possibly git-committed config; violates stated house rule; destructive in non-interactive runs | Two code paths; still edits shared config; surprising in team repos | User never learns the shared server is being shadowed |
| **Complexity** | Low | Low | Medium | Trivial |
| **Codebase fit** | Matches existing "hint only" rule and non-interactive safety convention | Contradicts explicit in-file rule [S2] | Partially contradicts it | Loses the existing warning behavior |
| **Failure mode if scope-grep breaks** | Skips install (safe — no conflict, hint still printed) | Could remove the wrong entry | Same risk as B on yes | n/a |

## Recommendation
**Option A — detect and skip with a migration hint** (already applied in working tree, uncommitted):
1. `lib.sh`: `mcp_user_scoped()` — `claude mcp get <name> | grep -q "Scope: User"`.
2. `register_optional_mcp` upgrade path: if the existing registration is not user-scoped, print "already registered at project/local scope — skipping user-scope install to avoid conflicting scopes" plus the exact migration command, and return without touching anything.
3. Fail-safe direction: if the `Scope:` line format ever changes, the grep returns false → the script *skips* (never creates a conflict); worst case is a printed hint instead of an automatic upgrade.

Risks & mitigations:
- *Text-format drift in `claude mcp get`* → failure mode is conservative (skip), and `mcp_user_scoped` is a single central helper to update.
- *Users who actually want the project-scoped stdio entry* → Option A leaves it untouched; the hint is advisory.

Alternative if constraints change: if `.mcp.json` were machine-local (never committed) in all target projects, Option C (interactive migrate) would become attractive; Option B remains inappropriate for a tool that runs unattended.

## Next Steps
- Review + commit the working-tree implementation as 2.11.3 and publish.
- Immediate remediation for the affected machine: `cd ~/Repositories/steno && claude mcp remove playwright -s project` **or** `claude mcp remove playwright -s user` (keep whichever playwright the team intends; removing the project entry adopts the shared HTTP server).
- Optional: `/wiki-ingest raw/research/mcp-scope-conflict-handling/index.md` to fold this into the knowledge base alongside ROADMAP-003's single-process MCP work.
