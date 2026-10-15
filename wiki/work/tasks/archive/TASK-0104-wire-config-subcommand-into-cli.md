---
id: TASK-0104
aliases: [TASK-0104]
title: "Wire bootstrap-prefs-tui.js into bin/cli.js as a `config` subcommand"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0103]
blocks: [TASK-0105]
parallel_safe_with: []
uat: "[[UAT-0104]]"
tags: [cli, tui, bootstrap-prefs, roadmap-011]
---

# TASK-0104 — Wire bootstrap-prefs-tui.js into bin/cli.js as a `config` subcommand

relates_to::[[bootstrap-prefs-editor-tui]]
depends_on::[[TASK-0103]]
blocks::[[TASK-0105]]

> **Depends on**: TASK-0103 (builds `lib/scripts/bootstrap-prefs-tui.js`, the file this task wires in)
> **Blocks**: TASK-0105 (UAT for the interactive menu flow, scope enforcement, and both dynamic families needs a reachable `bootstrap config` entry point)

## Objective

Add a `config` entry to the `SCRIPTS` map in `bin/cli.js` so `npx @codewizard-dt/bootstrap config` lets a user view and change `bootstrap-prefs.json` keys from a plain terminal. With no arguments it launches the interactive readline menu (`bootstrap-prefs-tui.js`); with operation flags (`--get`, `--set`, `--unset`, `--list`, `--section-key`) it passes straight through to the existing `bootstrap-prefs.js` engine for scripting. This is ROADMAP-011 Phase 2, item 1.

## Approach

**Route in `bin/cli.js`, not inside the TUI.** `bootstrap-prefs.js` is already a complete flag-driven CLI (`--get/--set/--unset/--list`, `--global | --project <dir> | --target <path>`, `--value`) that owns validation, the `scopePermitsLayer` write guard, and atomic writes. Re-implementing flag handling in the TUI would duplicate it. Instead the `config` command decides which script to run from `extraArgs`:

| `extraArgs` | Script run | Why |
|-------------|------------|-----|
| empty | `bootstrap-prefs-tui.js` (no args) | interactive menu |
| contains any operation flag (`--get`, `--set`, `--unset`, `--list`, `--section-key`) | `bootstrap-prefs.js` with `extraArgs` verbatim | scripting passthrough; its own usage errors and exit codes surface unchanged |
| anything else (e.g. `--project <dir>` alone) | `bootstrap-prefs-tui.js` with `extraArgs` verbatim | lets the TUI accept a project/layer hint; TUI's own parser owns rejecting unknowns |

No implicit args are injected on the passthrough path (no auto `--project .`), so `bootstrap config --set k --value v --global` behaves byte-for-byte like calling `bootstrap-prefs.js` directly and the scope-enforcement refusal (BUG-0009-style) is the engine's, not a wrapper's.

**Mirror the `dashboard` entry's mechanics.** `dashboard` is `{ script: 'wiki-dashboard-server.js', args: ['.', ...extraArgs] }` and is run by `execFileSync(scriptPath, scriptArgs, { stdio: 'inherit' })` — the script file is executed directly, so it needs a `#!/usr/bin/env node` shebang and the executable bit. `stdio: 'inherit'` is required for the TUI to get a real TTY. Since `SCRIPTS` is a static map keyed by command and `config` needs a conditional script choice, resolve it with a small helper defined above the map rather than restructuring the dispatch.

**No `package.json` change.** `files` already ships `bin/` and `lib/`, so `lib/scripts/bootstrap-prefs-tui.js` (and the existing `bootstrap-prefs.js` plus `templates/bootstrap-prefs-schema.json`) are already in the tarball. Step 4 verifies this rather than editing.

**Out of scope.** The TUI itself (TASK-0103), UAT (TASK-0105), and all documentation — README.md, CLAUDE.md Setup Workflow, and bootstrap-config SKILL.md — which belong to TASK-0106 (ROADMAP-011 Phase 3, docs item); do not edit those files here. Do not touch `~/.claude/settings.json` handling — scope is `bootstrap-prefs.json` only.

**Assumption to verify in Step 1.** TASK-0103 is expected to default its project layer to the current working directory when launched with no args (as `dashboard` does with `.`). If it instead requires an explicit `--project`, have the `config` no-args branch pass `['--project', '.']` — decide from the TASK-0103 file, not by guessing.

## Steps

### 1. Confirm the TUI contract from TASK-0103  <!-- agent: Explore -->

- [x] Read `wiki/work/tasks/TASK-0103-*.md` (or its archive copy) and `lib/scripts/bootstrap-prefs-tui.js` once it exists
  - [x] Confirm the file has a `#!/usr/bin/env node` shebang and is executable: `git ls-files -s lib/scripts/bootstrap-prefs-tui.js` must show mode `100755` (compare `lib/scripts/wiki-dashboard-server.js`) — shebang present; file is mode 644 and untracked, so Step 2 applies `chmod +x` (task scope allows the TUI's mode)
  - [x] Confirm how it resolves the project layer with no args (cwd default vs. explicit `--project`) and what args it accepts — cwd default (walks up to `.git`/`.claude`); accepts `--global`, `--project <dir>`, `--schema <path>`, `-h`; unknown args exit 2. No `['--project','.']` injection needed
  - [x] Confirm it exits non-zero on a non-TTY stdin instead of hanging — differs: no TTY guard; on EOF it prints `No changes.` and exits 0 without hanging. Not patched (TASK-0103's); Test 4 asserts exit-on-its-own and no engine usage error instead
  - [x] If any of these is missing, report it rather than patching the TUI in this task; the dependency is TASK-0103 — reported to team-lead in final summary
  - Also found: engine does NOT refuse an unknown key on `--set` (warns and writes, exit 0); Test 3 uses an engine-refused input instead (see Step 3 note)

### 2. Add the `config` entry to `bin/cli.js`  <!-- agent: general-purpose -->

- [x] In `bin/cli.js`, add a `PREFS_OPERATION_FLAGS` constant (`['--get', '--set', '--unset', '--list', '--section-key']`) and a `configTarget(extraArgs)` helper returning `{ script, args }` per the routing table in Approach
  - Use `extraArgs.some((a) => PREFS_OPERATION_FLAGS.includes(a))` to detect passthrough
  - Passthrough returns `{ script: 'bootstrap-prefs.js', args: extraArgs }`; otherwise `{ script: 'bootstrap-prefs-tui.js', args: extraArgs }`
- [x] Add `config: configTarget(extraArgs),` to the `SCRIPTS` map next to `dashboard` (evaluated at load time like the existing `migrate`/`typechecks` entries that already spread `extraArgs`)
- [x] Add usage lines in the `!command || !SCRIPTS[command]` block, after the `dashboard` lines:
  - `  config        View or change bootstrap preferences (interactive menu, no Claude Code needed)`
  - `                Scripting: bootstrap config --get <key> | --set <key> --value <v> (--global | --project <dir>) | --unset <key> | --list`
- [x] Keep the existing dispatch (`execFileSync(scriptPath, scriptArgs, { stdio: 'inherit' })`) and `process.exit(err.status || 1)` unchanged so the engine's exit codes propagate
- [x] Use Serena symbol tools to edit; `bin/cli.js` is a code file
- [x] `chmod +x lib/scripts/bootstrap-prefs-tui.js` (was 644; not `git add`ed — TASK-0103's file is untracked)
<!-- Updated: 2026-09-19 -->

### 3. Add a repeatable test  <!-- agent: general-purpose -->

- [x] Create `test/cli-config-subcommand.test.js`, zero-dependency `node:test` + `node:assert` + `spawnSync`, mirroring `test/cli-deploy-removed.test.js` (same header-comment style, `REPO`/`CLI` constants)
  - Test 1: `node bin/cli.js` (no args) usage on stderr lists `config`, exit code 1
  - Test 2: `node bin/cli.js config --list --target <tmp file>` exits 0 and its stdout matches `node lib/scripts/bootstrap-prefs.js --list --target <same tmp file>` (proves passthrough; use `fs.mkdtempSync` under `os.tmpdir()` and a `{}` values file)
  - Test 3: `node bin/cli.js config --set nonexistent.key --value x --global` is refused with a non-zero exit code and the engine's own error text on stderr, and does not create or modify `~/.claude/bootstrap-prefs.json` (run with `HOME` pointed at a temp dir so the real file is never at risk)
  - Test 4 (no-args routing reaches the TUI, no TTY needed): `node bin/cli.js config` with `input: ''` (stdin closed) and a `timeout` option exits on its own rather than hanging; assert it did not run the engine's usage error for a missing operation flag (`one of --get, --set, --unset, --list`), which proves the no-args branch went to the TUI
  - Note: Test 3 as built uses `--set some.key --value unset --global` (`is not a storable value`) plus `--set mcp.serena --value true --global` (`is scope:`), since the engine warns-and-writes for unknown keys rather than refusing them
- [x] Run `node --test test/cli-config-subcommand.test.js` and then the full suite (`node --test 'test/*.test.js'`) — new file 4/4 pass; full suite has failures outside this task (sibling TASK-0112 task-add rename in flight, plus known pre-existing), none from this file
<!-- Updated: 2026-09-19 -->
<!-- Step 3 done -->


### 4. Verify packaging and existing wiring  <!-- agent: general-purpose -->

- [x] Run `npm pack --dry-run` and confirm `lib/scripts/bootstrap-prefs-tui.js`, `lib/scripts/bootstrap-prefs.js`, and `lib/scripts/templates/bootstrap-prefs-schema.json` appear in the tarball listing; no `package.json` edit should be needed
- [x] Confirm `test/cli-deploy-removed.test.js` still passes (its usage assertions iterate a fixed command list, so adding `config` must not break it)
- [x] Do not run `install-global.sh`
<!-- Updated: 2026-09-19 -->
<!-- Step 4 done: all three files in tarball (TUI mode 755) -->

