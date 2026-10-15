---
id: UAT-0103
aliases: [UAT-0103]
title: "UAT: Build bootstrap-prefs-tui.js: readline menu porting /bootstrap-config Step A-G"
status: pending
task: TASK-0103
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0103 — UAT: Build bootstrap-prefs-tui.js: readline menu porting /bootstrap-config Step A-G

implements::[[TASK-0103]]

> **Source task**: [[TASK-0103]]
> **Generated**: 2026-09-19

Scope note: this UAT covers TASK-0103's own acceptance criteria (the module, its engine-only-writer contract, schema-driven pickers, layer rules, list parsing, the Step A-G menu spine, and input handling). The dedicated verification of the menu flow, BUG-0009 scope refusal, and the `guides.*` / `gitignore.section.*` dynamic families belongs to [[TASK-0105]] and is deliberately not duplicated here. `bin/cli.js` wiring is [[TASK-0104]]. Every unit-backed case runs against a scratch `HOME` and scratch project dir; nothing touches the real `~/.claude`.

---

## Prerequisites

- [ ] Working tree checked out at a commit including `lib/scripts/bootstrap-prefs-tui.js` and `test/bootstrap-prefs-tui.test.js` (TASK-0103).
- [ ] Node.js available on `PATH` (the `node --test` runner; no external dependencies).
- [ ] Commands run from the repository root. Use file-scoped commands as written (not `node --test test/`).

---

## Test Cases

### UAT-EDGE-001: The TUI never writes a values file or README itself; the engine is the only writer
- **Scenario**: Every read and write must be a child-process call to `bootstrap-prefs.js` (`spawnSync(process.execPath, [ENGINE, ...])`). The module must not `require()` the engine and must contain no filesystem write call, so schema validation, scope refusal, coercion, and atomic writes are inherited unchanged.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the source-scan test passes: no `writeFileSync`, `appendFile`, `rename`, `mkdirSync`, `rmSync`, etc. outside comments, no `require('./bootstrap-prefs')`, and the `spawnSync(process.execPath, [ENGINE` call present.
- **Expected Result**: The run reports 1 test, 1 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="never writes a values file" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: The legal value list always comes from the schema `values` string, never hardcoded
- **Scenario**: `parseValues` splits `entry.values` on `|` and trims. `auto | confirm | never` yields exactly three options with no `ask`; `false` yields exactly one; no entry or no `values` string yields `[]`. Against the shipped schema, `gitCommit.versionBump` is `auto | confirm | never` (no separate `ask`) and `gitignore.section.<slug>` is `false` only.
- **Steps**: Run the unit test command below.
- **Expected Result**: 4 tests, 4 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="parseValues" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Schema lookup matches dynamic families by prefix, mirroring the engine
- **Scenario**: `resolveEntry` matches an exact key first (including the `guides.*` / `gitignore.section.*` pattern rows), then a `dynamic: true` pattern by prefix for any key longer than the bare prefix. Unknown keys, a bare prefix (`guides.`), and a non-dynamic pattern-looking key (`plain.*`) must not match.
- **Steps**: Run the unit test command below.
- **Expected Result**: 3 tests, 3 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="resolveEntry" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Layer offering follows the key's scope; `scope: project` with no project never falls back to global
- **Scenario**: `permittedLayers` returns project-only for `scope: project`, global-only for `scope: global`, both (project first) for `scope: either` when a project exists, global-only for `either` with no project, and an explanatory error (no layers) for `scope: project` with no project dir. A `--global` / `--project` pin restricts the result and is kept even against the scope so the engine's own refusal is what the user sees; a project pin with no project dir is an error.
- **Steps**: Run the unit test command below.
- **Expected Result**: 6 tests, 6 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="permittedLayers" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: `parseListOutput` accepts the engine's real `--list` grammar
- **Scenario**: Against real engine `--list` output, the parser recovers key, value, `[layer]` (project / global / default / unset / target), the schema summary line, and the group, including the Unrecognized-keys group (no summary), dynamic-family placeholder rows (`guides.*`, `gitignore.section.*`), concrete dynamic keys replacing their placeholder, the `Layers:` / `No --project given` / `Showing` trailers, and empty or garbage input (no rows, null trailer).
- **Steps**: Run the unit test command below.
- **Expected Result**: 4 tests, 4 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="parseListOutput" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: The grouped, annotated summary prints before the first prompt
- **Scenario**: Steps A/B/B2. Starting the menu with a scratch schema and piping only `Quit`, stdout must show "Installer preferences", then "Skill preferences", then the "What would you like to do?" prompt, in that order; rows show `[layer]` annotations, `alpha.skill` renders as unset/`[default]`, and the `guides.*` family renders as unset.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="summary prints before the first prompt" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: Edit then reset a `scope: either` key round-trips through the engine (Steps E, F, G)
- **Scenario**: Piped menu answers pick Edit, a skill key, a value, then `y`. The transcript must show the heavier "SKILL PREFERENCE" banner, the exact `node <engine> --set alpha.skill --value confirm --project <dir>` command before confirmation, the changed row with its layer, the `bootstrap-prefs.README.md` regeneration note, the never-store-a-secret warning, and "Done." The project values file must hold exactly `{"alpha.skill":"confirm"}` (verified independently via the engine `--get`), and the global file must not exist. Reset (`--unset ... --project`) then empties the file and the engine `--get` falls back to the schema default.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="edit a scope-either key to the project layer" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: With no layer pinned, a `scope: either` key asks for the layer and explains that project wins over global
- **Scenario**: Run from a project directory (has `.claude/`) with no `--project` / `--global` flag. Editing `alpha.skill` offers both layers, project first, with "Project wins over global, per key". Choosing the global layer prints `--set alpha.skill --value never --global`, writes only the global file, and leaves the project file absent.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="layer picker is offered" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: Quit and end-of-input exit 0, say "No changes.", and write nothing
- **Scenario**: Choosing Quit with no edits, and stdin ending mid-menu (EOF, the piped equivalent of Ctrl-C), must both exit 0 with "No changes." and leave the scratch project without a `.claude` directory and the scratch `HOME` empty.
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="quit with no changes|EOF mid-menu" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: Declining the y/N confirmation writes nothing, and bad input re-prompts instead of crashing
- **Scenario**: Answering `n` at "Apply this change? [y/N]" prints "Cancelled. Nothing was written." and no values file appears. Empty input, an out-of-range number, and non-numeric input at a numbered picker each re-prompt ("Please enter a number from 1 to 4") and the menu still exits 0 with "No changes."
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="declining the y/N|bad input re-prompts" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-011: A non-zero engine exit is printed verbatim, nothing is retried, and the menu continues
- **Scenario**: When the engine refuses a write, the TUI must print the engine's stderr text unchanged plus "Nothing was written.", not retry or work around it, return to the menu, and still exit 0 with "No changes." Evidence here is the passthrough of the engine's refusal text (`"beta.global" is scope: global` when the project layer is pinned, `"gamma.project" is scope: project` when the global layer is pinned). Whether the scope rule itself is enforced end to end is owned by TASK-0105.
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="scope:" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-012: Argument parsing accepts the documented flags and rejects the rest
- **Scenario**: `parseArgs` accepts `--global`, `--project <dir>`, `--schema <path>`, and `-h/--help`; sets `pin` to `global` or `project` accordingly; and reports an error for an unknown argument, a flag missing its operand, and `--global` combined with `--project`.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="parseArgs" test/bootstrap-prefs-tui.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CLI-001: `--help` prints usage and exits 0
- **Description**: The module is directly executable from a repo checkout and documents its three flags.
- **Steps**:
  1. Run the command below from the repository root.
  2. Confirm the printed text, then check the exit status with `echo $?` in the same shell.
- **Command**:
  ```bash
  node lib/scripts/bootstrap-prefs-tui.js --help
  ```
- **Expected Result**: Prints `Usage:` followed by the lines `bootstrap-prefs-tui.js [--global] [--project <dir>] [--schema <path>]` and `bootstrap-prefs-tui.js -h | --help`; exit status 0; no menu is shown and no files are written.
- **Repeatable Unit Test**: Not applicable: process exit code and printed usage of the real entry point; the flag parsing behind it is covered by UAT-EDGE-012.
- [x] Pass <!-- 2026-09-19 -->

### UAT-CLI-002: An unknown argument prints an error plus usage on stderr and exits 2
- **Description**: A usage error is distinguishable from a normal exit.
- **Steps**:
  1. Run the command below from the repository root.
  2. Check the exit status with `echo $?` in the same shell.
- **Command**:
  ```bash
  node lib/scripts/bootstrap-prefs-tui.js --bogus
  ```
- **Expected Result**: stderr shows `Error: unknown argument: --bogus` followed by the usage text; exit status 2; no menu is shown.
- **Repeatable Unit Test**: Not applicable: exit code of the real entry point; the underlying error detection is covered by UAT-EDGE-012.
- [x] Pass <!-- 2026-09-19 -->

### UAT-CLI-003: The module ships in the npm package
- **Description**: `lib/` is in `package.json` `files`, so `lib/scripts/bootstrap-prefs-tui.js` must appear in the published tarball (it resolves the engine and schema relative to `__dirname`).
- **Steps**: Run the command below from the repository root (dry run; nothing is published or written).
- **Command**:
  ```bash
  npm pack --dry-run --json | jq '[.[0].files[].path | select(endswith("bootstrap-prefs-tui.js"))]'
  ```
- **Expected Result**: Output is the JSON array `["lib/scripts/bootstrap-prefs-tui.js"]`.
- **Repeatable Unit Test**: Not applicable: depends on the `npm pack` file manifest; `test/npm-pack-contents.test.js` does not list this file.
- [x] Pass <!-- 2026-09-19 -->

### UAT-UI-001: Real-terminal smoke run: menu renders, Quit exits 0, Ctrl-C restores the terminal
- **Page**: Interactive terminal (a real TTY, not a pipe)
- **Description**: Piped tests cannot show visual rendering or TTY restore. This is the manual check for what the summary and menus look like and that Ctrl-C leaves the terminal usable. It runs against a throwaway `HOME` and project dir so the real `~/.claude` is untouched.
- **Steps**:
  1. In a real terminal at the repository root, run the command below.
  2. Read the printed summary: groups "Installer preferences" and "Skill preferences", each row showing key, value, `[layer]`, and a summary line; `unset`, `[default: no stored answer]`, and family rows are visually distinguishable.
  3. At "What would you like to do?", type `4` and press Enter.
  4. Confirm the last line is `No changes.` and the shell prompt returns normally.
  5. Run the command again, and at the menu press Ctrl-C. Confirm `No changes.` is printed, the process exits, and typed characters echo normally afterwards (the terminal is not left in raw mode).
  6. Confirm the scratch directories contain no `bootstrap-prefs.json` (e.g. `find` the printed paths, or re-run and note the summary shows no stored values).
- **Command**:
  ```bash
  HOME="$(mktemp -d)" node lib/scripts/bootstrap-prefs-tui.js --project "$(mktemp -d)"
  ```
- **Expected Result**: The summary is readable and correctly grouped; Quit exits 0 with `No changes.`; Ctrl-C exits cleanly with `No changes.` and a usable terminal; no values file is created.
- **Repeatable Unit Test**: Not applicable: needs a real TTY for rendering and terminal restore; the piped Quit and end-of-input paths are covered by UAT-EDGE-006 and UAT-EDGE-009.
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-09-19 -->
