---
id: TASK-036
title: "Reorder and guard run_project_sync in lib.sh so MCP failures can't abort hook install or wiki sync"
status: done
created: 2026-07-31
updated: 2026-07-31
depends_on: []
blocks: [TASK-038]
parallel_safe_with: [TASK-032]
uat: "[[UAT-036]]"
tags: [install, shell]
---

# TASK-036 — Reorder and guard run_project_sync in lib.sh so MCP failures can't abort hook install or wiki sync

derived_from::[[ROADMAP-004]]

## Objective

`run_project_sync()` in `lib/scripts/lib.sh` (lines ~132-159) currently runs the interactive MCP-install step *first*, unguarded, under `set -euo pipefail` (both `setup-project.sh` and `update-project.sh` inherit this). Any MCP failure — a flaky `npm`/`claude mcp add` call, a declined prompt that exits non-zero, network trouble — aborts the whole run before hooks, skills, the wiki scaffold, the MCP guide, or Serena bootstrap ever execute. This task reorders the steps so the local/offline-safe work runs first and guards the MCP step so its failure degrades gracefully instead of aborting the sequence, for both `bootstrap setup` and `bootstrap update` entry points.

## Approach

Per the authoritative plan at `/Users/davidtaylor/.claude/plans/ok-now-parallel-cerf.md` ("Changes → 4. lib.sh run_project_sync"): run `install-global.sh --skip-mcps` **first**, then the interactive MCP step guarded so a failure only warns and lets the function continue. `detect_installed_mcps` (used just before the MCP-guide build step) already tolerates missing MCPs — a failed MCP step simply yields a smaller guide, it does not need special-casing beyond the warning. The downstream steps (`sync-wiki-scaffold.sh`, `merge-gitignore.sh`, `build-mcp-guide.sh`, `bootstrap-serena.sh`) are unchanged in content and order relative to each other; only their position relative to the (now-guarded) MCP step moves.

This is Phase 2 item 2 of ROADMAP-004 and fixes the `run_project_sync` half of the ordering hazard (the `install-global.sh` half is a separate task).

## Steps

- [x] Read `lib/scripts/lib.sh` lines ~120-165 (`run_project_sync` and its header comment) with Serena (`find_symbol` / `get_symbols_overview`) to confirm current line numbers before editing — they may have shifted since this task was written.
- [x] Swap the first two steps in `run_project_sync()`: move the `"$script_dir/install-global.sh" --skip-mcps` call (currently the second step) to run **before** the `"$script_dir/install-mcps.sh" --interactive --project-dir "$project_dir"` call (currently the first step). Keep each step's own `echo` banner and trailing blank-line `echo ""` attached to its own step as it moves.
- [x] Guard the relocated MCP-install step so a non-zero exit does not abort the function under `set -euo pipefail`:
  ```bash
  if ! "$script_dir/install-mcps.sh" --interactive --project-dir "$project_dir"; then
    echo "Warning: MCP install failed — continuing with wiki sync; re-run update to retry MCPs." >&2
  fi
  ```
- [x] Leave the remaining downstream steps — `sync-wiki-scaffold.sh --interactive`, `merge-gitignore.sh --interactive`, `detect_installed_mcps` + `build-mcp-guide.sh`, `bootstrap-serena.sh` — in their existing relative order and content, unchanged. Do not add special-casing for a failed MCP step: `detect_installed_mcps` already tolerates missing MCPs, so a failed MCP install just produces a smaller MCP-tools guide, which is correct behavior.
- [x] Update the function's header comment block (currently lines ~122-131, immediately above `run_project_sync() {`) to describe the new order: skills/hooks install first (offline-safe), then the guarded/non-fatal interactive MCP install, then wiki scaffold sync, gitignore merge, MCP-guide build, and Serena bootstrap. Remove or correct any phrasing implying MCPs still run first.
- [x] Verify the edited file parses: `bash -n lib/scripts/lib.sh`.
- [DEFERRED-TO-UAT] Verify the fix end-to-end by running `setup-project.sh` against a scratch project directory with a stubbed failing `install-mcps.sh` (e.g. a temporary copy of `lib/scripts/` with `install-mcps.sh` replaced by a script that `exit 1`s) and confirming: a warning is printed, the process exits 0 (or at least does not abort mid-sequence), and hooks/skills, the wiki scaffold, and the Serena `project.yml` are still produced in the scratch project directory. Restore/discard the stub afterward — do not leave a broken `install-mcps.sh` in the repo.
- [x] Confirm both callers (`setup-project.sh` and `update-project.sh`, both `set -euo pipefail`) still behave correctly after the reorder — neither passes any flags to `run_project_sync` that would be affected by the internal step reordering.

<!-- Updated: 2026-07-31 11:48 -->

**Note:** the runtime E2E verification step (stubbed failing `install-mcps.sh` against a scratch project) is deferred to this task's UAT phase per tackle's static-gates-only verification policy — implementation and static checks (`bash -n`, caller-flag check) are complete.
