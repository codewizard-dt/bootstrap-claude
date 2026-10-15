---
id: UAT-0104
aliases: [UAT-0104]
title: "UAT: Wire bootstrap-prefs-tui.js into bin/cli.js as a `config` subcommand"
status: passed
task: TASK-0104
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0104 — UAT: Wire bootstrap-prefs-tui.js into bin/cli.js as a `config` subcommand

implements::[[TASK-0104]]

> **Source task**: [[TASK-0104]]
> **Generated**: 2026-09-19

Scope: the routing in `bin/cli.js` only (`configTarget`, the `SCRIPTS.config` entry, the usage lines) plus packaging and the executable bit on the TUI. The deep interactive menu flow, scope enforcement inside the menu, and both dynamic families are owned by TASK-0105 and are deliberately not duplicated here.

Documented behaviors these cases respect (do not read them as defects): the TUI has no non-TTY guard (on closed stdin it prints `No changes.` and exits 0 rather than exiting non-zero), and the engine warns-and-writes on unknown `--set` keys rather than refusing them.

---

## Prerequisites

- [ ] Node.js is installed (the suite has been verified on v26; use file-scoped `node --test <file>` commands, not `node --test test/`)
- [ ] Working directory is the repository root
- [ ] `lib/scripts/bootstrap-prefs-tui.js` exists (delivered by TASK-0103)

---

## Test Cases

### UAT-CLI-001: Bare `bootstrap` usage lists the `config` command
- **Scenario**: Running the CLI with no command prints usage to stderr and exits 1; the usage must advertise `config` (with the scripting hint line) after the `dashboard` lines.
- **Steps**:
  1. Run the unit test below (it spawns `node bin/cli.js` with no args).
  2. Optionally run `node bin/cli.js` by hand and confirm a `config` line and a `Scripting:` line appear.
- **Expected Result**: Exit code 1; stderr matches `/\bconfig\b/`; the `config` line reads "View or change bootstrap preferences (interactive menu, no Claude Code needed)".
- **Repeatable Unit Test**: Created: `test/cli-config-subcommand.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="with no args prints usage" test/cli-config-subcommand.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CLI-002: `config --list` passes straight through to the prefs engine
- **Scenario**: An operation flag (`--list`) routes to `bootstrap-prefs.js` with args verbatim, so output is byte-identical to calling the engine directly.
- **Steps**:
  1. Run the unit test below. It writes `{}` to a scratch file under `os.tmpdir()` and runs `config --list --target <file>` and `bootstrap-prefs.js --list --target <file>`.
- **Expected Result**: Both exit 0; the CLI stdout is non-empty and strictly equal to the engine stdout.
- **Repeatable Unit Test**: Created: `test/cli-config-subcommand.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="config --list delegates" test/cli-config-subcommand.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CLI-003: Passthrough surfaces the engine's own refusals and never writes on refusal
- **Scenario**: `config --set` is not intercepted by a wrapper; the engine's validation and scope guard produce the refusal. Run with `HOME` pointed at a temp dir so the real `~/.claude/bootstrap-prefs.json` is never at risk.
- **Steps**:
  1. Run the unit test below. It runs `config --set some.key --value unset --global` and `config --set mcp.serena --value true --global` (a project-scoped key at the global layer).
- **Expected Result**: Both exit 1. First stderr matches `is not a storable value`; second matches `is scope:`. `<scratch HOME>/.claude/bootstrap-prefs.json` is never created.
- **Repeatable Unit Test**: Created: `test/cli-config-subcommand.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="config --set refuses" test/cli-config-subcommand.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CLI-004: `config` with no operation flag routes to the TUI, not the engine
- **Scenario**: With no args the command must run `bootstrap-prefs-tui.js` (interactive menu). With stdin closed the TUI exits on its own (documented: prints `No changes.`, exit 0) and never emits the engine's "one of --get, --set, --unset, --list" usage error.
- **Steps**:
  1. Run the unit test below. It runs `node bin/cli.js config` in a scratch cwd containing `.git`, with a scratch `HOME`, `input: ''` and a 15 s timeout.
- **Expected Result**: The process exits by itself with a numeric status (no timeout/spawn error) and stderr does not match `/one of --get, --set, --unset, --list/`.
- **Repeatable Unit Test**: Created: `test/cli-config-subcommand.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="routes to the TUI" test/cli-config-subcommand.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CLI-005: The routed script's exit code propagates unchanged
- **Scenario**: The dispatch keeps `process.exit(err.status || 1)`, so an engine usage error surfaces as exit 1 with the engine's message, and a TUI argument error (a non-operation flag such as `--bogus` routes to the TUI) surfaces as exit 2 with the TUI's message.
- **Steps**:
  1. Run the unit test below (`config --get` with no key; `config --bogus`).
  2. Optionally run `node bin/cli.js config --get; echo $?` and `node bin/cli.js config --bogus </dev/null; echo $?` by hand.
- **Expected Result**: `config --get` exits 1 with stderr containing `--get requires an argument`; `config --bogus` exits 2 with stderr containing `unknown argument: --bogus`.
- **Repeatable Unit Test**: Created: `test/cli-config-subcommand.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="propagates the routed" test/cli-config-subcommand.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-PKG-001: The published tarball ships the TUI, the engine and the schema
- **Scenario**: No `package.json` edit is needed because `files` already ships `bin/` and `lib/`; the three files the `config` command depends on must appear in the tarball listing.
- **Steps**:
  1. Run the command below (dry run, nothing is written or published).
- **Command**:
  ```bash
  npm pack --dry-run 2>&1 | grep -E 'bootstrap-prefs(-tui)?\.js|bootstrap-prefs-schema\.json'
  ```
- **Expected Result**: Exactly three lines listing `lib/scripts/bootstrap-prefs-tui.js`, `lib/scripts/bootstrap-prefs.js` and `lib/scripts/templates/bootstrap-prefs-schema.json`.
- **Repeatable Unit Test**: Not applicable: depends on `npm pack` packaging output, not deterministic unit-level logic
- [x] Pass <!-- 2026-09-19 -->

### UAT-PKG-002: The TUI script is directly executable
- **Scenario**: `bin/cli.js` runs scripts with `execFileSync(scriptPath, ...)`, so the TUI needs a `#!/usr/bin/env node` shebang and the executable bit on disk.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  test -x lib/scripts/bootstrap-prefs-tui.js && head -n 1 lib/scripts/bootstrap-prefs-tui.js
  ```
- **Expected Result**: Exit 0 and the single output line `#!/usr/bin/env node`.
- **Repeatable Unit Test**: Not applicable: verifies file permissions, which are not reliably assertable in an isolated unit test
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: Adding `config` does not break the existing CLI usage suite
- **Scenario**: `test/cli-deploy-removed.test.js` iterates a fixed command list in its usage assertions; adding a `config` entry must not disturb it.
- **Steps**:
  1. Run the unit test file below.
- **Expected Result**: All tests in `test/cli-deploy-removed.test.js` pass (2 of 2 at generation time), exit 0.
- **Repeatable Unit Test**: Created: `test/cli-deploy-removed.test.js` (pre-existing suite, reused as the regression check)
- **Unit Test Command**: `node --test test/cli-deploy-removed.test.js`
- [x] Pass <!-- 2026-09-19 -->
