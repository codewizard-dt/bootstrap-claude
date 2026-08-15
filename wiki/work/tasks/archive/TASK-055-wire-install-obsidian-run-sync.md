---
id: TASK-055
aliases: [TASK-055]
title: "Wire install-obsidian.sh into run_project_sync()"
status: done
created: 2026-08-13
updated: 2026-08-13
depends_on: [TASK-053, TASK-054]
blocks: [TASK-058, TASK-059]
parallel_safe_with: [TASK-056, TASK-057]
uat: "[[UAT-055]]"
tags: [obsidian, installer, automation]
---

# TASK-055 — Wire install-obsidian.sh into run_project_sync()

## Objective

Call `lib/scripts/install-obsidian.sh` (created by TASK-053, which must be `status: done` before this task starts) from `run_project_sync()` in `lib/scripts/lib.sh`, guarded and non-fatal, positioned between the wiki-scaffold sync step and the MCP-guide build step — matching how the existing MCP-install call is already wired into the same function.

## Approach

`run_project_sync()` (`lib/scripts/lib.sh`, approx. lines 149-178) currently runs, in order: install-global (skills/hooks) → MCPs (guarded) → wiki scaffold + gitignore → MCP guide build → Serena bootstrap. Insert the new Obsidian step right after the `"$script_dir/merge-gitignore.sh" --interactive "$project_dir"` line and its trailing blank `echo ""`, and before the `"Building MCP tools guide..."` echo. Mirror the EXACT non-fatal guard shape already used for the MCP install call two blocks earlier in the same function:

```bash
if ! "$script_dir/install-mcps.sh" --interactive --project-dir "$project_dir"; then
  echo "Warning: MCP install failed — continuing with wiki sync; re-run update to retry MCPs." >&2
fi
```

## Steps

### 1. Read and edit run_project_sync <!-- agent: general-purpose -->

- [x] `Read` `lib/scripts/lib.sh` in full (or use Serena's `find_symbol` on `run_project_sync` with `include_body=true`) to get the exact current function body.
  - Using `Edit`, insert a new guarded block after the `merge-gitignore.sh` line's trailing `echo ""` and before the `echo "Building MCP tools guide..."` line:
    ```bash
    echo "Checking Obsidian setup..."
    if ! "$script_dir/install-obsidian.sh" --interactive --project-dir "$project_dir"; then
      echo "Warning: Obsidian install failed — continuing; re-run update to retry." >&2
    fi
    echo ""
    ```
  - Confirm via a follow-up read that the new block sits in the correct position and the rest of the function is untouched.
  - Done: inserted at lines 167-171 of `lib/scripts/lib.sh` (function now spans 149-184), positioned exactly after the `merge-gitignore.sh` line's trailing `echo ""` (line 166) and before `echo "Building MCP tools guide..."` (line 172); rest of function unchanged; `bash -n lib/scripts/lib.sh` parses cleanly.

<!-- Updated: 2026-08-13 -->

### 2. Sanity-check the script exists <!-- agent: general-purpose -->

- [x] Confirm `lib/scripts/install-obsidian.sh` exists (created by TASK-053) and is executable before finishing — if it's missing, STOP and report that TASK-053 must complete first; do not fabricate the wiring against a nonexistent script.
  - Done: confirmed via Serena `find_file` (exists) and `test -x` (executable). No blocker.

<!-- Updated: 2026-08-13 -->

## Notes

Derived from `raw/research/obsidian-setup-automation/index.md`'s Recommendation section (step 5: "Wire the call into `run_project_sync()`... wrapped in the same non-fatal guard") and `wiki/work/roadmaps/ROADMAP-006-obsidian-plugin-automation.md` Phase 2. Depends on TASK-053 (the script itself) and TASK-054 (the preference keys the script references) both being done first.
