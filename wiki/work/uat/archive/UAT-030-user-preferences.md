---
id: UAT-030
title: "UAT: User preferences: stop skills doing consequential things without consent"
status: passed
task: TASK-030
created: 2026-08-07
updated: 2026-08-07
---

# UAT-030 — UAT: User preferences: stop skills doing consequential things without consent

implements::[[TASK-030]]

> **Source task**: [[TASK-030]]
> **Generated**: 2026-08-07

---

## Scope

TASK-030 narrowed to **steps 3 and 4 only** — the sync-time preferences pass in
`install-global.sh` (steps 6 and 7, lines 127-250), its two new `lib.sh` helpers
(`prefs_stored_global`, `prompt_letter_choice`), and the four-state wiring of the
five consumers. The store itself (`bootstrap-prefs.js` + schema) is ROADMAP-005
Phase 1 and is **not** retested here; `merge-gitignore.sh` was wired by TASK-046
and is likewise out of scope.

Three behaviours carry the whole design and each is tested twice — once as a
direct observation and once as a promoted assertion:

1. **`prefs_get` cannot detect `unset`** for a key with a non-null schema
   default. Four of the five `consumer: skill` keys have one, so a
   `prefs_get`-based "is this unanswered?" check reports every key as settled and
   the pass asks **nothing, forever**, while the install looks clean.
2. **A re-run must re-ask only unanswered keys.** A stored `false` and a stored
   `ask` are settled answers.
3. **`gitCommit.autoPush` `unset` means DO NOT PUSH.**

---

## Prerequisites

- [ ] `node` and `bash` on `PATH`; run from the repo root
- [ ] No network required — every test is local and offline (`--skip-mcps`)
- [ ] **Never run `install-global.sh` against the real `$HOME`.** Every test below
      drives it through `withScratchEnv`, which refuses to run the body unless a
      read-only probe confirms both layer paths resolved inside scratch dirs
- [ ] The real `~/.claude/bootstrap-prefs.json`, this repo's `.gitignore`, and
      this repo's `.git/info/exclude` must be untouched by the whole run

---

## Test Cases

### UAT-EDGE-001: `prefs_stored_global` separates a stored answer from a schema default
- **Scenario**: The load-bearing discovery. On a machine that has never answered
  anything, `prefs_get uatGenerate.promoteTests` returns `true` — because the
  *schema* says true, not because the user did. `prefs_stored_global` must
  report the same key as **not stored**, then flip to stored once a value is
  written, *while `prefs_get`'s answer never changes*.
- **Steps**:
  1. Against a scratch HOME, probe a never-answered key with both helpers.
  2. Store the same value the default already reports.
  3. Probe again — only `prefs_stored_global` may change its answer.
- **Command**:
  ```bash
  node --test --test-name-pattern="prefs_stored_global: distinguishes" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. `prefs_stored_global` reports
  `no` then `yes`; `prefs_get` reports `true` both times. The read-only `--list`
  probe creates no values file.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-002: a stored `false` counts as ANSWERED — a decline never re-asks
- **Scenario**: `false` is the value most easily mistaken for "no answer" — it is
  falsy in every shell test, and `gitCommit.autoPush`'s schema default is `false`
  too, so value-based reasoning cannot tell a stored decline from an unanswered
  key at all. Only the `[layer]` column can.
- **Steps**: Seed `gitCommit.autoPush=false` at the global layer, then ask
  `prefs_stored_global` whether the key is answered.
- **Command**:
  ```bash
  node --test --test-name-pattern="prefs_stored_global: a stored .false. counts as ANSWERED" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. The key reports as stored. Reporting it
  unanswered is the bug that makes a decline re-ask forever — the exact failure
  ROADMAP-005 exists to remove.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-003: a PROJECT-layer answer does not satisfy a GLOBAL-layer question
- **Scenario**: `install-global.sh` takes no project path and records at
  `--global`, so "already answered" must mean "answered in the layer I would
  write to". Counting a project answer would let one checkout permanently
  suppress the machine-wide question.
- **Steps**: Seed `research.persistToRaw=false` at the *project* layer only, then
  probe `prefs_stored_global`.
- **Command**:
  ```bash
  node --test --test-name-pattern="prefs_stored_global: a PROJECT-layer answer" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Reports not-stored, and the scratch HOME
  still has no values file.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-004: `prompt_letter_choice` resolves on the first letter and falls back to the declared default
- **Scenario**: The sync prompts print `[y]es / [n]o / [a]sk`, so typing `y` must
  resolve — `prompt_choice_sticky`'s exact-name matcher would drop it to the
  default. Empty, EOF, and unmatched replies must all resolve to the declared
  default, which the sync pass sets to `skip` so a stray keystroke cannot settle
  a question permanently.
- **Steps**: Feed `y`, `yes`, `Y`, `n`, `NOPE`, `a`, `s`, `` (empty), and `zzz`;
  assert the resolved name is the only thing on stdout.
- **Command**:
  ```bash
  node --test --test-name-pattern="prompt_letter_choice: resolves on the FIRST LETTER" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. All nine replies resolve correctly;
  stdout carries the bare name and nothing else; neither layer gets a values file.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-005: EOF resolves to the default without aborting a `set -euo pipefail` caller
- **Scenario**: `read` returns non-zero at EOF. Without the `|| reply=""` guard
  the installer would die mid-pass on a closed stdin.
- **Steps**: Call `prompt_letter_choice` with stdin already at EOF inside a
  `set -euo pipefail` wrapper and confirm execution continues past it.
- **Command**:
  ```bash
  node --test --test-name-pattern="prompt_letter_choice: EOF resolves" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Resolves to `skip` and `REACHED_END` prints.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-001: step 6 installs the helper AND its schema in the layout that keeps defaults working
- **Scenario**: Skills are installed to `~/.claude/skills/` and then run inside
  arbitrary projects, so they cannot reach `lib/scripts/bootstrap-prefs.js`. The
  schema must land at `<helper dir>/templates/` specifically, because
  `bootstrap-prefs.js` resolves it that way — a flattened copy would make every
  skill's no-`--schema` invocation silently lose validation *and* every default.
- **Steps**:
  1. Run `install-global.sh --skip-mcps` against a scratch HOME.
  2. Assert both files exist and the helper is byte-identical to the repo copy.
  3. Invoke the **installed** copy with no `--schema` and confirm a default resolves.
- **Command**:
  ```bash
  node --test --test-name-pattern="step 6 installs the helper" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. `~/.claude/bootstrap-prefs.js` and
  `~/.claude/templates/bootstrap-prefs-schema.json` both present; the installed
  helper resolves `uatGenerate.promoteTests` to `true` with no `--schema` flag.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-002: a fresh interactive run settles all five keys, each as the correct JSON type
- **Scenario**: The happy path. One distinct answer per key, covering all three
  storable shapes — a string grammar (`never`), a boolean `true`, a boolean
  `false`, and `ask`. A stored `"false"` *string* would be truthy in every shell
  test and read back as a settled `true`, so the types are part of the contract.
- **Steps**: Drive the pass with `n / y / n / a / y` and inspect the values file.
- **Command**:
  ```bash
  node --test --test-name-pattern="a fresh interactive run settles all five keys" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Store is exactly
  `{versionBump:"never", autoPush:true, persistToRaw:false, promoteTests:"ask", offerSectionUpdates:true}`;
  nothing written to the project layer; the three recovery pointers
  (`--set`, `--unset`, `/bootstrap-config`) all print.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-003: a re-run re-asks ONLY the unanswered key — stored `false` and `ask` are never re-asked
- **Scenario**: **The central requirement of the whole roadmap.** Run 1 answers
  four keys and `skip`s the fifth. Run 2 poisons stdin with `y` on every line —
  any settled question that fired again would visibly rewrite the store. Run 3
  must ask nothing at all.
- **Steps**:
  1. Run 1: `a / y / n / a / s` → four settled, `gitignore.offerSectionUpdates` left open.
  2. Run 2: `y / y / y / y / y` → only the open key may change.
  3. Run 3: `y / y / y / y / y` → nothing changes, and the pass says so.
- **Command**:
  ```bash
  node --test --test-name-pattern="a re-run re-asks ONLY the unanswered key" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. `skip` records nothing. Run 2 changes
  exactly one key and does not even *mention* the four settled ones — a re-asked
  question the user answers identically is still a re-asked question. Run 3
  prints `All skill preferences already answered — nothing to ask.` and the
  recovery pointers stay silent.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-006: a NON-INTERACTIVE run asks nothing and writes no preferences file at all
- **Scenario**: The tty guard wraps the whole pass, so an unattended run never
  even reaches the read probe. Asserting *no file* rather than *no answers* is
  what proves the guard sits above the probe instead of inside the loop. One CI
  run must never bake a permanent answer into a user's store.
- **Steps**: Run with `BOOTSTRAP_ASSUME_TTY` absent and poisoned stdin.
- **Command**:
  ```bash
  node --test --test-name-pattern="a NON-INTERACTIVE run asks nothing" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Prints the skip note; **no** values file
  and **no** companion README in either layer; step 6's helper install still ran,
  because only the questions are tty-gated.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-007: `gitCommit.versionBump` offers auto/confirm/never and has no `ask` value
- **Scenario**: `confirm` *is* this key's ask state. Offering both would create
  two spellings of one state, which is why the key cannot go through
  `settle_skill_pref` and the schema grammar omits `ask`.
- **Steps**: Answer `c`, confirm `confirm` round-trips, then try to `--set` the
  key to `ask` and confirm the helper rejects it.
- **Command**:
  ```bash
  node --test --test-name-pattern="gitCommit.versionBump offers auto/confirm/never" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Store is exactly
  `{"gitCommit.versionBump":"confirm"}`; `--set … --value ask` exits **1**; the
  prompt string in `install-global.sh` offers exactly
  `[a]uto / [c]onfirm each time / [n]ever / [s]kip for now`.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-008: every consuming skill reads its key with `--project .` and degrades to `unset`
- **Scenario**: All five keys are `scope: either`. Dropping `--project .` reads
  the machine-wide answer even inside a repo that overrode it, and nothing
  reports the override was ignored. A failed read (no bootstrap install, or no
  `node`) must degrade to `unset` — without `|| echo unset` the gate compares
  against an empty string and silently matches nothing.
- **Steps**: Scan each consumer skill for its `--get <key>` line and assert both
  the `--project .` flag and the `|| echo unset` fallback are present.
- **Command**:
  ```bash
  node --test --test-name-pattern="every consuming skill reads its key" test/bootstrap-prefs.test.js
  ```
- **Expected Result**: 1 test, 1 pass across all four consumer skill files
  (`git-commit` ×2 keys, `research`, `uat-generate`).
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-009: `gitCommit.autoPush` `unset` means DO NOT PUSH
- **Scenario**: The one key whose `unset` is not the schema-friendliest reading
  but the compatibility-correct one. Every other consumer treats `unset` as
  "today's behaviour" and today's behaviour is to *do* the thing; here today's
  behaviour is that `/git-commit` has never pushed. Defaulting an unanswered key
  to an outward-facing action that publishes code would be the most consequential
  defect available in this roadmap.
- **Steps**: Assert the schema default is `false`, the Step 6 gate table's
  `unset` row says do not push, and the push is constrained to a bare `git push`.
- **Command**:
  ```bash
  node --test --test-name-pattern="gitCommit.autoPush documents .unset. as DO NOT PUSH" test/bootstrap-prefs.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Schema default `false`; the `unset` row
  matches /do not push/i; no `--force`, `--force-with-lease`, `-u`, `--all`, or
  `--tags` appears on any `git push` in Step 6.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-004: `PHASE_3_PENDING` is empty and both bijection directions are live
- **Scenario**: TASK-030 step 5 emptied the allowlist that exempted four keys
  while Phase 3 was in flight. With it empty and no `{ skip: ... }` on the test,
  the `schema -> scripts` bijection is a live anti-drift check over the whole
  non-dynamic key set, in both directions.
- **Steps**: Assert the allowlist literal is empty, then run both bijection tests.
- **Command**:
  ```bash
  node -e 'const t=require("fs").readFileSync("test/bootstrap-prefs.test.js","utf8"); const m=t.match(/const PHASE_3_PENDING = (\[[^\]]*\])/); if(!m) throw new Error("PHASE_3_PENDING not found"); if(m[1].replace(/\s/g,"")!=="[]") throw new Error("PHASE_3_PENDING is not empty: "+m[1]); console.log("PHASE_3_PENDING = [] (empty)")'
  node --test --test-name-pattern="bijection|-> schema|schema ->" test/bootstrap-prefs.test.js
  ```
- **Expected Result**: The literal prints as empty, and the bijection tests run
  **unskipped** — `skipped 0`, `fail 0`. Every non-dynamic schema key has at
  least one call site and every key literal passed to the helper resolves
  through the schema.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (pre-existing; un-skipped by TASK-047, allowlist emptied by TASK-030)
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-005: the full suite is green with zero skips
- **Scenario**: TASK-030's own step 5 note claims `npm test` 264/264 with 0
  skipped. UAT promotion added assertions for the previously untested sync pass,
  so the count rises; the invariant under test is **0 fail and 0 skipped**, since
  a new skip would silently retire a check.
- **Steps**: Run the full suite from the repo root.
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `fail 0` and `skipped 0`. Count is **276** (the 264
  baseline plus the 12 assertions promoted by this UAT).
- **Repeatable Unit Test**: Not applicable: this *is* the suite.
- [x] Pass <!-- 2026-08-07 -->

---

## Out of Scope

- `bootstrap-prefs.js` / the schema (ROADMAP-005 Phase 1, covered by `test/bootstrap-prefs.test.js`)
- `merge-gitignore.sh` and `prefs.gitTracking` (TASK-046, covered by `test/prompt-stickiness.test.js`)
- Registering `/bootstrap-config` in `lib/skills/README.md` and `CLAUDE.md` (ROADMAP-005 Phase 4)
- Docs rows in `lib/scripts/README.md` (ROADMAP-005 Phase 4)
