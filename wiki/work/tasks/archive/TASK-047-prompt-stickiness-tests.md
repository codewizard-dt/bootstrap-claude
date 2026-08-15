---
id: TASK-047
aliases: [TASK-047]
title: "test/prompt-stickiness.test.js — sticky-prompt coverage and the bijection un-skip"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [TASK-044, TASK-045, TASK-046]
blocks: []
parallel_safe_with: [TASK-031, TASK-039]
uat: "[[UAT-047]]"
tags: [prefs, install, testing, consent, roadmap-005]
---

# TASK-047 — test/prompt-stickiness.test.js — sticky-prompt coverage and the bijection un-skip

part_of::[[ROADMAP-005]]

## Objective

Add `test/prompt-stickiness.test.js` — hermetic, scratch-`HOME` coverage that a remembered answer suppresses its prompt and that a non-interactive run records nothing — and un-skip the `schema -> scripts` bijection test in `test/bootstrap-prefs.test.js`, which Phase 1 left skipped because the helper had zero call sites. Together these are the anti-regression floor for everything Phase 2 built: without them, a sticky prompt that silently stops being sticky looks exactly like one that works, because the only visible symptom is a question being asked again.

## Approach

**The two claims in the roadmap item are not the same test, and the second one is the dangerous one.** "A remembered answer suppresses the prompt" fails loudly the first time a human runs the installer. "A non-interactive run records nothing" fails **silently and permanently**: one CI run writes a `false`, and from then on the prompt never appears again on that machine — there is no symptom, no prompt to notice, and nothing in a diff, because the store lives outside the repo. That case needs the strongest assertion in the file: not just "the answer was not applied", but **the values file does not exist**.

**Hermeticity is one-way and must be enforced before any write.** These tests drive real shell scripts that write to `$HOME/.claude/` and to a project's `.gitignore` and `.git/info/exclude`. If a redirect failed to take, the damage is done before any assertion could notice — the developer's own `~/.claude/bootstrap-prefs.json` rewritten, or this repo's `.gitignore` appended to. Copy `test/bootstrap-prefs.test.js`'s `withLayers()` posture exactly (`:464-491`): a **read-only probe first** that proves the redirect landed inside the scratch dir, and a refusal to run the body otherwise. Every scratch dir is `fs.mkdtempSync` and removed in a `finally`.

**`BOOTSTRAP_ASSUME_TTY=1` is what makes any of this reachable.** `spawnSync` hands the child a pipe, so `[ -t 0 ]` is false and no prompt body executes — that is why no existing test drives a prompt. Set the env var and write the answer to the child's stdin via the `input` option. A test that wants the non-interactive path simply omits the variable, which is also the exact condition the "records nothing" claim is about, so the seam and the claim are tested by the same mechanism from both sides.

**Test the helpers directly AND through at least one real script.** A unit test of `prompt_yn_sticky` proves the helper; it does not prove a call site passes the right key, the right selector, or reads the result correctly — which is the whole substance of TASK-044/045/046. So:

- **Helper-level** (source `lib.sh` in a generated wrapper, the `test/run-project-sync.test.js:79-99` pattern): the state matrix, the stdout-purity claim, the digit→name mapping.
- **Script-level**: drive the real `lib/scripts/merge-gitignore.sh` against a `git init`'d scratch repo. It is the only Phase 2 script that needs neither a `claude` binary nor a network, so it gives genuine end-to-end evidence cheaply. `install-mcps.sh` needs a stubbed `claude` on `PATH` and is better left to UAT.

**Un-skipping the bijection is a two-tier change, not a one-line delete — and the roadmap's note is optimistic.** UAT-042 confirmed the skipped test fails reporting exactly **17** unreferenced keys (19 schema keys minus the 2 dynamic families). Phase 2 wires **13** of those 17. The remaining four — `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests` — are all `consumer: skill`, and their call sites land in **Phase 3** (TASK-030 and `/bootstrap-config`). So a bare un-skip goes red on four keys through no fault of Phase 2.

Resolve it by measuring first, then splitting the assertion:

1. Delete the `{ skip: … }` option and run it. Record the actual residue.
2. If the residue is exactly those four `consumer: skill` keys, keep the assertion live and hard for every `consumer: installer` key, and move the four into a named `PHASE_3_PENDING` allowlist with the reason and the owning task written next to it. Guard the allowlist so it cannot be abused: every entry must be a real schema key **and** carry `consumer: "skill"`, so an installer key can never be parked there to silence a genuine drift. Assert the allowlist is a subset of the unreferenced set too, so it empties itself honestly when Phase 3 lands rather than rotting as a permanent exemption.
3. If the residue is anything else, a Phase 2 call site is missing or a key is misspelled — fix the call site, do not widen the allowlist.

Say all of this in a comment on the test. The roadmap's sub-bullet claims the body needs no edit at un-skip time; that is true of the *assertion logic* and not of the skill-key residue, and a future reader needs to know which.

**The other half of the bijection goes live for free.** `scripts -> schema` (`test/bootstrap-prefs.test.js:2702`) was written to be vacuous during Phase 1 and to become meaningful the moment a real call site exists — it asserts "every found key resolves", never "found.length === 0". After Phase 2 it is a live typo-catcher. Confirm it is actually finding keys now (a non-zero count) rather than still passing on an empty set; a scan that silently matches nothing is the failure mode that section was built to prevent.

**Do not duplicate `test/bootstrap-prefs.test.js`.** That file owns the helper's CLI surface, the four-state model, layer resolution, and the schema's static invariants. This file owns exactly one thing: **the shell prompt layer** — whether a prompt is shown, and whether an answer is recorded. If an assertion can be made without a prompt in it, it belongs in the other file.

## Steps

### 1. Read the precedents  <!-- agent: general-purpose -->

- [x] Read `test/bootstrap-prefs.test.js` — the hermeticity banner (`:22-34`), `withLayers()` and its read-only redirect probe (`:464-491`), `run()` (`:63-66`), and both bijection tests (`:2702-2765`)
- [x] Read `test/run-project-sync.test.js` for the generated-wrapper pattern that sources the real `lib.sh` and calls one function under `set -euo pipefail` (`:79-99`)
- [x] Read `test/install-global.test.js` for the scratch-`HOME` + scratch-template-copy pattern
- [x] Read the finished `prompt_yn_sticky` / `prompt_choice_sticky` / `prefs_get` / `has_tty` in `lib/scripts/lib.sh`, and the call sites TASK-044/045/046 landed

**Findings (digest at `scratchpad/TASK-047-precedents.md`):**
- Schema is **19 keys, 17 non-dynamic**: 14 `consumer: installer`, **5** `consumer: skill` — the task's Approach names 4, but `gitignore.offerSectionUpdates` is also `consumer: skill`. It *is* wired by `merge-gitignore.sh`, so it does not join the allowlist.
- **`scripts -> schema` currently finds ZERO keys.** Its extractor only matches literal `bootstrap-prefs.js … --get|--set <key>`, but no Phase 2 call site invokes the helper directly — they all go through the `lib.sh` wrappers. The scan is passing vacuously, exactly the failure mode Step 7's last checkbox exists to catch. Fix = teach the extractor the wrapper forms (key at arg 1 for `prefs_get`/`prefs_set`/`prompt_yn_sticky`/`prompt_choice_sticky`, arg 2 for `prompt_scope`, args 6+7 for `register_optional_mcp`), **not** a new allowlist.
- `BOOTSTRAP_ASSUME_TTY=1` + stdin at EOF ⇒ `read` returns empty ⇒ a sticky y/n records `false`. Documented EOF artifact, unreachable at a real tty; every seam-enabled test must supply `input`.
- `CITATION_PINS` pins `lib.sh:387` and `merge-gitignore.sh:11/:171/:376` **by line number** — Step 8's temporary mutations must not shift line counts above those.
- `_prefs_selector_args` is substituted unquoted ⇒ scratch paths must contain no whitespace.

### 2. Build the harness  <!-- agent: general-purpose -->

- [x] Create `test/prompt-stickiness.test.js` — `node:test` + `node:assert` only, zero dependencies, matching the sibling files' style
- [x] Write a file-top banner stating the scope (the shell prompt layer, not the helper CLI) and the hermeticity rule verbatim: **no test may read or write the real `~/.claude/bootstrap-prefs.json`, this repo's `.gitignore`, or this repo's `.git/info/exclude`**
- [x] `withScratchEnv(body)` — an `fs.mkdtempSync` scratch `HOME` plus an `fs.mkdtempSync` scratch project dir, both removed in a `finally`, and an env carrying `HOME` and `BOOTSTRAP_ASSUME_TTY`
- [x] **Redirect probe before any write**, mirroring `withLayers()`: run `bootstrap-prefs.js --list --project <scratch>` read-only and assert the printed `Layers: project (…) then global (…)` trailer names paths inside the two scratch dirs. Refuse to run the body otherwise, with a message saying a write would have hit the real store
- [x] `runShell(snippet, { input, env })` — writes a wrapper that sources the real `lib/scripts/lib.sh` under `set -euo pipefail`, runs the snippet, and returns `{ status, stdout, stderr }`
- [x] `prefsFile(dir)` / `readPrefs(dir)` helpers, and an `assertNoPrefsFile(dir)` that asserts **both** the values file and its `bootstrap-prefs.README.md` companion are absent — a stray companion is the tell that a write got further than it should have

**Baseline recorded: 218 tests — 217 pass, 0 fail, 1 skip.** After Step 2: 222 — 221 pass, 0 fail, 1 skip.
Harness API: `scratchDir` (realpath'd, throws on whitespace) · `curatedEnv` (not `...process.env`; `BOOTSTRAP_ASSUME_TTY` deleted) · `prefsCli` / `seedPref` · `prefsFile` / `companionFile` / `readPrefs` · `assertNoPrefsFile` · `assertRedirectLandedInScratch` (factored out so the refusal itself is testable) · `withScratchEnv` · `runShell(snippet, {input, env, tty, cwd})` returning **untrimmed** streams. Four harness smoke tests.
Departures: `node:assert/strict` over sibling `node:assert`; `runShell` does not trim (Step 5's purity claim is about exact bytes); no `WRAPPER_EXIT_OK` stdout marker (it would pollute the captured value).

### 3. The remembered-answer claim  <!-- agent: general-purpose -->

- [x] `prompt_yn_sticky` with a seeded `true`: assert it returns 0, that stdout carries the remembered-answer notice, that **the prompt text does not appear in stdout at all**, and that nothing was read from stdin (pass a poison answer as `input` that would flip the result if it were consumed)
- [x] Same with a seeded `false` → returns 1, no prompt text
- [x] Seeded `ask`: the prompt **is** shown, the given answer is honoured, and the stored value is still `ask` afterwards — not overwritten by the reply. This is the conflation trap on the shell side and deserves its own named test
- [x] Unset: the prompt is shown, the answer is honoured, and the answer is recorded with the right JSON type (`true`/`false` booleans, never the strings)
- [x] An unrecognized stored value (e.g. `"maybe"` written via `--target` to bypass grammar checks): the helper warns on stderr and falls back to prompting rather than silently treating it as a decline

**`read -r -p` never echoes to a pipe**, so "prompt text absent from stdout" is vacuous in both directions. It is kept as a cheap guard against a future refactor that echoes, but the real evidence is: **poison input** for suppression (seeded `true` + `input:'n\n'` still returns 0), and **both branches** for a prompt actually running (`y`→0 and `n`→1 from the identical snippet). Test 4 consumes its input and flips, which is what makes tests 1–2 evidence rather than tautology.
**Digest correction: `--target` does NOT bypass grammar validation** (`bootstrap-prefs.js:688-696` keys validation on the schema entry, not the layer). Checkbox 5 uses `--target` **plus** a `--schema` fixture with `values` nulled; `plantUnrecognizedValue()` first asserts the *real* schema rejects `maybe` so the bypass can't go vacuous. `ask` also needed `gitCommit.autoPush` — `mcp.braveSearch`'s grammar is `true|false` and rejects it.
The `*)` unrecognized branch leaves `record=true`, so "treating it as unset" is exact — the reply replaces the junk. Asserted.

### 4. The non-interactive claim — the load-bearing one  <!-- agent: general-purpose -->

- [x] With **no** `BOOTSTRAP_ASSUME_TTY` and no tty: `prompt_yn_sticky` returns 1 (no) and `prompt_choice_sticky` echoes its default
- [x] Assert `assertNoPrefsFile(scratchProject)` and the same for the scratch `HOME` — **no values file and no companion README anywhere**
- [x] Repeat with a *seeded* store to prove the read path still works without a tty: a stored `true` is honoured non-interactively, and the file is not rewritten (compare bytes before and after)
- [x] Comment why this is the strongest assertion in the file: a persisted non-interactive decline is invisible, permanent, and leaves no prompt through which to change it

6 tests. Every one supplies `input` it expects to be **ignored** — proof the non-tty branch short-circuits before `read`, rather than merely having nothing to read. Per-test `assertNoTtySeam(S)` guard.
**Bytes alone were not enough.** Re-setting a key to the value it already holds exits 0 and leaves the values file byte-identical (same sha256, same size) while advancing the mtime of it *and* its companion. That idempotent read-`true`-write-`true`-back is exactly the shape this regression would take, so `mtime` is the only field that catches it — kept in `storeFingerprint`. Not flaky: the assertion is that mtime did *not* move, so a coarse-granularity filesystem misses a detection, never fails spuriously.
**Stored `ask` with no tty, pinned not changed:** `ask` sets `record=false` and falls into the same `if ! has_tty` return as `unset` — observably identical, differing only in what is left on disk. The important half is already right: an unattended run cannot consume, downgrade, or overwrite an explicit `ask`.
Only the seeded-`true` direction can prove the no-tty read path — a seeded `false` returns 1 identically to the auto-no and would be unfalsifiable.

### 5. `prompt_choice_sticky` — stdout purity and digit→name mapping  <!-- agent: general-purpose -->

- [x] Capture the function with `$( )` in the wrapper and assert the captured value is **exactly** one of the legal names — no notice text, no prompt echo, no leading spaces. A diagnostic on stdout here silently becomes the caller's answer
- [x] Digit input: `1`/`2`/`3` resolve to the 1st/2nd/3rd name in the order given, and the **name** is what lands in the store — assert the stored JSON value is `"shared"`, never `1` or `"1"`
- [x] Exact-name input resolves to itself; empty/EOF/garbage resolves to the declared default and records nothing beyond that default's own rules
- [x] A seeded name suppresses the prompt; a seeded value matching no name warns on stderr and re-prompts (the menu-reorder case the name-based storage exists to survive)

6 tests. Purity is discharged by `assertCapturedName()` asserting **whole-stdout byte equality** (`OUT=[<name>]\n`, nothing before or after) in *every* state rather than in one dedicated test, so a stdout leak fails whichever state produces it. Every digit/name row picks a `<default-name>` that is **not** the expected answer (`otherName()`), so no row can pass via a helper that ignores stdin and echoes the default.
**"Records nothing beyond the default's own rules" resolved to: the default IS recorded.** `lib.sh:483-512` initialises `resolved` to `$default_name` and gates the write solely on `record=true`, with no comparison against the default. Only a stored `ask` (`record=false`) and the no-tty early return suppress it. Pinned with a comment explaining why that's correct — pressing Enter is an answer.
Helper change: `plantUnrecognizedValue()` gained a `dir` param. `mcp.playwrightConflict` is `scope: project`, so a value planted in the scratch HOME is never read back through a `--project` selector and the test would have silently degraded into a duplicate of the unset case.

### 6. End-to-end through a real script  <!-- agent: general-purpose -->

- [x] Drive `lib/scripts/merge-gitignore.sh --interactive <scratch>` against a `git init`'d scratch repo with `BOOTSTRAP_ASSUME_TTY=1` and scripted stdin
- [x] Decline one `.gitignore` section; assert the stored key is exactly what `bootstrap-prefs.js --section-key <title>` returns for that title, and that the second run does not offer that section
- [x] Accept a section; assert **no** `gitignore.section.*` key was written for it — the declines-only invariant, end to end
- [x] Answer `prefs.gitTracking` with each of the three options in three separate scratch repos; assert the two prefs paths land in `.gitignore`, in `.git/info/exclude`, or nowhere, and that the second run does not re-ask
- [x] Assert the repo's own `.gitignore` and `.git/info/exclude` are untouched by the whole run — read their bytes before and after in the test itself, so a broken redirect fails an assertion instead of a code review

5 tests, incl. one harness test proving the untouched-file guard itself fires on a changed, a created, and a deleted file (and outranks a body failure). **No production bug found** — every documented behaviour held end to end, including TASK-046's `default: null` fix actually making the three-way menu reachable.
Prompt count is **derived, not hardcoded**: `offeredSections().length` (8 today) + `.git/info/exclude` + `prefs.gitTracking` = 10. Titles are parsed from `lib/scripts/templates/gitignore` with the script's own awk rules, so a template edit reshapes the answer script automatically. The `gitignore.offerSectionUpdates` master gate is deliberately **not** budgeted — schema default `true` means a virgin project takes that arm and is never asked.
`--section-key` pair pinned (all 8 checked): `Claude Code — machine-local MCP registration (absolute paths; regenerated by setup)` → `gitignore.section.claude-code-machine-local-mcp-registration-absolute-paths-regenerated-by-setup`, plus an assertion that the em-dash key contains no `--` run.
`prefs.gitTracking` verified: `1 gitignore` → `.gitignore` created with both prefs paths, exclude untouched · `2 exclude` → `.gitignore` never created, both paths appended to `.git/info/exclude` · `3 neither` → neither file touched.
"Not re-asked" uses **poison stdin** (`'y\n'.repeat(24)`), not silence — a `y` would merge lines, or for the menu resolve to the default `exclude` *and record it*. All three fingerprints must be unchanged.
Behaviour worth recording: **declining the `.git/info/exclude` prompt prints nothing at all** (`merge-gitignore.sh:380-382` only calls `prefs_set`), so from stdout that prompt looks like it never fired — future tests must still budget its stdin line.

### 7. Un-skip the bijection  <!-- agent: general-purpose -->

- [x] In `test/bootstrap-prefs.test.js`, delete the `{ skip: … }` option from `test('schema -> scripts: every non-dynamic schema key is referenced by at least one script or skill', …)` (`:2730-2765`) and run the file. **Record the actual unreferenced list before changing anything else**
- [x] Expected residue: the four `consumer: skill` keys `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests`, whose call sites land in Phase 3. If the residue contains anything else, a Phase 2 call site is missing or a key is misspelled — **fix the call site, do not extend the allowlist**
- [x] Add a named `PHASE_3_PENDING` allowlist holding exactly that residue, each entry commented with its owning Phase 3 work item
- [x] Guard the allowlist: assert every entry is a real schema key, that every entry has `consumer: "skill"` (so no installer key can be parked there), and that every entry is genuinely still unreferenced (so it empties itself when Phase 3 lands instead of rotting as a permanent exemption)
- [x] Keep the assertion **hard** for every `consumer: installer` non-dynamic key — that population is fully wired by Phase 2 and must never regress
- [x] Replace the skip reason with a comment recording all of the above, including that the roadmap's "the body needs no edit" note is true of the assertion logic but not of the skill-key residue
- [x] Confirm the `scripts -> schema` direction (`:2702`) is now finding a **non-zero** number of keys; a scan still matching nothing would pass vacuously and is the exact failure that section was built to prevent

**Baseline was 244 — 243 pass, 0 fail, 1 skip** (Steps 2–6 grew it from the 218 recorded at Step 2). **Cold un-skip reported all 17 non-dynamic keys unreferenced, not 4.** Cause was the *extractor*, not a missing call site: `extractPrefKeys()` only recognized literal `bootstrap-prefs.js --get|--set <key>`, and every Phase 2 call site goes through the `lib.sh` wrappers instead. Fix = a second named, fixture-tested `extractWrapperKeys()` (+ a quote-aware `tokenizeWrapperCall()` so prompt strings containing `(`/`)`/`;` can't break argument-position matching, and backslash-newline continuation), merged into `foundPrefKeys()`. After the fix the residue narrowed to **exactly the four expected keys** — no call site was wrong, no key misspelled.
`PHASE_3_PENDING` = `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests` (each commented `ROADMAP-005 Phase 3, TASK-030`). Three guards + an unconditional, unexemptable check for every `consumer: installer` key. `gitignore.offerSectionUpdates` (the 5th `consumer: skill` key) confirmed wired by `merge-gitignore.sh` and commented as never eligible for the allowlist.
`scripts -> schema` now finds **17** key-literal occurrences (was 0, passing vacuously) and is pinned with `found.length > 0`. No production file touched, so `CITATION_PINS` line numbers are unaffected. After Step 7: **245 — 245 pass, 0 fail, 0 skip.**

### 8. Prove the suite can fail  <!-- agent: general-purpose -->

- [x] Temporarily break the stickiness read in `lib/scripts/lib.sh` (make `prefs_get` always print `unset`) and confirm the remembered-answer tests go red while the non-interactive tests stay green. Restore and re-run
- [x] Temporarily make the non-interactive branch record its auto-answer and confirm the "records nothing" tests go red. Restore and re-run
- [x] Temporarily misspell one key at a Phase 2 call site and confirm `scripts -> schema` catches it. Restore and re-run
- [x] Verify restoration **by content**, not by `git diff` — the wiki and several test files are excluded from git in this checkout

**Baseline pre-mutation:** `npm test` 245/245/0 fail/0 skip. `sha256(lib.sh)=a8cd81b1…ca43de`, `sha256(merge-gitignore.sh)=38b06179…f9836f`.

**Mutation 1 — `prefs_get` always prints `unset`.** Single-line edit (line 625, the final `printf '%s\n' "$out"` → `"unset"`), no line-count shift, so `CITATION_PINS['lib.sh:387']` was never at risk. `node --test test/prompt-stickiness.test.js` — **red:** both `prompt_yn_sticky` remembered-answer tests (`true`/`false`), its `ask`-prompts-every-run test, its unrecognized-stored-value test, the matching three `prompt_choice_sticky` tests (remembered name, `ask`, unrecognized value), the `no tty still READS the store` test for **both** `prompt_yn_sticky` and `prompt_choice_sticky`, all four `merge-gitignore.sh` e2e tests, and the harness smoke test `a pref seeded into the scratch HOME is read back by lib.sh prefs_get`. **Green:** the two no-store/no-tty tests, both `ask`-with-no-tty tests, and the pure digit/name/default `prompt_choice_sticky` tests that don't depend on a stored answer's identity. **Finding (not a gap):** the checkbox's "remembered-answer red / non-interactive green" split is not a clean binary — the two "no tty still READS the store" tests are *by design* sensitive to `prefs_get` (Step 4 built them specifically to prove the no-tty path still reads the store), so they correctly went red too. A future reader should not assume every test under the "non-interactive claim" heading is tty-gated only. Restored via a single-line `replace_lines`; `sha256` back to `a8cd81b1…ca43de` exactly, `wc -l` unchanged at 657. `npm test` back to 245/245/0/0.

**Mutation 2 — non-interactive branch records its auto-answer.** In `prompt_yn_sticky`'s `if ! has_tty` block, appended `; prefs_set "$key" "$selector" false` onto the existing echo line (same 2-line shape, no line-count change). **Red:** exactly `prompt_yn_sticky: no tty and no stored answer — returns 1, ignores stdin, and records NOTHING in either layer` and `prompt_yn_sticky: a stored \`ask\` with no tty answers no, leaves the \`ask\` intact, and records NOTHING`. **Green:** everything else, including both `prompt_choice_sticky` "records nothing" tests — expected, since only the `prompt_yn_sticky` branch (the one the Approach names as "the load-bearing" claim) was mutated; `prompt_choice_sticky` has its own separate non-interactive branch, untouched. This isolation is itself evidence the two functions' coverage doesn't cross-contaminate. Restored via `replace_content`; `sha256` back to `a8cd81b1…ca43de` exactly, `wc -l` unchanged at 657. `npm test` back to 245/245/0/0.

**Mutation 3 — misspelled key at a Phase 2 call site.** In `lib/scripts/merge-gitignore.sh`, the `prefs_get gitignore.infoExclude "$PROJECT_DIR"` call (the `.git/info/exclude` remembered-decline check) was misspelled to `gitignore.infoExcludde` — single-line edit, no line-count shift (`CITATION_PINS['merge-gitignore.sh:171']`/`:376` unaffected). `node --test --test-name-pattern="schema" test/bootstrap-prefs.test.js` — **red:** `scripts -> schema: every key literal passed to bootstrap-prefs.js resolves through the schema`, reporting exactly `lib/scripts/merge-gitignore.sh: gitignore.infoExcludde` as unresolvable. **Green:** `schema -> scripts` (the paired `prefs_set gitignore.infoExclude` call two lines below was untouched, so the real key is still referenced) and every other schema test. Confirms Step 7's wrapper-aware `extractWrapperKeys()` does catch a misspelled key at a real `prefs_get` wrapper call site — no extractor blind spot found, matching Method note 6's expectation. Restored via `replace_content`; `sha256` back to `38b06179…f9836f` exactly, `wc -l` unchanged at 512.

**Final `npm test`: 245/245 pass, 0 fail, 0 skip.** All three mutations produced the expected failure signatures (with the one noted nuance on mutation 1's "no tty still READS the store" tests, which is correct coverage, not a weakness), and every touched file verified byte-for-byte restored by `sha256` before moving to the next mutation.

### 9. Verify  <!-- agent: general-purpose -->

- [x] `npm test` fully green with **zero skips** — the deliberate skip that has been in the suite since Phase 1 is gone, so any remaining skip is unaccounted for
- [x] Record the new suite total in the task Notes (it was 209: 208 pass, 0 fail, 1 skip)
- [x] Confirm no scratch directory is left behind: count `os.tmpdir()` entries before and after as a **delta**, not an absolute (`test/bootstrap-prefs.test.js`'s UAT found stale dirs from earlier shell smoke runs polluting an absolute count)
- [x] Confirm the real `~/.claude/bootstrap-prefs.json` and `~/.claude/settings.json` are stat-identical before and after a full `npm test`
- [x] Confirm this repo's own `.gitignore` and `.git/info/exclude` are byte-identical before and after a full `npm test`

## Notes

**Final suite: 245 — 245 pass, 0 fail, 0 skipped, 0 todo, 0 cancelled** (Step 8's baseline). The Phase-1 skip is gone and no new skip appeared; the number moved from the pre-task baseline of 209 (208 pass, 0 fail, 1 skip) via Step 2's harness (+13), Steps 3–6's coverage, and Step 7's un-skip (net +1, the skip converting to a pass), landing at 245/245/0/0/0.

`test/prompt-stickiness.test.js` holds **26 tests** at 2,138 lines: 4 harness smoke tests (redirect-probe refusal, `assertNoPrefsFile` catching a lone companion, the per-call tty seam, a seeded pref read back through `runShell`) + 5 `prompt_yn_sticky` state-matrix tests (remembered `true`/`false` suppress the prompt and never touch stdin, a stored `ask` re-prompts every run without being overwritten by the reply, an unanswered key prompts and records a JSON boolean, an unrecognized stored value warns on stderr and falls back to prompting) + 2 no-tty "records nothing" tests (`prompt_yn_sticky` and `prompt_choice_sticky`, each proving no values file *or* companion README appears in either scratch layer, with poison stdin proving the branch short-circuits before `read`) + 2 no-tty-still-reads-the-store tests (a remembered answer is honoured non-interactively and the file's mtime does not move) + 2 stored-`ask`-with-no-tty tests (answers no / chooses the default, leaves `ask` intact, records nothing) + 6 `prompt_choice_sticky` tests (digit→name resolution storing the name never the digit, exact-name self-resolution, empty/EOF/garbage falling to the declared default *and recording it*, a stored `ask` re-prompting without being overwritten, a remembered name suppressing the prompt even with a tty, an unrecognized stored value warning and re-prompting) + 1 untouched-file-guard harness test + 4 `merge-gitignore.sh` end-to-end tests (scripted-stdin section walk, a declined section's exact `--section-key` and non-reoffer, an accepted section recording no key at all, and the three-way `prefs.gitTracking` routing to `.gitignore` / `.git/info/exclude` / neither). Together they cover the file's one stated scope — the shell prompt layer — proving both that a remembered answer suppresses its prompt and that a non-interactive run persists nothing, at the helper level and through a real Phase 2 script end to end.

**Bijection un-skip, final state:** the `schema -> scripts` test in `test/bootstrap-prefs.test.js` runs unskipped. `PHASE_3_PENDING` holds exactly the four `consumer: "skill"` keys whose call sites land in Phase 3 — `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests` — each commented `ROADMAP-005 Phase 3, TASK-030`. Every `consumer: "installer"` non-dynamic key is asserted hard with no exemption. The allowlist is guarded on three sides (real schema key, `consumer: "skill"`, still genuinely unreferenced) so it empties itself honestly once Phase 3 lands rather than becoming a permanent escape hatch. The paired `scripts -> schema` direction now finds a non-zero count (17 key-literal occurrences, up from 0 pre-fix) after `extractPrefKeys()` gained a wrapper-call extractor (`extractWrapperKeys()` + `tokenizeWrapperCall()`) that recognizes the `lib.sh` wrapper forms Phase 2's call sites actually use, rather than only the literal `bootstrap-prefs.js --get/--set` invocation no Phase 2 script makes directly.

**Step 9 verification results (measured before/after a full `npm test` run, 245/245/0/0/0):**

- `os.tmpdir()` entry count: **412 before → 410 after (delta −2)**. No leak: the count went down, not up, so nothing from this suite's scratch dirs (all `fs.mkdtempSync`, all removed in `finally`) survived the run. The negative delta reflects unrelated OS/other-process tmp churn on this machine, not this suite.
- `~/.claude/bootstrap-prefs.json`: **did not exist before, still does not exist after** — the real global prefs store was never touched, matching the file-top hermeticity banner's guarantee.
- `~/.claude/settings.json`: **stat-identical before and after** — size 8772 bytes, mtime 1785789176, inode 42160696, unchanged in all three fields.
- `.gitignore`: **sha256 `d2be0b6b…6c6b738` before and after** — byte-identical.
- `.git/info/exclude`: **sha256 `014438e1…6997c0cc261` before and after** — byte-identical.

No production code was touched by this step; verification was read-only measurement plus this Notes write, per the step's own scope.

<!-- Updated: 2026-08-06 -->

