---
id: UAT-061
title: "UAT: Ship a default .obsidian/graph.json template into install-obsidian.sh"
status: passed
task: TASK-061
created: 2026-08-15
updated: 2026-08-15
---

# UAT-061 — UAT: Ship a default .obsidian/graph.json template into install-obsidian.sh

implements::[[TASK-061]]

> **Source task**: [[TASK-061]]
> **Generated**: 2026-08-15

**Scope note.** TASK-061 is a shell-script + static-data change: a new hand-authored `lib/scripts/templates/obsidian/graph.json`, a new `_install_obsidian_graph_defaults` function and gate wired into `lib/scripts/install-obsidian.sh`, and a new `obsidian.graphDefaults` key in `lib/scripts/templates/bootstrap-prefs-schema.json`. There is no HTTP endpoint or browser UI here — every test case below is an **EDGE** case (installer/CLI behavior and static-file-shape assertions), following the same convention as UAT-054 and UAT-059 for this same script.

All four "Steps" checkboxes in the task are already marked complete, including "Tests" (`test/install-obsidian.test.js` + `test/bootstrap-prefs.test.js`, 347/347 passing per the task's own Notes). This UAT independently re-verified that claim (348/348, one test higher — see UAT-EDGE-006 below) rather than trusting it, and found one real coverage gap that has since been closed as part of this generation.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ and `bash` available on `PATH` (the suite runs `node --test`)
- [ ] `lib/scripts/templates/obsidian/graph.json` and `lib/scripts/install-obsidian.sh` exist at their documented paths
- [ ] `npm test` baseline green before starting

**Safety.** Every case below runs the real `lib/scripts/install-obsidian.sh` against a scratch `$HOME` and scratch project directory (`fs.mkdtempSync`), with a curated `PATH`/`HOME` env — no case touches this repo's own `.obsidian/`, the real `~/.claude/bootstrap-prefs.json`, or the network (all cases here keep `obsidian.installApp`/`obsidian.plugins` out of scope via a stored `false`, so no `curl`/`brew`/`flatpak` call is reached).

---

## Test Cases

### UAT-EDGE-001: A fresh vault gets `.obsidian/graph.json` written, scoped to `path:wiki`, with exactly 9 `colorGroups`
- **Scenario**: TASK-061 step 2's `_install_obsidian_graph_defaults` must create `.obsidian/` if absent and copy the template in when no `graph.json` already exists — the write-if-absent happy path.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it invokes the real, unmodified `install-obsidian.sh --project-dir <scratch>` against a scratch project dir that has no pre-existing `.obsidian/graph.json`.
  3. Confirm the process exits 0, `.obsidian/graph.json` now exists, its `search` field is exactly `"path:wiki"`, and `colorGroups` is an array of exactly 9 entries.
- **Expected Result**: Exit 0; `.obsidian/graph.json` created; `search === "path:wiki"`; `colorGroups.length === 9`.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: a fresh vault (no pre-existing .obsidian/graph.json) gets the file written with exactly 9 colorGroups and "search": "path:wiki"`) — pre-existing, verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="a fresh vault \(no pre-existing .obsidian/graph.json\) gets the file written" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-002: `colorGroups` carry the exact 9 `{query, rgb}` pairs from the task's Approach table, and none targets `raw/`
- **Scenario**: The task's Approach table pins nine exact `{path, hex}` pairs, each `rgb` computed via `parseInt(hex, 16)` — not hand-computed. UAT-EDGE-001's installer-level check only asserts `colorGroups.length === 9` and the top-level `search` filter; it never checked *which* nine paths/colors landed in the array, so a swapped hue, a transposed digit in an `rgb` integer, or an accidental `raw/` entry would still pass that check. This is a genuine coverage gap discovered during this UAT generation (confirmed via `search_for_pattern` across `test/` for the documented rgb integers — no hits before this generation) and closed here.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `lib/scripts/templates/obsidian/graph.json` directly (no installer run needed — pure static-data assertion) and checks all 9 `{query, color:{a:1, rgb}}` pairs against the task table, plus asserts no `colorGroups` entry's `query` starts with `path:raw`.
- **Expected Result**: All 9 pairs match exactly; no `raw/`-targeting entry present.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `lib/scripts/templates/obsidian/graph.json: colorGroups carry the exact query + rgb pairs documented in TASK-061, and no group targets raw/`) — **new test added during this UAT generation** to close the gap described above.
- **Unit Test Command**: `node --test --test-name-pattern="colorGroups carry the exact query" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-003: An existing `.obsidian/graph.json` is left byte-for-byte unchanged (write-if-absent never clobbers a user customization)
- **Scenario**: TASK-061's Objective explicitly requires "never clobber a user's own customized `graph.json`." A pre-existing file at the target path must short-circuit the copy and print the documented skip message.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds a scratch `.obsidian/graph.json` with arbitrary user content before running the installer.
  3. Confirm the process exits 0, prints `.obsidian/graph.json already present — leaving your customization in place, skipping.`, and the file's bytes are unchanged after the run.
- **Expected Result**: Exit 0; skip message printed; file contents identical before/after (exact string equality, not just "still valid JSON").
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: an existing .obsidian/graph.json is left byte-for-byte unchanged (write-if-absent)`) — pre-existing, verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="an existing .obsidian/graph.json is left byte-for-byte unchanged" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-004: Non-interactive + stored `obsidian.graphDefaults=false` skips the install and never writes `graph.json`
- **Scenario**: TASK-061 step 2 requires the non-interactive gate to mirror `obsidian.plugins`'s existing contract exactly: only an explicit stored `false` diverts.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds `obsidian.graphDefaults=false` at the project selector (via `bootstrap-prefs.js --set ... --project <scratch>`) before running the installer non-interactively.
  3. Confirm the process exits 0, prints `obsidian.graphDefaults: skipped (remembered decline — change with /bootstrap-config)`, and `.obsidian/graph.json` was never created.
- **Expected Result**: Exit 0; remembered-decline message printed; no `graph.json` written.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: non-interactive + stored obsidian.graphDefaults=false at the project selector skips the graph defaults install`) — pre-existing, verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="stored obsidian.graphDefaults=false at the project selector skips" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-005: Non-interactive with NO stored `obsidian.graphDefaults` preference proceeds with the install (unset does not divert)
- **Scenario**: The counterpart to UAT-EDGE-004 — an unset key must behave like `true`/`ask`, proceeding with the install, exactly mirroring `obsidian.plugins`'s and `obsidian.installApp`'s established non-interactive contract.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs the installer non-interactively against a scratch project dir with `obsidian.graphDefaults` intentionally left unset.
  3. Confirm the process exits 0 and `.obsidian/graph.json` was written.
- **Expected Result**: Exit 0; `graph.json` written despite no stored preference.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: non-interactive with NO stored obsidian.graphDefaults preference proceeds with the graph defaults install (unset does not divert, only an explicit false does)`) — pre-existing, verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="NO stored obsidian.graphDefaults preference proceeds" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-006: The interactive flow now prompts for graph defaults as a third, independent decline — declining all three leaves `.obsidian/` fully untouched
- **Scenario**: TASK-061 adds a third `prompt_yn_sticky` prompt alongside the pre-existing app-install and plugin-install prompts. Declining it must print `Skipping Obsidian graph defaults install.` and, combined with declining the other two, must leave no `.obsidian/` directory at all — no partial writes from any of the three gates.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs `install-obsidian.sh --interactive --project-dir <scratch>` with `BOOTSTRAP_ASSUME_TTY=1` and three piped declines (`n\nn\nn\n` — app, plugins, graph defaults, in that order).
  3. Confirm the process exits 0, all three decline messages are printed (including the graph-defaults one), and `<scratch>/.obsidian/` does not exist after the run.
- **Expected Result**: Exit 0; three decline messages printed; no `.obsidian/` directory created.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh --interactive: declining all three prompts leaves .obsidian/ untouched and never installs`) — pre-existing (updated from a two-prompt to a three-prompt decline sequence as part of TASK-061), verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="declining all three prompts leaves .obsidian" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-007: `obsidian.graphDefaults` is registered in `bootstrap-prefs-schema.json` with the documented shape, and the full test suite is green
- **Scenario**: TASK-061 step 3 requires a new schema entry (`scope: "project"`, `consumer: "installer"`, `values: "true | false"`, `default: null`, `askedBy: "install-obsidian.sh"`) adjacent to `obsidian.plugins`, and step 4 requires the full suite to pass with the new key included in any test that enumerates the schema's key set.
- **Steps**:
  1. Run the unit test command below (schema shape/placement — mirrors UAT-054 EDGE-001/002, extended to cover the new key).
  2. Separately run `npm test` and confirm the full suite passes.
- **Expected Result**: `obsidian.graphDefaults` schema shape matches the documented fields, sits directly after `obsidian.plugins`; full suite reports `pass 348, fail 0` (347 as recorded in the task's own Notes at generation time, plus the one new test added by UAT-EDGE-002 above).
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (test: `schema: obsidian.installApp, obsidian.plugins, and obsidian.graphDefaults carry their documented shape and sit between mcp.playwright and skills.pruneOrphans`) — pre-existing, verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="obsidian.installApp, obsidian.plugins, and obsidian.graphDefaults carry their documented shape" test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-08-15 -->

---

## Gaps

- **None outstanding.** One genuine coverage gap was found during generation — no test anywhere pinned the exact 9 `{query, rgb}` pairs in the shipped template, only the count and top-level `search` filter — and was closed immediately by adding a new unit test (`test/install-obsidian.test.js`, see UAT-EDGE-002) rather than being reported as an open gap.
- **No visual/rendering verification**: this task ships a data file Obsidian's core graph view reads natively; no case here opens the real Obsidian app to visually confirm the colors render as intended (out of scope for a headless suite — `raw/research/obsidian-graph-defaults/index.md` already confirmed `colorGroups` is read directly by Obsidian's core graph view, not a plugin, so there is no reader-side code in this repo to test).

---

Next steps:
```
To walk through tests interactively:  /uat-walk wiki/work/uat/UAT-061-obsidian-graph-json-defaults.md
To run tests headlessly:              /uat-auto wiki/work/uat/UAT-061-obsidian-graph-json-defaults.md
```
