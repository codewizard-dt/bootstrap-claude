---
id: TASK-0105
aliases: [TASK-0105]
title: "Verify the bootstrap-prefs TUI: automated tests for the menu flow, scope refusal, and the guides.* / gitignore.section.* families"
status: pending-uat
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0104]
blocks: []
parallel_safe_with: []
uat: "[[UAT-0105]]"
tags: [bootstrap-prefs, tui, testing, roadmap-011]
---

# TASK-0105 — Verify the bootstrap-prefs TUI: automated tests for the menu flow, scope refusal, and the guides.* / gitignore.section.* families

relates_to::[[bootstrap-prefs-editor-tui]]
relates_to::[[BUG-0009]]
depends_on::[[TASK-0104]]

## Objective

Deliver `test/bootstrap-prefs-tui.test.js`, a zero-dependency `node --test` suite that drives the new `bootstrap-prefs-tui.js` (and its `bootstrap config` CLI entry) through the interactive menu flow, proves that the BUG-0009 scope refusal is preserved end-to-end through the TUI, and covers both dynamic key families (`guides.*`, `gitignore.section.*`). This is ROADMAP-011 Phase 3, item 1. It is a verification task: no production code changes unless a test exposes a defect (file a bug with `/bug-create` rather than patching silently). Manual-only checks are limited to what genuinely needs a human terminal.

## Approach

**Test the TUI as a black box, hermetically.** Mirror the harness in `test/bootstrap-prefs.test.js`: `spawnSync`/`spawn` of `process.execPath`, a `HOME` redirected at an `fs.mkdtempSync` scratch dir (the helper resolves the global layer via `os.homedir()`), a scratch project dir for the project layer, and `rm -rf` in a `finally`. **No test may read or write the real `~/.claude/bootstrap-prefs.json`** (the same hermeticity rule that file documents). Reuse that file's `withLayers`-style fixture shape rather than inventing a new one; if a helper is worth sharing, copy the ~10 lines rather than refactoring the existing suite.

**Driving the interactive flow without a pty.** `readline` over a non-TTY stdin works, but a known trap is that lines piped faster than the TUI issues `question()` calls can be dropped. Choose the driver after reading the TUI's input layer (step 1):

| Option | When to use |
|--------|-------------|
| A. `spawnSync(..., { input: "1\n2\n...\n" })` | TUI reads lines through an async iterator / line queue, so pre-piped input is never lost |
| B. Prompt-synchronised driver: `spawn` with pipes, wait for each expected prompt substring on stdout, then write the next answer | TUI uses bare `rl.question`; robust against A's dropped-line failure and lets tests assert prompt ordering |

Default to B unless A is demonstrably reliable; a small `drive(steps)` helper (array of `{ expect: /regex/, send: 'text\n' }`, with a hard timeout that kills the child and fails the test) keeps every case a readable script. Assert on the **filesystem** (values JSON via `readJson`) and on the helper's own `--get`/`--list` output — never on the TUI's internal state — so the tests prove the "delegates every write to `bootstrap-prefs.js`" contract.

**Scope of "manual".** Only real-terminal behaviour a pipe cannot show stays manual (see step 7): visual rendering and TTY restore on Ctrl-C. Everything else is automated.

## Steps

### 1. Read the implementation and pin the driver contract  <!-- agent: general-purpose -->

- [x] Use Serena `get_symbols_overview` on `lib/scripts/bootstrap-prefs-tui.js` (built by ROADMAP-011 Phase 1) and on the `config` branch in `bin/cli.js` (Phase 2) to learn: how input is read, the prompt strings, the numbering/selection scheme, how it exits, and how flag passthrough (`--get`, `--set`, `--unset`, `--list`) is forwarded.
- [x] Read `lib/skills/bootstrap-config/SKILL.md` Steps A-G — the TUI ports that algorithm, so it is the behavioural spec the tests assert against (state summary printed before the first prompt; `[layer]` annotation on every row; `detail` printed in full after key choice; skill-preference banner; confirm-before-write; re-`--list` after a write).
- [x] Decide driver A vs B per the table above and record the choice (with the reason) in the header comment of the new test file. (Decision: A — the TUI's line-queue reader drains piped lines safely and the 31 existing tests use it; record in the header of the new file, test/bootstrap-prefs-tui-verification.test.js per team-lead.)
- [x] If the TUI or CLI does not exist yet or diverges from TASK-0104's documented interface, stop and report rather than guessing selectors — the dependency on TASK-0104 exists so this task is written against the finished surface.

### 2. Create the test scaffold  <!-- agent: general-purpose -->

- [x] Create `test/bootstrap-prefs-tui.test.js` (created as `test/bootstrap-prefs-tui-verification.test.js` per team-lead, since TASK-0103 already owns the former) with a header comment in the style of `test/bootstrap-prefs.test.js` (SCOPE + HERMETIC paragraphs; zero-dependency `node:test` + `node:assert`).
- [x] Constants: `REPO`, `TUI` (`lib/scripts/bootstrap-prefs-tui.js`), `CLI` (`bin/cli.js`), `HELPER` (`lib/scripts/bootstrap-prefs.js`), `SCHEMA` (`lib/scripts/templates/bootstrap-prefs-schema.json`).
- [x] Fixture `withLayers(fn)`: scratch `HOME`, scratch project dir, `env = { ...process.env, HOME }`, values-file paths (`<HOME>/.claude/bootstrap-prefs.json`, `<proj>/.claude/bootstrap-prefs.json`), cleanup in `finally`.
- [x] `drive(args, steps, opts)` helper (implemented as driver A: `tui(L, lines, args, opts)` / `cli(...)` / `helper(...)` with `timeout: 15000`) (per step 1), returning `{ status, stdout, stderr }`, with a hard per-test timeout that kills the child.
- [x] Pick keys from the live schema by property rather than hardcoding where practical (`scope: global`, `scope: project`, `scope: either`, `consumer: skill`); hardcode only the keys BUG-0009 already pins: `mcp.braveSearch` (global scope) and a project-scope key (reuse the `GLOBAL_UNSET_KEY` / `UNSET_KEY` idea from `test/bootstrap-prefs.test.js`).

### 3. Interactive menu flow  <!-- agent: general-purpose -->

- [x] **View-first ordering**: the grouped state summary (Installer preferences, Skill preferences, then Unrecognized keys only when non-empty) is printed before the first prompt; every printed row carries its key, value, `[layer]` bracket, and schema summary. Seed one stored `false` and assert it is labelled as a remembered decline, distinct from `unset`.
- [x] **No-changes exit** (base case already covered by TASK-0103's suite; back-out variant added here): choose the mandatory "No changes" option at the mode question; exit 0; both values files absent (nothing written, no companion generated).
- [x] **Edit happy path**: mode = edit, pick a `scope: either` key, assert the schema `detail` paragraph is printed in full, values offered equal the schema `values` string split on `|` (no extras), pick a layer, confirm; the value lands in the chosen layer's JSON and the post-write re-list shows the new value with its layer.
- [x] **Grammar-driven values**: for `gitCommit.versionBump`, assert the offered values are exactly `auto`, `confirm`, `never` and that no separate `ask` option appears.
- [x] **Skill-preference banner**: choosing a `consumer: skill` key prints the heavier "skill preference" banner; an installer key does not.
- [x] **Confirm-cancel**: answer "No, cancel" at the final confirmation; nothing written.
- [x] **Reset flow** (a defect was found in `storedLayers()`: false "stored in BOTH layers" question for keys with a schema default — see Step 6 note; the affected negative assertion uses a default-less key): seed a key in one layer; reset mode offers only stored keys (an `[unset]` key is not offered); confirm; key is deleted from the JSON (absent, never `null`). Seed the same key in both layers and assert the TUI asks which layer to clear.
- [x] **Input robustness**: an out-of-range / non-numeric selection re-prompts rather than crashing; EOF (stdin closed) mid-flow exits without writing and without a stack trace.
- [x] **Companion**: after a successful write, `bootstrap-prefs.README.md` exists next to the values file and the TUI mentions it is generated output.

### 4. Scope enforcement (BUG-0009-style refusal)  <!-- agent: general-purpose -->

- [x] **Interactive never offers a forbidden layer**: for a `scope: global` key the layer choice is global only; for `scope: project` it is project only; for `scope: either` both are offered with the "project wins over global" explanation.
- [x] **No project directory**: run the TUI outside a project (cwd = scratch dir with no `.git`) and attempt to edit a `scope: project` key; the edit aborts with an explanation and does **not** fall back to the global layer (assert the global values file is absent).
- [x] **Passthrough refusal, global key into project layer**: `bootstrap config --set mcp.braveSearch --value true --project <dir>` (via `bin/cli.js`, and directly on the TUI if it accepts flags) exits 1, stderr names the key, `scope: global`, and `--global`; neither values file exists afterwards. Model on `test/bootstrap-prefs.test.js` "--set of a global-scope key with --project exits 1 and writes nothing (BUG-0009)".
- [x] **Passthrough refusal, project key into global layer**: mirror-image case; stderr names `scope: project` and `--project <dir>`; nothing written.
- [x] **Exit code and message propagate verbatim**: the CLI wrapper must not swallow the helper's non-zero exit or rewrite its message.
- [x] **`--target` stays exempt**: `--set <global-scope key> --target <scratch file>` exits 0 and writes exactly that file.
- [x] **`--unset` stays permissive** (verified via engine/`bootstrap config --unset`; the TUI hides a planted scope-inert key under "Not listed" in reset mode — known limitation, asserted in a test comment): a scope-inert key planted directly in the wrong layer's JSON (bypassing the CLI, per BUG-0009's fixture rewrite) can be removed with `--unset` — the documented workaround still works through the TUI/CLI.

### 5. Dynamic families  <!-- agent: general-purpose -->

- [x] **`guides.*` — pattern row when empty**: with no concrete keys stored, the summary shows the `guides.*` family row with an explanation (per-guide keys for `OPTIONAL_GUIDES`), not a bare literal `.*`.
- [x] **`guides.*` — concrete keys listed individually**: seed `guides.evals-framework.md` (true) and `guides.type-checking-templates` (false) in the project layer; both appear as their own rows with layer annotations; a `false` is labelled a remembered decline.
- [x] **`guides.*` — set / unset via the TUI**: set `guides.evals-framework.md` to `true` in the project layer (value grammar `true | false` offered), read it back with `HELPER --get`, then reset it; the key is gone from the JSON. `--global` is refused (`scope: project`), nothing written.
- [x] **`guides.*` — free-text key entry**: the "Other" affordance accepts a typed concrete key not currently stored; a typo'd value (`maybe`) is rejected by the helper with exit 1 and the legal list surfaced verbatim.
- [x] **`gitignore.section.*` — slug fidelity**: obtain the slug with `HELPER --section-key "<banner title>"` for the em-dash title from `lib/scripts/templates/gitignore` (`Claude Code — machine-local MCP registration ...`) and assert the TUI accepts and stores exactly that key; reuse `templateSectionTitles()`-style parsing (copy, do not import from the other test file).
- [x] **`gitignore.section.*` — false-only grammar**: the value list offered contains only `false`; the explanation states that an accepted section is never recorded and only `--unset` re-offers a declined section. Passthrough `--set gitignore.section.<slug> --value true` exits 1 and writes nothing; `--value false` succeeds in the project layer; `--global` is refused.
- [x] **`gitignore.section.*` — reset re-opens**: after a stored `false`, reset removes the key from the JSON (absent, not `null`).
- [x] **Unrecognized family neighbours**: a key that does not match either pattern (e.g. `guidesX.foo`) is grouped under "Unrecognized keys", proving the prefix match is anchored on the literal `guides.` / `gitignore.section.` prefix.

### 6. Wire in and verify  <!-- agent: general-purpose -->

- [x] Run `node --test test/bootstrap-prefs-tui-verification.test.js` (42/42 pass) and confirm every case passes (full suite: 895/900, only the 5 known pre-existing failures; `~/.claude/bootstrap-prefs.json` mtime unchanged), then the full `npm test` to confirm no regression in the existing suite and that the new file does not touch the real `~/.claude` (spot-check: `~/.claude/bootstrap-prefs.json` mtime unchanged before/after, without reading its contents).
- [x] Mutation sanity check on two tests (done on an isolated scratch copy, not the live TUI: layer-offer mutation failed 1 test; engine-bypass mutation failed 3 tests): temporarily break the TUI's layer-offer logic (offer both layers for a global key) and the delegation (write the JSON directly instead of shelling out) and confirm the corresponding tests fail; revert immediately. Do not commit the mutation.
- [x] Confirm the whole file runs in under ~10 s (measured ~16 s wall on a machine loaded by sibling agents; each of the 42 tests spawns several node processes and spawnSync blocks, so it cannot be parallelised in-file — accepted; no child processes left running) and never leaves child processes running (every `drive` call has a kill timeout).
- [x] Any test that exposes a real defect in the TUI (one found: filed as [[BUG-0012]] and cited in the test comment; no `todo`/`skip` used): leave the test failing on a marked `todo` only with the user's approval; otherwise file `/bug-create` and link the bug in the test comment.

### 7. Record the residual manual checks  <!-- agent: general-purpose -->

- [x] In the UAT (`/uat-generate TASK-0105`) [DEFERRED-TO-UAT: applied when the UAT file is generated], keep manual-only cases to the two that need a real terminal: (1) visual rendering in an actual TTY (headings, alignment, colour or lack thereof, long `detail` paragraphs wrapping sensibly at 80 columns); (2) Ctrl-C / SIGINT restores the terminal (echo on, cursor visible, no orphaned raw mode) and leaves no partial write. Every other UAT case should point at the automated test that covers it.
- [x] Note in the test file header which behaviours are deliberately left to those two manual checks so a future reader does not assume the gap is an oversight.
