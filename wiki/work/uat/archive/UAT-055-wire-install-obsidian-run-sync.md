---
id: UAT-055
title: "UAT: Wire install-obsidian.sh into run_project_sync()"
status: passed
task: TASK-055
created: 2026-08-13
updated: 2026-08-13
---

# UAT-055 — UAT: Wire install-obsidian.sh into run_project_sync()

implements::[[TASK-055]]

> **Source task**: [[TASK-055]]
> **Generated**: 2026-08-13

---

## Scope note

TASK-055 only wired a guarded, non-fatal call to `lib/scripts/install-obsidian.sh` into
`run_project_sync()` (`lib/scripts/lib.sh`, lines 149-184) — it did not touch the script's own
internals (that is TASK-053) or run a live end-to-end install (that is TASK-058/TASK-059). Per
`wiki/work/tasks/TASK-059-verify-obsidian-install-failure-modes.md`'s `## Notes` → "Verification
findings" section, TASK-059 already ran the **real** `install-obsidian.sh` and the real
`run_project_sync()` guard under simulated `brew`/`flatpak`-missing and stand-in `exit 1` failures
and confirmed both stay non-fatal (exit 0, WARNING printed) — a live-execution proof this UAT does
not repeat.

This UAT instead covers the **static/structural contract** a code read (and a hermetic stub-based
unit test) can verify without touching a real Obsidian install: the call site's exact position
between the wiki-scaffold-sync and MCP-guide-build steps, the exact guard syntax and invocation
flags, and that the rest of `run_project_sync()` is undisturbed. All cases are unit-test promoted
against a stubbed `script_dir` (mirroring the existing `test/run-project-sync.test.js` pattern from
TASK-036) — no live network, filesystem outside `os.tmpdir()`, or real sub-scripts involved.

---

## Prerequisites

- [ ] Repo checked out with `lib/scripts/lib.sh` and `lib/scripts/install-obsidian.sh` present (the
      latter created by TASK-053; TASK-055's Step 2 already confirmed it exists and is executable)
- [ ] Node.js available (`node --test` runner, no external dependencies)

---

## Test Cases

### UAT-EDGE-001: install-obsidian.sh call sits between merge-gitignore.sh and build-mcp-guide.sh
- **Scenario**: `run_project_sync()` must call `install-obsidian.sh` strictly after the wiki-scaffold
  sync (`sync-wiki-scaffold.sh` + `merge-gitignore.sh`) and strictly before the MCP-guide build
  (`build-mcp-guide.sh`), matching TASK-055's Approach/Steps exactly.
- **Steps**:
  1. Source the real `lib/scripts/lib.sh` under `set -euo pipefail` (matching how `setup-project.sh`
     and `update-project.sh` invoke it).
  2. Call `run_project_sync(project_dir, script_dir)` where `script_dir` contains marker-script
     stand-ins for all seven sub-scripts, each appending its own name to `order.log`.
  3. Read `order.log` and locate the index of `merge-gitignore.sh`, `install-obsidian.sh`, and
     `build-mcp-guide.sh`.
- **Expected Result**: All three names appear in `order.log`, and
  `index(merge-gitignore.sh) < index(install-obsidian.sh) < index(build-mcp-guide.sh)`.
- **Repeatable Unit Test**: Created: `test/run-project-sync.test.js`
- **Unit Test Command**: `node --test test/run-project-sync.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-002: install-obsidian.sh is invoked with the same flag convention as install-mcps.sh
- **Scenario**: The call site must pass `--interactive --project-dir "$project_dir"`, mirroring the
  existing `install-mcps.sh` call two blocks earlier in the same function (per TASK-055's Approach:
  "Mirror the EXACT non-fatal guard shape already used for the MCP install call").
- **Steps**:
  1. Run `run_project_sync()` against a stubbed `script_dir` whose `install-obsidian.sh` marker
     records every argument it was invoked with, one per line.
  2. Read back the recorded argument list for `install-obsidian.sh`.
- **Expected Result**: Recorded args equal exactly `['--interactive', '--project-dir', '<project_dir>']`
  (the real scratch project directory path, unquoted-split into three argv entries).
- **Repeatable Unit Test**: Created: `test/run-project-sync.test.js`
- **Unit Test Command**: `node --test test/run-project-sync.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-003: the "Checking Obsidian setup..." banner prints before the MCP-guide-build banner
- **Scenario**: The inserted block's own `echo "Checking Obsidian setup..."` line must appear in
  stdout before `echo "Building MCP tools guide..."`, confirming the surrounding echo text was not
  dropped or reordered during the insertion.
- **Steps**:
  1. Run `run_project_sync()` against a stubbed `script_dir` with all steps succeeding.
  2. Capture stdout and locate both banner strings.
- **Expected Result**: Both strings are present in stdout, and `"Checking Obsidian setup..."`
  occurs at an earlier index than `"Building MCP tools guide..."`.
- **Repeatable Unit Test**: Created: `test/run-project-sync.test.js`
- **Unit Test Command**: `node --test test/run-project-sync.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-004: a failing install-obsidian.sh only warns — it does not abort run_project_sync
- **Scenario**: The guard must be `if ! "$script_dir/install-obsidian.sh" ...; then echo "Warning: ..." >&2; fi`
  — a non-zero exit from the step must not propagate under the caller's `set -euo pipefail`. This is
  the structural counterpart to TASK-059's live-execution proof of the same property (see Scope note
  above) — here verified against the real `lib.sh` guard code with a stubbed sub-script forced to
  `exit 1`, not against the real `install-obsidian.sh` internals.
- **Steps**:
  1. Run `run_project_sync()` against a stubbed `script_dir` where `install-obsidian.sh` exits 1.
  2. Check the wrapper's overall exit status and stderr.
- **Expected Result**: Exit status 0, the sourcing wrapper reaches its final `WRAPPER_EXIT_OK` echo,
  and stderr contains exactly `Warning: Obsidian install failed — continuing; re-run update to retry.`
- **Repeatable Unit Test**: Created: `test/run-project-sync.test.js`
- **Unit Test Command**: `node --test test/run-project-sync.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-005: downstream steps still run after install-obsidian.sh fails
- **Scenario**: A guarded failure in `install-obsidian.sh` must not skip `build-mcp-guide.sh` or
  `bootstrap-serena.sh` — the rest of the function must execute exactly as if the step had succeeded.
- **Steps**:
  1. Run `run_project_sync()` against a stubbed `script_dir` where `install-obsidian.sh` exits 1 and
     every other step succeeds.
  2. Read `order.log`.
- **Expected Result**: `order.log` equals the full seven-step sequence in order (`install-global.sh`,
  `install-mcps.sh`, `sync-wiki-scaffold.sh`, `merge-gitignore.sh`, `install-obsidian.sh`,
  `build-mcp-guide.sh`, `bootstrap-serena.sh`) — nothing after the failed step is skipped.
- **Repeatable Unit Test**: Created: `test/run-project-sync.test.js`
- **Unit Test Command**: `node --test test/run-project-sync.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-006: a successful install-obsidian.sh prints no warning
- **Scenario**: The guard must fire only on real failure — a zero exit from `install-obsidian.sh`
  must never print the Obsidian warning text (guards against an inverted `!`/condition bug).
- **Steps**:
  1. Run `run_project_sync()` against a stubbed `script_dir` with all steps succeeding.
  2. Check stderr.
- **Expected Result**: stderr does not contain `Warning: Obsidian install failed`.
- **Repeatable Unit Test**: Created: `test/run-project-sync.test.js`
- **Unit Test Command**: `node --test test/run-project-sync.test.js`
- [x] Pass <!-- 2026-08-13 -->

---

## Gaps

- No live-execution or UI/API test cases: this task only edits a bash function body (no HTTP
  endpoint, no UI route). Live-execution coverage of the real `install-obsidian.sh` script's own
  failure/decline behavior is intentionally out of scope here — it is already covered by
  TASK-059's manual verification (see `## Notes` in that task file) and by UAT-058's happy-path
  coverage. Duplicating that live run inside this UAT would re-collide with the concurrent
  TASK-058/TASK-059 runs against the same `.obsidian/` directory that TASK-059's own Notes flagged
  as a risk to avoid.
