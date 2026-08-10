---
id: TASK-042
title: "test/bootstrap-prefs.test.js — four-state and schema-bijection coverage"
status: done
created: 2026-08-06
updated: 2026-08-06
part_of: ROADMAP-005
depends_on: [TASK-041]
blocks: []
parallel_safe_with: [TASK-031, TASK-039]
uat: "[[UAT-042]]"
tags: [prefs, tests, install, consent, roadmap-005]
---

# TASK-042 — test/bootstrap-prefs.test.js — four-state and schema-bijection coverage

part_of::[[ROADMAP-005]]

## Objective

Add `test/bootstrap-prefs.test.js` — the regression harness for `lib/scripts/bootstrap-prefs.js` and `lib/scripts/templates/bootstrap-prefs-schema.json`. It pins the four-state model (especially that `ask` reads back as `ask` and never as `unset`), the scope-constrained resolution order, the exit-code contract (invalid `--value` exits 1 without writing; a malformed file exits 0), and a schema↔key **bijection** so the registry cannot drift from what the scripts actually read and write. This closes ROADMAP-005 Phase 1: after it, Phases 2 and 3 can be built against a store whose behavior is nailed down.

## Approach

**Direct sibling of `test/settings-deny.test.js`.** That file is the repo's precedent for exercising a zero-dependency JSON manipulator: `node:test` + `node:assert`, `fs.mkdtempSync(path.join(os.tmpdir(), '<prefix>-'))` fixtures, and a thin `run(args)` wrapper over `spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })` so both `status` and `stdout`/`stderr` are assertable. Read it first and copy its shape, including its actual scratch-directory cleanup posture — do not invent a third convention. The npm script is `node --test 'test/*.test.js'`, so the filename must end in `.test.js` and live directly in `test/`.

**`--target` and `--schema` everywhere; never the real files.** Every values-file assertion goes through `--target <scratch>`, and schema-behavior assertions go through `--schema <fixture>`. A test that touches `~/.claude/bootstrap-prefs.json` would corrupt the developer's own answers, and one that touched `~/.claude/settings.json` would trip `claude-settings-guard.js`. The bijection test is the one exception: it reads the **real** `templates/bootstrap-prefs-schema.json`, because its entire job is to assert something about the shipped file.

**Two test populations, kept separate in the file.** Mixing them is what lets a drift bug hide behind a passing behavior suite:

1. **Behavior tests** — drive the helper as a subprocess against scratch files and fixture schemas. These test the *code*.
2. **Schema tests** — statically assert facts about the shipped `bootstrap-prefs-schema.json`, in the style of `settings-deny.test.js:89-164` (which asserts entry counts, prefixes, and forbidden patterns without ever running the merge). These test the *data*.

**The bijection is the anti-drift mechanism, and it must be built to actually fail.** Modelled on `test/settings-hooks.test.js:116`. Both directions:

- **Schema → scripts**: every non-`dynamic` schema key is referenced somewhere under `lib/scripts/` or `lib/skills/`. A key nobody reads is dead documentation.
- **Scripts → schema**: every preference key literal appearing in a `bootstrap-prefs.js` invocation across `lib/scripts/` and `lib/skills/` has a schema entry, exact or wildcard. A key nobody documented is the drift this file exists to catch.

The honest caveat: **during Phase 1 no script calls the helper yet**, so the schema→scripts direction would fail on every key. The test is therefore written now but the schema→scripts assertion is **skipped with an explicit reason naming ROADMAP-005 Phase 2**, and un-skipping it is a Phase 2 checklist item. Writing it as an always-passing no-op instead would be worse than not writing it — it would look like coverage.

**Pin the conflation trap loudly.** TASK-030 names it as the design's central failure mode: `unset` and `ask` both produce a prompt, so a helper bug that reports `ask` as `unset` is invisible in normal use and re-opens exactly the annoyance this roadmap removes. That deserves its own named test with a comment explaining why, not a line inside a round-trip test.

**Assert the absence of `null`, not just the presence of values.** The four-state model's on-disk contract is that absence *is* `unset`. So after any sequence of operations, assert `JSON.stringify(file).includes('null') === false` and that `Object.keys()` contains exactly the keys explicitly set. A helper that writes `"key": null` would pass a naive round-trip test while silently breaking the model.

**Test boolean-vs-string coercion as a typed assertion, not a string comparison.** `assert.strictEqual(parsed['mcp.braveSearch'], false)` — not `'false'`. This is the mistake that reads back as a settled `true` in every shell test.

## Steps

### 1. Scaffold the harness  <!-- agent: general-purpose -->

- [x] Read `test/settings-deny.test.js` in full; note its `run()` wrapper (`:79`), `scratchDir()` (`:76`), and the exact cleanup posture it uses
- [x] Create `test/bootstrap-prefs.test.js` with the same requires (`node:test`, `node:assert`, `node:fs`, `node:os`, `node:path`, `node:child_process`), `REPO`, `SCRIPT = path.join(REPO, 'lib','scripts','bootstrap-prefs.js')`, `SCHEMA = path.join(REPO, 'lib','scripts','templates','bootstrap-prefs-schema.json')`
- [x] Helpers: `scratchDir()` with a `prefs-` prefix; `run(args)`; `readJson(file)`; `writeSchemaFixture(dir, obj)` returning a path for `--schema`
- [x] A top-of-file comment stating that **no test may touch the real `~/.claude/bootstrap-prefs.json`**, with the reason

<!-- Updated: 2026-08-06 -->
**Note:** the file already existed (TASK-041, 4 slugifier tests). Extended in place rather than created; `PREFS` const renamed `SCRIPT`, `SCHEMA` added, `run(args, opts)` gained an `opts` spread for `HOME` redirection. Precedent cleanup posture is a trailing `fs.rmSync` (not `finally`); this file uses `try/finally` — later steps use `try/finally` for consistency within the file.

### 2. Four-state round-trip  <!-- agent: general-purpose -->

- [x] `unset` is absence — a `--get` against a missing file prints `unset` and exits 0; the file is not created by a read
- [x] `--set --value true` → `--get` prints `true`; the on-disk value is the **boolean** `true`, asserted with `strictEqual`
- [x] `--set --value false` → `--get` prints `false`; on-disk boolean `false`. Assert the file contains no `"false"` string
- [x] **`ask` reads back as `ask`, not `unset`** — its own named test, with a comment citing the conflation trap. Assert both the printed output and the on-disk string `"ask"`
- [x] A multi-value key round-trips each value: `gitCommit.versionBump` through `auto`, `confirm`, `never`
- [x] `--unset` returns a key to `unset` — `--get` prints `unset` and the key is gone from the file's `Object.keys()`
- [x] `--unset` on an already-absent key exits 0 and is not an error
- [x] `--unset` on an already-absent key — **both** paths covered: no values file at all (no file and no README created), and a file present without the key (byte-identical)
- [x] Overwrite works: `true` → `false` → `ask` on the same key, each `--get` reflecting the latest. **This is the capability `merge-settings-deny.js --set-key` deliberately lacks**, so it must be pinned here
- [x] After every sequence, assert the file contains **no `null`** and exactly the keys explicitly set

<!-- Updated: 2026-08-06 -->
**Finding — schema defaults mask `unset` on narrowed reads.** `--get --target <missing>` on `gitCommit.autoPush` prints `false`, not `unset`, because the schema `default` fallthrough applies to narrowed reads too (TASK-041 judgment call). All "absence is unset" assertions therefore use `default: null` keys (`mcp.braveSearch`, `mcp.serena`, `gitignore.infoExclude`), guarded by a tripwire test asserting those defaults are still `null`.
**Finding — a project-scope key never consults a redirected `HOME`.** `mcp.serena` is `scope: project`, so with no `--project` the resolver consults no file at all; a HOME-redirection assertion built on it would pass even if the redirect were broken. Switched to `mcp.braveSearch` (`scope: global`), empirically verified.

### 3. Resolution order  <!-- agent: general-purpose -->

Use `--global` with a redirected `HOME` (proven to work by TASK-029 step 5) plus `--project <scratch>` so both real layers are exercised, not just `--target`.

- [x] `scope: "either"` — project value wins over a differing global value
- [x] `scope: "either"` — with only a global value set, the project inherits it
- [x] **Project `ask` overrides global `true`** — the specific case TASK-030 calls out, because it is the one where the losing layer is a settled non-prompting answer
- [x] `scope: "global"` — a value in the project file is **not** consulted; the global value (or `unset`) wins
- [x] `scope: "project"` — a value in the global file is **not** consulted
- [x] Neither layer set, schema `default` non-null → `--get` returns the default and reports the layer as `default`
- [x] Neither layer set, schema `default` null → `unset`
- [x] `--list` reports the supplying layer per key (`project` / `global` / `default` / `unset`)
- [x] `--list` includes a values-file key with no schema entry under the unrecognized heading rather than dropping it

<!-- Updated: 2026-08-06 -->
**Hermeticity guard added.** `withLayers()` fires a read-only `--list --project <scratch>` *before* the test body and asserts the trailer's global path sits inside the scratch `HOME`. A failed `HOME` redirect is a one-way risk — an after-the-fact assertion would fire only once the developer's real store had already been written.
**Note:** `--get` never prints the layer, only the value; every "reports the layer as X" assertion goes through `--list`. `--set` enforces the value grammar but not `scope`, which is what makes the "parked in the wrong layer, kept on disk, never consulted" tests expressible.

### 4. Exit-code contract  <!-- agent: general-purpose -->

The contract is that exit 1 means the *caller* is wrong and exit 0 means the *world* is in an unexpected state. Both halves need pinning, because a helper that exits 1 on a malformed file would abort installs under `set -euo pipefail`.

- [x] **Invalid `--value` exits 1 and writes nothing** — capture the file's bytes before and after and assert they are identical (or that the file still does not exist). Cover a value outside the key's grammar, and specifically `--value ask` on `gitCommit.versionBump`, whose grammar is `auto | confirm | never` and whose `ask` state is spelled `confirm`
- [x] `--value unset` and `--value null` exit 1, with stderr naming `--unset`
- [x] `--set` with no layer selector exits 1 and writes nothing
- [x] An unknown flag, two operations at once, and `--set` without `--value` each exit 1 (plus `--value` without `--set`, the same caller-bug class in the opposite direction)
- [x] **A malformed values file degrades to `unset` and exits 0** on `--get`, with a warning on stderr naming the file
- [x] A malformed values file causes `--set` to exit **0 without writing** — assert the garbage bytes survive untouched. This is deliberate: clobbering a hand-edited file would destroy answers
- [x] A malformed values file causes `--unset` to exit 0 without writing too — same `readWritableTarget` → `warnSkip` path; corruption surviving `--set` but being rewritten by `--unset` is the same data loss by another door
- [x] A malformed **schema** file exits 0 — `--get` still resolves from the values files and `--set` still writes, with a stderr warning. A partial install must not break `/git-commit`
- [x] A missing values file exits 0 everywhere
- [x] An **unknown key** on `--set` warns on stderr but writes and exits 0 — forward compatibility for a values file written by a newer bootstrap

<!-- Updated: 2026-08-06 -->
**Note — two distinct exit-1 stderr shapes.** Argv errors go through `usageError()` and print the 7-line USAGE block; value rejections (bad value, `--value unset`/`null`) are a bare `console.error` + `exit(1)` with no USAGE block (`bootstrap-prefs.js:674-695`). Asserted separately.
**Pinned degradation:** with an unusable schema there are no defaults, so `gitignore.offerSectionUpdates` resolves to `unset` rather than `true`. Asserted rather than only commented, so the loss stays visible. `--section-key` runs before `loadSchema()` and is asserted to emit an *empty* stderr under a garbage `--schema`.

### 5. Write mechanics  <!-- agent: general-purpose -->

- [x] `--set` creates a missing file, including a missing parent directory (`<scratch>/.claude/`) — split into two tests, because `--target` and `--project` reach `mkdirSync` by different paths
- [x] The written file parses with **plain `JSON.parse` and zero preprocessing** — no comments, no trailing commas
- [x] Indentation is preserved: seed a 4-space file and a tab-indented file, `--set`, and assert the indent survives (`detectIndent` precedent, `settings-deny.test.js:268` and `:415`)
- [x] Atomic write leaves **no `.tmp-*` residue** — assert on `fs.readdirSync(dir)` after both a successful write and each failure path
- [x] Unrelated keys already in the file survive a `--set` and a `--unset` untouched, in their original order

<!-- Updated: 2026-08-06 -->
**Non-vacuity verified by mutation** (source restored and re-checked symbol-by-symbol afterwards): `renameSync`→`copyFileSync` caught by all 3 residue tests; dropping `mkdirSync({recursive:true})` caught by the creation tests; sorting keys on reserialise caught by the key-order *and* indent tests; injecting a `//` comment caught by the plain-JSON test.
**Note:** `lib/scripts/bootstrap-prefs.js` is still **untracked**, so `git diff` is not a valid restore check for it — verify restoration by re-reading the symbols.
**Note:** a no-op `--unset` (file present, key absent) skips `writeValues` but still runs `writeCompanion` (`bootstrap-prefs.js:722-727`), which is why the residue helper filters on `/\.tmp-/` rather than asserting a file count.

### 6. Companion README generation  <!-- agent: general-purpose -->

- [x] `bootstrap-prefs.README.md` appears beside the values file after a `--set`, and after a `--unset`
- [x] It is regenerated on a **no-op set** (setting a key to the value it already holds) — the schema may have changed since the last write
- [x] It lists each set key with its current value, and an unrecognized values-file key appears under its own heading rather than being dropped
- [x] **`## Unrecognized keys` names BOTH populations with distinct reasons** (TASK-041 departure #3, not in this task's original text): schema-unknown → `no entry in the preference schema`; scope-inert → ``scope is `global` — this layer never consults it, so it has no effect here``
- [x] Its header states that it is generated and that hand edits are overwritten — assert on the literal phrasing so a rewrite cannot quietly drop the warning
- [x] It is **not** created by a read-only `--get` or `--list`

<!-- Updated: 2026-08-06 -->
**Finding — the scope-inert population is unreachable under `--target`.** `scopePermitsLayer` returns `true` unconditionally for the `target` layer (`bootstrap-prefs.js:398`), so a `global`-scope key in a `--target` file renders as a normal documented row, not an orphan. The two-population test therefore runs on the **project** layer via `withLayers`; a separate test pins the `--target` contrast so the distinction cannot erode.
**Note:** `--unset` of a key absent from an *existing* values file still regenerates the companion (`writeCompanion` sits outside the `if (present)` guard, `:721-727`) — a third regeneration trigger beyond the two named above.
**Non-vacuity verified:** filtering scope-inert keys out of `unrecognized` in the source turns the two-population test red; source restored byte-identical.

### 7. Schema tests — static assertions on the shipped file  <!-- agent: general-purpose -->

These read the real `templates/bootstrap-prefs-schema.json`, in the style of `settings-deny.test.js:89-164`.

- [x] The template is a flat JSON object of key → entry; no nested groups
- [x] Every entry has all seven required fields present, with `scope`, `consumer`, `summary`, `detail`, `values`, `askedBy` non-empty strings and `default` either `null` or a JSON scalar
- [x] Every `scope` ∈ `{global, project, either}`; every `consumer` ∈ `{installer, skill}`
- [x] Exactly the two expected wildcard entries carry `dynamic: true` (`guides.*`, `gitignore.section.*`), and every `dynamic` key ends in `.*` — asserted in **both** directions
- [x] Every `values` string splits on `|` into at least one non-empty trimmed token; **`gitignore.section.*` has exactly one token, `false`** — this is the `.gitignore` declines-only invariant expressed as data, so pin it with a comment citing `merge-gitignore.sh:10`
- [x] Every non-null `default` is one of its own entry's legal values — plus a JSON-type check, so a stringified `"true"` default fails
- [x] `gitignore.review` does **not** appear — it was superseded by `gitignore.offerSectionUpdates`, and a re-introduction would silently split one prompt into two keys
- [x] No key or `detail` mentions an API key, token, or secret — the Brave and Context7 key prompts are permanently out of the store
- [x] Every `askedBy` names a file that exists under `lib/scripts/`, or a slash-command directory that exists under `lib/skills/`
- [x] The five `consumer: "skill"` keys are exactly `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests`, `gitignore.offerSectionUpdates` — a count-and-membership assertion, so adding a behavior-changing key without deliberate thought fails the suite

<!-- Updated: 2026-08-06 -->
**The no-secrets invariant is structural, not a keyword ban.** Two `detail` strings legitimately name an API key in order to deny storing it, so a naive `/api key|token|secret/i` scan would fail on day one and have to be weakened. Expressed instead as: (1) no key *name* matches `/key|token|secret|password|credential/i`; (2) every `values` is a closed enumeration of literal tokens, so `--set` structurally cannot store an arbitrary string under any key; (3) an entry whose `detail` names a credential must also match `/never stored|not stored|never written|outside this schema/i` — applied **per entry, not per sentence** (`mcp.braveSearch`'s prerequisite sentence names the key with the denial in a later sentence).
**Correction:** the declines-only sentence is at `merge-gitignore.sh:11`, not `:10` (line 10 is a blank `#`). The comment cites `:11` and the test asserts the sentence is still present, so the citation cannot rot silently.
**Non-vacuity verified:** 14 deliberate schema mutations (nested group, dropped field, `scope: "user"`, dropped `dynamic`, widened section grammar, out-of-grammar default, stringified boolean default, re-added `gitignore.review`, an `mcp.braveApiKey` key, a free-text `values`, undenied API-key prose, renamed script, renamed slash command, a sixth skill key) were each caught. Schema restored byte-identically.

### 8. Schema/key bijection  <!-- agent: general-purpose -->

- [x] **Scripts → schema** (active now): scan `lib/scripts/**/*.sh` and `lib/skills/**/*.md` for `bootstrap-prefs.js` invocations, extract the key literal following `--get` / `--set` / `--unset`, and assert each resolves through `lookupSchema` (exact or wildcard). During Phase 1 the set is empty, which is a legitimate pass — assert the *extraction* works by feeding the matcher a known-good and a known-bad fixture string, so an extractor that silently matches nothing cannot masquerade as coverage
- [x] **Schema → scripts** (written now, skipped now): every non-`dynamic` schema key is referenced by at least one script or skill. Use `test.skip` with a reason string naming **ROADMAP-005 Phase 2** as the un-skip point. Do not weaken it into an always-passing assertion
- [x] Add un-skipping this test to ROADMAP-005 Phase 2's checklist — a skipped test with no scheduled owner becomes permanent

<!-- Updated: 2026-08-06 -->
**Skip form:** `test(name, { skip: '<reason>' }, fn)`, not `test.skip(...)` — only the options form renders the reason in node:test's output (verified). The reason names ROADMAP-005 Phase 2 as the un-skip point and states that the body is complete and needs no edit at un-skip time.
**Skip proven live, not stubbed:** temporarily un-skipped, the test failed for exactly the right reason — all **17** non-dynamic schema keys reported unreferenced. Re-skipped afterwards.
**Current call-site count is 0** — no `lib/scripts/**/*.sh` (15 files) or `lib/skills/**/*.md` (61 files) even mentions `bootstrap-prefs.js`. The scripts→schema assertion is written as "every found key resolves through the schema", so it passes vacuously today and becomes a live check the moment Phase 2 lands, with no edit required. `callSiteFiles()` asserts both file populations are non-empty so a broken walker cannot pass vacuously.
**Roadmap updated:** the un-skip instruction is now a sub-bullet under ROADMAP-005 Phase 2's `test/prompt-stickiness.test.js` item.

### 9. Verify  <!-- agent: general-purpose -->

- [x] `npm test` green. Report the new total and the delta — the suite was 144 at the start of ROADMAP-005 (141 tracked plus the 3 from the untracked `test/npm-pack-contents.test.js`), so state the arithmetic rather than a bare number
- [x] Confirm the run leaves `~/.claude/bootstrap-prefs.json` absent or unmodified — check before and after
- [x] **Prove the tests can fail**: temporarily break one behavior in `bootstrap-prefs.js` (make `--get` print `unset` for a stored `ask`) and confirm the named conflation test goes red; then revert. Record that this was done. A test suite for a four-state model that has never been seen failing is not evidence of anything
- [x] Confirm no scratch directory is left behind if the suite is interrupted, or note that the precedent accepts `os.tmpdir()` reaping — match the sibling file either way
- [x] `node --check test/bootstrap-prefs.test.js`

<!-- Updated: 2026-08-06 -->
**Arithmetic:** 144 at ROADMAP-005 start → +4 (TASK-041 slugifier) = **148 baseline** → +55 (TASK-042) = **203 total: 202 pass, 1 skipped, 0 fail**. Cross-check: `test/bootstrap-prefs.test.js` alone reports 59 tests (58 pass, 1 skip); 59 − 4 = 55.
**Hermeticity:** `~/.claude/bootstrap-prefs.json` and `~/.claude/bootstrap-prefs.README.md` absent before and after all four runs (including the deliberately-failing one). No `.tmp-*` residue in `~/.claude/`. Zero `prefs-` scratch dirs left in `os.tmpdir()`.
**Failability proof (done, reverted).** Mutated `bootstrap-prefs.js:569` from `layer === 'unset' ? 'unset' : formatValue(value)` to `layer === 'unset' || value === 'ask' ? ...`. The named conflation test went red with its own message — `AssertionError: a stored \`ask\` was reported as \`unset\` — the conflation trap`. Blast radius was exactly the three ask-state tests (conflation trap, the `true → false → ask` overwrite, and the project-`ask`-beats-global-`true` resolution case). Reverted and **verified by content, not git** (the file is untracked, so `git diff` proves nothing): SHA-256 and byte count identical to the pre-mutation capture, `value === 'ask'` absent, suite back to 202 pass.
**Scratch posture:** this file is 100% `try/finally` — stricter than the sibling `settings-deny.test.js`, which uses trailing `fs.rmSync` and deliberately leaks a failing test's dir for inspection. `try/finally` does not survive SIGINT; that residual case falls back to `os.tmpdir()` reaping, the same posture the sibling accepts.

## Notes

- **Blocked on TASK-041**; TASK-041 is blocked on TASK-040. This is a strict chain — Phase 1 has no parallelism.
- **Deferred to Phase 4**: `test/npm-pack-contents.test.js` gains pins for `bootstrap-prefs.js` and `bootstrap-prefs-schema.json`. Do not add them here; that file is currently untracked and Phase 4 owns it.
- **Phase 2 adds `test/prompt-stickiness.test.js`**, a separate file covering `lib.sh`'s sticky helpers and the `BOOTSTRAP_ASSUME_TTY` seam. Nothing about tty behavior belongs in this file — the helper has no concept of a tty.
