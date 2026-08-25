---
id: UAT-067
aliases: [UAT-067]
title: "UAT: Per-key sticky refresh for .obsidian/graph.json instead of whole-file skip-if-present"
status: pending
task: TASK-067
created: 2026-08-21
updated: 2026-08-21
---

# UAT-067 — UAT: Per-key sticky refresh for `.obsidian/graph.json` instead of whole-file skip-if-present

implements::[[TASK-067]]

> **Source task**: [[TASK-067]]
> **Generated**: 2026-08-21

**Scope note.** TASK-067 is a shell-script change: a rewritten `_install_obsidian_graph_defaults` plus new helper `_graph_defaults_node` in `lib/scripts/install-obsidian.sh`, a new fingerprint sidecar shape, and doc updates in `lib/scripts/README.md` / `lib/scripts/templates/bootstrap-prefs-schema.json`. There is no HTTP endpoint or browser UI — every test case below is an **EDGE** case (installer/CLI behavior), following the same convention UAT-061 established for this same script. All 5 checklist items across the task's 3 steps were already checked, and the task's own notes claimed the full suite green at 389/389 — but this UAT independently re-verified that claim rather than trusting it, and found a real regression: the Step 3 docs edit had put the long per-key-refresh description into `lib/scripts/README.md`'s "What it does" table cell instead of matching the schema's short `summary` field, which `test/scripts-readme-prefs-docs.test.js` cross-checks verbatim — `npm test` was actually at 388/389, not 389/389. Fixed during this UAT generation (see UAT-EDGE-010 and Gaps below); re-verified green at 389/389 after the fix.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ and `bash` available on `PATH` (the suite runs `node --test`)
- [ ] `lib/scripts/templates/obsidian/graph.json` and `lib/scripts/install-obsidian.sh` exist at their documented paths
- [ ] `npm test` baseline green before starting

**Safety.** Every case below runs the real `lib/scripts/install-obsidian.sh` against a scratch `$HOME` and scratch project directory (`fs.mkdtempSync`), with a curated `PATH`/`HOME` env — no case touches this repo's own `.obsidian/`, the real `~/.claude/bootstrap-prefs.json`, or the network.

---

## Test Cases

### UAT-EDGE-001: A fresh vault (no `graph.json`, no sidecar) gets the file written with all template keys and a fingerprint sidecar recording `offeredHash` for every key
- **Scenario**: Case 1 of the per-key decision table — an absent key writes the template's current value and records `offeredHash`. This is the happy-path baseline: no prior state, everything gets written and fingerprinted.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it invokes the real, unmodified `install-obsidian.sh --project-dir <scratch>` against a scratch project dir with no pre-existing `.obsidian/graph.json` or `.obsidian/.graph-defaults-fingerprint.json`.
  3. Confirm the process exits 0, `.obsidian/graph.json` has exactly 9 `colorGroups` and the documented `search` scope, and `.obsidian/.graph-defaults-fingerprint.json` records an `offeredHash` for every template key.
- **Expected Result**: Exit 0; `graph.json` written with all template keys; sidecar written with `offeredHash` per key, no `declinedHash` anywhere.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: a fresh vault (no pre-existing graph.json or sidecar) gets the file written with exactly 9 colorGroups, the knowledge+work-only search scope, and a sidecar recording offeredHash for every template key`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="a fresh vault \(no pre-existing graph.json or sidecar\) gets the file written" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-002: An existing `graph.json` matching today's template with NO sidecar self-heals silently (upgrade case)
- **Scenario**: Case 3 (bootstrap) — this is the exact failure the user originally reported via `/debug-logs`: a file this installer wrote on a prior run, with no fingerprint sidecar yet (pre-TASK-067 install). Must be recognized as unmodified and silently confirmed, not treated as a stranger's customization.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds a scratch `graph.json` that's byte-identical to the current template, with no sidecar file present, then runs the installer.
  3. Confirm the process exits 0, no prompt occurs, the sidecar is created afterward, and `graph.json`'s bytes are unchanged (already matched).
- **Expected Result**: Exit 0; no prompt; sidecar created; `graph.json` unchanged.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: an existing graph.json that exactly matches the template with no sidecar present self-heals silently — sidecar gets created, no prompt, file unchanged`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="self-heals silently" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-003: A diverged key with no `offeredHash` recorded prompts for that key only — answering `y` applies the new default and clears `declinedHash`
- **Scenario**: Case 4, first divergence, interactive accept path — the installer must isolate the prompt to the one key that actually diverged (`colorGroups`), leave every other key alone, and apply the new value on `y`.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds a scratch `graph.json` with `colorGroups` hand-edited away from the template, no sidecar entry for that key, then runs the installer interactively with a piped `y`.
  3. Confirm the process exits 0, prompts only for `colorGroups`, and after answering `y` the file's `colorGroups` equals the template value with `offeredHash` updated and no `declinedHash`.
- **Expected Result**: Exit 0; single targeted prompt; `y` applies the template value; `declinedHash` absent.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh --interactive: a diverged key with no offeredHash recorded prompts for that key only, and answering y applies the new template value and clears any declinedHash`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="answering y applies the new template value" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-004: The same diverged key prompted again — answering `n` leaves it untouched and records `declinedHash`
- **Scenario**: Case 4, decline path — declining must leave the file byte-unchanged for that key and record `declinedHash` (without touching `offeredHash`, per the Approach's explicit "do not touch `offeredHash`" rule) so the sticky-decline check in UAT-EDGE-005 has something to key off.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds the same diverged-key scenario and runs interactively with a piped `n`.
  3. Confirm the process exits 0, the file's diverged key is unchanged after the run, and the sidecar now carries a `declinedHash` for that key.
- **Expected Result**: Exit 0; file untouched; `declinedHash` recorded.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh --interactive: a diverged key with no offeredHash recorded prompts for that key only, and answering n leaves it untouched and records a declinedHash`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="answering n leaves it untouched" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-005: A previously-declined key, template value unchanged, stays sticky on the next run — no re-prompt
- **Scenario**: This is the specific requirement the user added mid-planning ("if changed, ask user" — implying a decline should not be re-asked every run until something actually changes). Verifies the sticky-decline branch of case 4.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs the installer a second time against a project dir carrying a `declinedHash` from a prior decline, template value unchanged, interactively — with a "spare" queued `y` that would flip the value if the sticky-skip were broken.
  3. Confirm the process exits 0, no prompt occurs, and the file still holds the user's declined value (proving the spare `y` was never consumed).
- **Expected Result**: Exit 0; no prompt; user's value preserved.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh --interactive: the same diverged key run again after a decline, template value unchanged, stays sticky — no prompt, file still holds the user value`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="stays sticky" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-006: A key whose file value still matches a stale `offeredHash` is silently refreshed when the template itself has changed — no prompt
- **Scenario**: Case 2 — the file holds exactly what was last delivered (untouched by the user), but the packaged template's value for that key has since evolved. This must refresh silently since nothing the user did is being overridden.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds a `graph.json` whose value for a key matches a recorded `offeredHash`, then runs against a template snapshot with a different value for that key.
  3. Confirm the process exits 0, no prompt occurs, and the file's key now holds the new template value with `offeredHash` updated to match.
- **Expected Result**: Exit 0; no prompt; silent refresh to the new template value.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: a key whose file value still matches a stale offeredHash is silently refreshed to the new template value when the template has since changed, with no prompt`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="silently refreshed to the new template value" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-007: A non-interactive run against a diverged key leaves it untouched and records no `declinedHash`
- **Scenario**: Non-interactive runs must never prompt and must never permanently foreclose the offer on the user's behalf — a later interactive run should still ask. This distinguishes "no answer given" from "explicitly declined."
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds a diverged key and runs the installer non-interactively (no `--interactive` flag / no tty).
  3. Confirm the process exits 0, the file is unchanged, no `declinedHash` is recorded, and a subsequent interactive run against the same scratch dir still prompts for that key.
- **Expected Result**: Exit 0; file untouched; no `declinedHash`; later interactive run still offers the key.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: a non-interactive run against a diverged key leaves it untouched and records no declinedHash, so a later interactive run still offers it`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="a later interactive run still offers it" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-008: A non-templated key (e.g. a force/layout key like `centerStrength`) is always preserved untouched and never appears in the sidecar
- **Scenario**: The user's explicit design requirement — a key our template never writes (force/layout tuning) must never block or interfere with per-key refresh of the keys we do own, and must never be tracked in the fingerprint sidecar at all.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds a `graph.json` with a `centerStrength` key (or similar) alongside template-owned keys, runs the installer, and inspects both the resulting `graph.json` and the sidecar.
  3. Confirm `centerStrength`'s value is byte-identical after the run and never appears as a key in `.graph-defaults-fingerprint.json`.
- **Expected Result**: Non-templated key preserved exactly; absent from the sidecar.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: a non-templated key the user added (e.g. a force/layout key this template never defines) is always preserved untouched and never appears in the sidecar`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="never appears in the sidecar" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-009: Non-interactive gates (`obsidian.graphDefaults=false` and unset) still behave exactly as before this task
- **Scenario**: Regression guard — TASK-067 changed only what happens *inside* `_install_obsidian_graph_defaults` once it's called; the surrounding `prompt_yn_sticky` gate and non-interactive preference contract (an explicit stored `false` diverts, unset proceeds) must be unaffected.
- **Steps**:
  1. Run both unit test commands below.
  2. Confirm the `false`-preference case exits 0, prints the remembered-decline message, and never creates `graph.json`.
  3. Confirm the unset-preference case exits 0 and `graph.json` is written despite no stored preference.
- **Expected Result**: Both pre-existing gate contracts unchanged.
- **Repeatable Unit Test**: Not applicable: these are pre-existing tests from TASK-061 (`test/install-obsidian.test.js`, tests: `non-interactive + stored obsidian.graphDefaults=false at the project selector skips the graph defaults install` and `non-interactive with NO stored obsidian.graphDefaults preference proceeds with the graph defaults install`) — this case re-verifies they still pass after TASK-067's rewrite rather than promoting new coverage.
- **Unit Test Command**: `node --test --test-name-pattern="obsidian.graphDefaults=false at the project selector skips" test/install-obsidian.test.js && node --test --test-name-pattern="NO stored obsidian.graphDefaults preference proceeds" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

### UAT-EDGE-010: The interactive three-prompt decline flow (app, plugins, graph defaults) still leaves `.obsidian/` fully untouched, and the full suite is green
- **Scenario**: Final regression + suite-wide check — declining all three top-level `prompt_yn_sticky` gates (unrelated to the per-key prompts inside graph defaults, which only fire if the gate itself is accepted) must still leave no `.obsidian/` directory at all, and the full test suite must report the count claimed in the task's implementation notes.
- **Steps**:
  1. Run the unit test command below (three-prompt decline).
  2. Separately run `npm test` and confirm the full suite passes.
- **Expected Result**: Exit 0; no `.obsidian/` directory created; full suite reports `pass 389, fail 0` (as recorded in TASK-067's implementation notes).
- **Repeatable Unit Test**: Not applicable: pre-existing test from TASK-061, re-verified unaffected by TASK-067's internal rewrite of `_install_obsidian_graph_defaults`.
- **Unit Test Command**: `node --test --test-name-pattern="declining all three prompts leaves .obsidian" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-21 -->

---

## Gaps

- **None outstanding.** One genuine regression was found during generation — `lib/scripts/README.md`'s `obsidian.graphDefaults` "What it does" cell had been overwritten with the long `detail`-length description instead of the schema's short `summary` field, breaking `test/scripts-readme-prefs-docs.test.js`'s cross-check (`npm test` was 388/389 at the start of this UAT generation) — and was closed immediately by reverting that cell to match `summary` verbatim, rather than being reported as an open gap. See the Scope note above and TASK-067's "Fix during UAT generation" implementation note.
- **No visual/rendering verification**: this task changes an installer's file-write logic, not the shipped graph-view styling data itself (`colorGroups`/`search` values are unchanged from TASK-061); no case here opens the real Obsidian app, matching UAT-061's same out-of-scope note.
- **No live-TTY manual walkthrough of the new y/n prompt wording**: all interactive cases above pipe stdin programmatically (matching this file's existing convention for `prompt_yn`-style prompts) rather than a human typing into a real terminal. The prompt text itself (`"  graph.json key '<key>' differs from your saved customization — update to the new default? [y/N]: "`) is asserted against in the piped-stdin tests, which is the strongest automatable evidence available; a literal human-at-a-real-TTY pass was judged unnecessary given UAT-061 established piped-stdin as sufficient for this same script's other prompts.

---

Next steps:
```
To walk through tests interactively:  /uat-walk wiki/work/uat/UAT-067-graph-json-per-key-refresh.md
To run tests headlessly:              /uat-auto wiki/work/uat/UAT-067-graph-json-per-key-refresh.md
```
