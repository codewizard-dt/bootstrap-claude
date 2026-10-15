---
id: UAT-0105
aliases: [UAT-0105]
title: "UAT: Verify the bootstrap-prefs TUI: automated tests for the menu flow, scope refusal, and the guides.* / gitignore.section.* families"
status: pending
task: TASK-0105
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0105 — UAT: Verify the bootstrap-prefs TUI: automated tests for the menu flow, scope refusal, and the guides.* / gitignore.section.* families

implements::[[TASK-0105]]

> **Source task**: [[TASK-0105]]
> **Generated**: 2026-09-19

The deliverable of TASK-0105 is itself a test file, `test/bootstrap-prefs-tui-verification.test.js` (42 tests; the task text says `test/bootstrap-prefs-tui.test.js`, but that name is owned by TASK-0103). This UAT is therefore **meta-verification**: each case runs the slice of that file that covers one acceptance criterion and asserts the count, so a `--test-name-pattern` that silently matches 0 tests (or a test that has been deleted or skipped) shows up as a wrong count rather than a green run. Two checks need a real terminal and are manual (UAT-UI-001, UAT-EDGE-022).

Conventions for every command below:

- Run from the repository root, with an explicit file path (never `node --test test/`).
- The suite is hermetic: every TUI/CLI/engine process it spawns gets a scratch `HOME` and scratch project dir, and `withLayers()` refuses to run a body if the redirect did not take (UAT-INT-001). Nothing here touches the real `~/.claude`.
- `--test-name-pattern` is a regex matched against the test name; the patterns used below are literal substrings that were each verified to select exactly the stated number of tests. Multiple `--test-name-pattern` flags are OR-ed.
- "N tests, N pass, 0 fail, 0 skipped" is read from the runner's summary (`ℹ tests`, `ℹ pass`, `ℹ fail`, `ℹ skipped`, `ℹ todo`).

---

## Prerequisites

- [ ] Working tree checked out at a commit including `lib/scripts/bootstrap-prefs-tui.js`, `bin/cli.js` (`config` subcommand, TASK-0104) and `test/bootstrap-prefs-tui-verification.test.js` (TASK-0105).
- [ ] Node.js available on `PATH` (the built-in `node --test` runner; no external dependencies, no network).
- [ ] For the two manual cases only: an interactive terminal (macOS Terminal/iTerm2 or equivalent), 80 columns wide for UAT-UI-001.

---

## Test Cases

### UAT-INT-001: The suite is hermetic and runs against the live schema
- **Scenario**: Every spawned process gets a scratch `HOME`; `withLayers()` probes the redirect with a read-only `--list` and refuses to run a body whose global layer path is outside the scratch `HOME`, so a `--global` write can never reach the developer's real `~/.claude/bootstrap-prefs.json`. The two BUG-0009 pin keys (`mcp.braveSearch` = `scope: global`, `mcp.serena` = `scope: project`) are asserted to still have the scope the other tests rely on, and the key-picker numbers are derived from the live TUI output rather than hardcoded.
- **Steps**: Run the unit test command below.
- **Expected Result**: 3 tests, 3 pass, 0 fail, 0 skipped: `scaffold: the scratch HOME redirect is honoured…`, `scaffold: the two BUG-0009 pin keys still have the scope…`, `scaffold: pickerNumbers/pickKey derive live numbers…`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="scaffold:" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-002: View-first — the grouped, annotated summary prints before the first prompt
- **Scenario**: SKILL.md Steps A/B. The summary (Installer preferences, then Skill preferences, then Unrecognized keys only when non-empty) is printed before the first prompt; every row carries key, value, `[layer]` bracket and the schema summary. A stored `false` is labelled as a remembered decline, distinct from an unset installer key. An unrecognized key in a values file gets its own group after the skill group and is left untouched.
- **Steps**: Run the unit test command below.
- **Expected Result**: 3 tests, 3 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="view-first:" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-003: No-changes exit writes nothing
- **Scenario**: Choosing Edit, backing out of the key picker with `0`, then choosing `Quit (No changes)` exits 0 and leaves both values files absent and no companion README generated. (The task text describes a "mode question"; the real menu has "No changes" as main-menu item 4 — documented in the test file's DIVERGENCES header.)
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="no-changes exit" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-004: Edit happy path — detail in full, schema-driven values, layer choice, re-list after the write
- **Scenario**: Pick a `scope: either` key: its schema `detail` paragraph prints in full and the values offered equal the schema `values` string split on `|` with no extras; choosing the Global layer (or the Project layer) and confirming writes the value to exactly that layer's JSON, and the post-write "Changed rows" block shows the new value with its layer. `gitCommit.versionBump` offers exactly `auto`, `confirm`, `never` — there is no separate `ask` option.
- **Steps**: Run the unit test command below.
- **Expected Result**: 4 tests, 4 pass, 0 fail, 0 skipped (`edit: every scope-either key…`, two `edit happy path…` tests, `grammar: gitCommit.versionBump…`).
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="edit: every scope-either" --test-name-pattern="edit happy path" --test-name-pattern="grammar: gitCommit" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-005: Skill-preference banner appears for skill keys only
- **Scenario**: Choosing a `consumer: skill` key prints the heavier `SKILL PREFERENCE` banner; every `consumer: installer` key prints the installer text ("This is an installer preference…") and never the skill banner. The test iterates every key in the live schema by its `consumer` property.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="banner:" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-006: Confirm-cancel writes nothing; a successful write generates the companion README
- **Scenario**: Answering `n` or an empty line at the final confirmation cancels: no values file and no companion README exist afterwards. After a confirmed write, `bootstrap-prefs.README.md` exists next to the values file and the TUI says it is generated output ("read it, never hand-edit it").
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="confirm-cancel" --test-name-pattern="companion:" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-007: Reset flow — only stored keys are offered; both-layers question; deletion is absence, never `null`
- **Scenario**: Reset mode offers only keys stored in a writable layer (an `[unset]` key appears under "Not listed"); confirming deletes the key from the JSON (absent, never `null`). A key stored in both layers, with no layer pinned, triggers the "which layer?" question and clearing one layer re-exposes the other layer's answer. A **default-less** key (`mcp.serena`) stored in only one layer does not get the both-layers question. The single-layer negative case deliberately uses a default-less key because of the known defect [[BUG-0012]] (see Gaps/Notes); this case asserts nothing about that defect.
- **Steps**: Run the unit test command below.
- **Expected Result**: 3 tests, 3 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="reset: only stored keys" --test-name-pattern="reset: a key stored in BOTH" --test-name-pattern="reset: a default-less" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Bad input re-prompts; EOF mid-flow exits cleanly without writing
- **Scenario**: A non-numeric, out-of-range or negative selection at the key picker and value picker re-prompts ("Please enter a number from 1 to N (or 0 to go back).") instead of crashing, and the flow still completes; `0` backs out with nothing written. Closing stdin (EOF) after the key pick, after the value pick, at the layer question, at the confirm, and at the reset confirm exits 0 with no stack trace, writes nothing, and leaves a stored value untouched.
- **Steps**: Run the unit test command below.
- **Expected Result**: 4 tests, 4 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="robustness:" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: The interactive flow never offers a forbidden layer
- **Scenario**: With no layer pinned, a `scope: global` key states the global layer only (no layer question, no project-layer text); a `scope: project` key states the project layer only (no layer question, no global-layer text); a `scope: either` key offers both layers with the "Project wins over global, per key" explanation. Keys are picked from the live schema by their `scope` property.
- **Steps**: Run the unit test command below.
- **Expected Result**: 3 tests, 3 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="scope: a scope:" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: No project directory — a project-scoped key aborts and never falls back to global
- **Scenario**: Run the TUI with cwd in a scratch dir that has no `.git` and no `.claude/`. Editing a `scope: project` key prints "Cannot edit", aborts before the value picker, and the global values file is absent (no silent fallback). Positive control: editing a `scope: global` key in the same situation still writes the global layer.
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="scope: no project directory" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-011: Passthrough refusal (BUG-0009-style) — wrong-scope `--set` via `bootstrap config` exits 1 and writes nothing
- **Scenario**: `bootstrap config --set mcp.braveSearch --value true --project <dir>` (global-scope key into the project layer) exits 1 with stderr naming the key, `scope: global` and `--global`; the mirror image `--set mcp.serena … --global` (project-scope key into the global layer) exits 1 naming `scope: project` and `--project <dir>`. In both cases neither values file exists afterwards. Driven through `bin/cli.js`, which is the passthrough entry point.
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="--set <global key> --project" --test-name-pattern="--set <project key> --global" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-012: The CLI wrapper propagates the engine's exit code and message verbatim; the TUI itself rejects engine flags
- **Scenario**: The exit status and stderr of `bootstrap config --set …` (refused) equal the engine's own — the wrapper neither swallows the non-zero exit nor rewrites the message. The TUI binary itself does not accept `--set` (exit 2, `unknown argument`): passthrough is a CLI concern, and "directly on the TUI" only applies to the `--global` / `--project` pins.
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="the CLI exit status and stderr equal" --test-name-pattern="the TUI itself does not accept" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-013: `--target` stays scope-exempt
- **Scenario**: `--set <global-scope key> --target <scratch file>` exits 0 and writes exactly that file; neither the project nor the global values file is touched.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="--target is scope-exempt" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-014: `--unset` stays permissive — a scope-inert key planted in the wrong layer can be removed via the CLI
- **Scenario**: A scope-inert key is planted directly in the wrong layer's JSON (bypassing the CLI, per BUG-0009's fixture rewrite). `bootstrap config --unset <key>` removes it, so the documented workaround still works. (Whether the interactive reset mode also lists such a key is a known limitation, recorded under Gaps/Notes — this case asserts only the CLI/engine path.)
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="--unset is permissive" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-015: `guides.*` — pattern row when empty, concrete keys listed individually
- **Scenario**: With no concrete keys stored, the summary shows the `guides.*` family row with an explanation ("family: one key per optional guide … None stored yet."), not a bare literal `.*`. With `guides.evals-framework.md` = `true` and `guides.type-checking-templates` = `false` stored in the project layer, each appears as its own row with a `[project]` annotation, the `false` is labelled a remembered decline, and the placeholder row is gone.
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="with no concrete keys stored" --test-name-pattern="stored concrete keys are listed individually" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-016: `guides.*` — set/reset through the TUI; a `--global` pin is refused
- **Scenario**: Setting a `guides.*` key through the TUI offers exactly `true` and `false`, round-trips through the engine (`--get` reads it back), and reset deletes the key (absent, never `null`). A `--global` pin is refused by the engine (`scope: project`) and nothing is written.
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="guides.*: set through the TUI" --test-name-pattern="guides.*: a --global pin is refused" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-017: `guides.*` — free-text key entry, and the engine (not the TUI) rejects an illegal value
- **Scenario**: The "Enter a key by name" affordance accepts a typed concrete `guides.<name>` key that is not currently stored. A typo'd value such as `maybe` cannot be typed in the TUI (only schema values are offered), so the illegal-value rejection is asserted through the engine/CLI: exit 1 with `is not a legal value for guides.x — expected one of: true, false` surfaced verbatim.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="Enter a key by name" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-018: `gitignore.section.*` — slug fidelity for the em-dash template title
- **Scenario**: The slug the engine derives with `--section-key "<banner title>"` for the em-dash section title in `lib/scripts/templates/gitignore` (`Claude Code — machine-local MCP registration …`) is exactly the key the TUI accepts and stores (value `false`). Template titles are parsed from the shipped file, not hardcoded.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="an em-dash template title" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-019: `gitignore.section.*` — false-only grammar, and reset re-opens the question
- **Scenario**: The value picker offers only `false`; the family explanation says an accepted section is "deliberately never recorded". The engine refuses `--set gitignore.section.<slug> --value true` (exit 1, nothing written) and a `--global` pin (`scope: project`); `--value false` succeeds in the project layer. After a stored `false`, resetting through the TUI removes the key (absent, never `null`) and the question is asked again.
- **Steps**: Run the unit test command below.
- **Expected Result**: 2 tests, 2 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="the grammar is false-only" --test-name-pattern="gitignore.section.*: a stored false is reset" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-020: Family prefix matches are anchored on the literal dot
- **Scenario**: `guidesX.foo` and `gitignore.sectionX.bar` do not match either dynamic family; both are grouped under "Unrecognized keys" (and left untouched), never shown as `guides.*` / `gitignore.section.*` rows.
- **Steps**: Run the unit test command below.
- **Expected Result**: 1 test, 1 pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="families: guidesX.foo" test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-008: The whole verification file is green, has no skipped or todo tests, and finishes without orphaned children
- **Scenario**: Task Step 6 acceptance — the file as a whole passes. Every case above is a slice of this run; this case pins the total (42) so a deleted or newly `skip`/`todo`-marked test is caught. Every spawn uses `spawnSync` with a 15 s kill timeout, so the run must return (about 15 s wall under load; the task's "under ~10 s" target was knowingly relaxed because each test spawns several node processes serially) rather than hang. This deliberately runs the one file, not the whole `npm test` suite.
- **Steps**: Run the unit test command below.
- **Expected Result**: `ℹ tests 42`, `ℹ pass 42`, `ℹ fail 0`, `ℹ skipped 0`, `ℹ todo 0`; the command returns on its own.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs-tui-verification.test.js`
- **Unit Test Command**: `node --test test/bootstrap-prefs-tui-verification.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-021: Mutation check — breaking the layer-offer logic or the engine delegation turns the suite red (scratch copy)
- **Scenario**: The suite must be able to fail. Task Step 6 recorded two mutations on an isolated scratch copy; this case re-runs both against a fresh scratch copy so the evidence is reproducible. Mutation A makes a `scope: global` key also offer the project layer (violating "never offers a forbidden layer"); mutation B makes `commitWrite` skip the engine, reporting success without invoking `bootstrap-prefs.js` (violating "delegates every write to the engine"). The live `lib/scripts/bootstrap-prefs-tui.js` is never edited — the mutations touch only the scratch copy, which is deleted at the end.
- **Steps**:
  1. Create the scratch copy (from the repo root):
     ```bash
     S="${TMPDIR:-/tmp}/uat0105-mut"; rm -rf "$S"; mkdir -p "$S/test" "$S/lib" && cp -R bin "$S/bin" && cp -R lib/scripts "$S/lib/scripts" && cp test/bootstrap-prefs-tui-verification.test.js "$S/test/" && cp package.json "$S/"
     ```
  2. Baseline (unmutated copy) — must be green: `cd "${TMPDIR:-/tmp}/uat0105-mut" && node --test --test-name-pattern="scope: a scope:" --test-name-pattern="edit happy path" test/bootstrap-prefs-tui-verification.test.js` → 5 tests, 5 pass, 0 fail.
  3. Mutation A: in `${TMPDIR:-/tmp}/uat0105-mut/lib/scripts/bootstrap-prefs-tui.js`, function `permittedLayers`, replace the line `if (scope === 'global') return { layers: [globalLayer()], error: null };` with `if (scope === 'global') return { layers: projectDir ? [projectLayer(), globalLayer()] : [globalLayer()], error: null };`. Re-run the step 2 command for the `scope: a scope:` tests only: `cd "${TMPDIR:-/tmp}/uat0105-mut" && node --test --test-name-pattern="scope: a scope:" test/bootstrap-prefs-tui-verification.test.js`. Expect 3 tests, 2 pass, 1 fail — the failing test is `scope: a scope:global key states the global layer only…`, with the assertion `expected /^Layer: Global layer \(.+bootstrap-prefs\.json\) — applies to every project…/m`. Undo the edit (restore the original line).
  4. Mutation B: in the same scratch file, function `commitWrite`, replace `const result = runEngine(engineArgs, { schema: ctx.schemaPath });` with `const result = { status: 0, stdout: '', stderr: '' };`. Run `cd "${TMPDIR:-/tmp}/uat0105-mut" && node --test --test-name-pattern="edit happy path" test/bootstrap-prefs-tui-verification.test.js`. Expect 2 tests, 0 pass, 2 fail (the value never lands in the values JSON because nothing wrote it). Running the whole file against this mutation fails 16 of 42 tests, so the delegation contract is guarded broadly, not by one test.
  5. Delete the scratch copy: `rm -rf "${TMPDIR:-/tmp}/uat0105-mut"`.
- **Expected Result**: Baseline green (5/5); mutation A fails exactly 1 of 3 `scope: a scope:` tests, naming the global-layer statement; mutation B fails both `edit happy path` tests. Both mutations were reproduced on 2026-09-19 with these exact edits (whole-file counts: A = 1 of 42 fail; B = 16 of 42 fail). The live TUI file is byte-identical before and after.
- **Repeatable Unit Test**: Not applicable: a mutation of the production file cannot live inside the unit suite it mutates (the same reasoning as the mutation probes in UAT-034 and UAT-047); the unmutated half of the check is UAT-EDGE-009 and UAT-INT-004.
- [FAIL: auto-judge: manual test requires human verification (multi-step scratch-copy mutation, no single machine-executable command and no unit test; not executed)] <!-- 2026-09-19 -->

### UAT-UI-001: Manual — visual rendering in a real TTY
- **Page**: Terminal (`node bin/cli.js config`) in an interactive terminal window, 80 columns wide.
- **Description**: Piped stdin (non-TTY) cannot show how the TUI actually looks: heading emphasis, row alignment, colour or its deliberate absence, and how long `detail` paragraphs wrap. This is one of the two residual checks named in the task (Step 7) and in the test file's header.
- **Steps**:
  1. From the repo root create a scratch environment: `SCRATCH="$(mktemp -d)"; mkdir -p "$SCRATCH/home" "$SCRATCH/proj/.claude"; echo "$SCRATCH"`.
  2. Start the TUI with the scratch layers, never the real home: `HOME="$SCRATCH/home" node bin/cli.js config --project "$SCRATCH/proj"`.
  3. Observe the state summary that prints before the first prompt: group headings ("Installer preferences", "Skill preferences") are visually distinct; each row shows key, value, and a `[layer]` bracket, with the schema summary on an indented line beneath; `[unset]` / `[default]` annotations line up readably.
  4. Choose `1` (Edit), then a key with a long detail paragraph (e.g. `mcp.braveSearch`). Confirm the detail wraps sensibly at 80 columns without mid-word breaks or runaway lines, and the layer/value menus print with numbered options and the `0) Back / No changes` line.
  5. Choose `0` then `4` (Quit) to exit with no changes.
- **Expected Result**: The output is readable at 80 columns: headings distinguishable, rows aligned, no garbled escape sequences (colour either renders correctly or is absent — never literal `[0m` text), long paragraphs wrap legibly, and the session ends with "No changes." Nothing under `$SCRATCH` was written. Remove it afterwards: `rm -rf "$SCRATCH"`.
- **Repeatable Unit Test**: Not applicable: visual rendering in a real TTY cannot be observed from a piped, non-TTY test driver (the content and ordering of the output are asserted by UAT-INT-002 and UAT-INT-004; only how it looks is manual).
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-09-19 -->

### UAT-EDGE-022: Manual — Ctrl-C restores the terminal and leaves no partial write
- **Scenario**: SIGINT in a real terminal must restore terminal state (echo on, cursor visible, no orphaned raw mode) and must not leave a half-written values file. Piped EOF is covered by UAT-EDGE-008; raw-mode SIGINT is unreachable without a pty, so this is the second of the task's two residual manual checks.
- **Steps**:
  1. Create a scratch environment as in UAT-UI-001 step 1 and start the TUI with `HOME="$SCRATCH/home" node bin/cli.js config --project "$SCRATCH/proj"`.
  2. At the main-menu prompt press Ctrl-C. Confirm you are returned to the shell prompt; type a few characters and confirm they echo, the cursor is visible, and Enter behaves normally (optionally run `stty -a` and confirm `echo` and `icanon` are present, not negated).
  3. Start the TUI again. Choose `1` (Edit), pick a key, pick a value, and at the final confirm prompt (before answering) press Ctrl-C. Repeat the terminal-state check from step 2.
  4. Inspect the scratch layers: `ls -A "$SCRATCH/home/.claude" "$SCRATCH/proj/.claude"`. Neither `bootstrap-prefs.json` nor `bootstrap-prefs.README.md` may exist (step 3 was cancelled before the confirm was answered), and no temp/partial file is left beside them.
  5. Clean up: `rm -rf "$SCRATCH"`.
- **Expected Result**: The shell is fully usable after both interruptions (echo on, cursor visible, no stuck raw mode, no dangling child process — `ps` shows no leftover `bootstrap-prefs` node processes), and the scratch project and home contain no values file, README, or partial write.
- **Repeatable Unit Test**: Not applicable: terminal restoration on SIGINT depends on a real TTY in raw mode and cannot be exercised from a piped test driver.
- [FAIL: auto-judge: manual test requires human verification (real-TTY SIGINT)] <!-- 2026-09-19 -->

---

## Gaps / Notes

- **Known defect, not asserted here — [[BUG-0012]] (open, low)**: in the TUI's reset mode, a `scope: either` key that has a schema default (every such key) and is stored in only one layer still produces a false "stored in BOTH layers" question, because `storedLayers()` treats the engine's resolved default as "stored". No case in this UAT expects the buggy behaviour or fails on it: UAT-INT-007's single-layer negative assertion deliberately uses the default-less `mcp.serena`, and the both-layers positive case seeds both layers for real. When BUG-0012 is fixed, a regression test using a defaulted key (e.g. a skill key stored only in the project layer) should be added to `test/bootstrap-prefs-tui-verification.test.js` and a case here.
- **Known limitation, asserted only via CLI**: the TUI's `--list` resolves a scope-inert key planted in the wrong layer as `[unset]`, so interactive reset lists it under "Not listed". The `--unset` workaround therefore works through `bootstrap config --unset …` (UAT-EDGE-014) rather than through the reset menu. The verification test documents this in a comment; it is reported, not patched.
- **Task-text divergences (asserted as reality)**: no separate mode question ("No changes" is main-menu item 4); no literal "only `--unset` re-offers a declined section" wording (the TUI says "deliberately never recorded" and reset "will ask that question again"); the empty `guides.*` note does not name `OPTIONAL_GUIDES` (it appears in the schema detail after choosing the family); a `maybe` typo cannot be typed in the TUI, so it is rejected by the engine; the TUI binary itself rejects `--set`/`--get`/`--unset`/`--list`/`--section-key` (exit 2) — passthrough is a CLI concern. All six are listed in the test file's DIVERGENCES header.
- **Runtime target**: the task's "under ~10 s" goal is not met under load (about 13-16 s wall for 42 serial spawn-heavy tests); this was accepted in the task and UAT-INT-008 asserts completion and count, not a wall-clock ceiling.
- **Deliberately not included**: the full `npm test` suite (per this UAT's scope, so an unrelated pre-existing failure elsewhere cannot mask or fail these cases), and any cases for TASK-0103's module internals (UAT-0103) or TASK-0104's `bin/cli.js` routing (`test/cli-config-subcommand.test.js`).
- **Repeatable unit tests**: none were created by this UAT. `uatGenerate.promoteTests` is the legacy value `true` (→ `dedicated`); every promotable behaviour is already covered by the task's own `test/bootstrap-prefs-tui-verification.test.js`, which is extended in place under the project's layout rule rather than duplicated. `/bootstrap-config` can update the stored value to the current grammar.
