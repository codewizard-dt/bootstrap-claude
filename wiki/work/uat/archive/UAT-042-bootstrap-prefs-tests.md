---
id: UAT-042
aliases: [UAT-042]
title: "UAT: test/bootstrap-prefs.test.js — four-state and schema-bijection coverage"
status: passed
task: TASK-042
created: 2026-08-06
updated: 2026-08-06
---

# UAT-042 — UAT: test/bootstrap-prefs.test.js — four-state and schema-bijection coverage

implements::[[TASK-042]]

> **Source task**: [[TASK-042]]
> **Generated**: 2026-08-06

---

## Prerequisites

- [x] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [x] Node.js available on `PATH`
- [x] `lib/scripts/bootstrap-prefs.js` and `lib/scripts/templates/bootstrap-prefs-schema.json` exist (TASK-040 and TASK-041 are done and archived)

**Scope note.** The deliverable here *is* a test file, so this UAT is **meta-verification**: it checks that the harness is real rather than decorative. The central risk in a task like this is a suite that looks like coverage without being it — a skipped test that is actually a stub, an extractor that silently matches nothing, assertions nobody has ever seen fail. Each of those gets its own case below.

**Safety.** No test touches the real `~/.claude/bootstrap-prefs.json`. Cases that mutate source files to prove failability restore them immediately and verify restoration **by content**, not by `git diff` — `lib/scripts/bootstrap-prefs.js` and `test/bootstrap-prefs.test.js` are untracked, so `git diff` would show nothing either way.

---

## Test Cases

### UAT-EDGE-001: The file is valid and is picked up by the project's runner
- **Scenario**: The npm script is `node --test 'test/*.test.js'`, so the file must end in `.test.js` and sit directly in `test/`. A file in a subdirectory, or with a different suffix, would run green locally when invoked by hand and be silently absent from CI.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),path=require("path");const f="test/bootstrap-prefs.test.js";const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));console.log("exists:",fs.existsSync(f));console.log("directly in test/:",path.dirname(f)==="test");console.log("matches .test.js:",/\.test\.js$/.test(f));console.log("npm test script:",pkg.scripts.test)'
  ```
- **Expected Result**: Prints `exists: true`, `directly in test/: true`, `matches .test.js: true`, and the test script `node --test 'test/*.test.js'`.
- **Repeatable Unit Test**: Not applicable: asserts that a test file is discoverable by the runner. A test making this claim would itself have to be discovered by that runner, so it can only ever confirm the case it is already an instance of.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-002: `node --check` passes on the harness
- **Scenario**: Cheapest possible gate, from step 9.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node --check test/bootstrap-prefs.test.js
  ```
- **Expected Result**: Exits 0 with no output.
- **Repeatable Unit Test**: Not applicable: subsumed by the runner, which cannot load an unparseable file at all.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-003: The harness runs green with exactly one skip
- **Scenario**: The headline result. One skip is expected and documented; a **second** skip appearing would mean a test was quietly disabled rather than fixed.
- **Steps**:
  1. Run the prefs harness alone
- **Command**:
  ```bash
  node --test test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `tests 65`, `pass 64`, `fail 0`, `skipped 1`.

  > **Count arithmetic.** TASK-042 recorded 59 tests in this file (58 pass, 1 skip) at the time it closed. Since then this UAT sequence added 6: 2 in UAT-040 (citation pins, git-adjacent cross-references), 3 in UAT-041 (shebang/exec bit, zero-dependency, foreign-cwd schema resolution), and 1 in UAT-042 (two-population separation). 59 + 6 = 65.
- **Repeatable Unit Test**: Not applicable: this case *is* a test run.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-004: The one skipped test is the documented one, and its reason names Phase 2
- **Scenario**: Step 8's requirement, and the reason the options form `test(name, { skip: '<reason>' }, fn)` was chosen over `test.skip(...)` — only the options form renders the reason in `node:test` output. A skip whose reason is invisible is a skip nobody will ever revisit.
- **Steps**:
  1. Run the suite and read the skip annotation
- **Command**:
  ```bash
  node --test test/bootstrap-prefs.test.js 2>&1 | grep -A2 '^﹣'
  ```
- **Expected Result**: Exactly one `﹣` line, naming `schema -> scripts: every non-dynamic schema key is referenced by at least one script or skill`, followed by a reason that names **ROADMAP-005 Phase 2** as the un-skip point and states that the assertion body is complete and needs no editing at un-skip time.
- **Repeatable Unit Test**: Not applicable: a test asserting which of its siblings are skipped would have to parse its own runner's output from inside that run — the reporting layer is not reachable from within a test case.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-005: The skip is a real assertion, not a stub — un-skipping it fails for the right reason
- **Scenario**: **The most important case in this file.** TASK-042 states the rule directly: writing the bijection as an always-passing no-op "would be worse than not writing it — it would look like coverage." The only way to know the difference is to run it. A stub would pass or throw on undefined; a complete assertion fails with all 17 non-dynamic schema keys reported unreferenced (19 total minus the 2 dynamic wildcard families, which are excluded by design because their literals are computed at run time).
- **Steps**:
  1. Temporarily replace the `skip: '<reason>'` option with `skip: false`
  2. Run the test by name
  3. Restore the reason string and confirm by content
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),cp=require("child_process");const F="test/bootstrap-prefs.test.js";const orig=fs.readFileSync(F,"utf8");const m=orig.match(/    skip:\n(?:      .*\n)+/);if(!m){console.log("FAIL could not locate the skip option");process.exit(0)}fs.writeFileSync(F,orig.replace(m[0],"    skip: false,\n"));const r=cp.spawnSync(process.execPath,["--test","--test-name-pattern=schema -> scripts",F],{encoding:"utf8"});fs.writeFileSync(F,orig);const out=r.stdout+r.stderr;const keys=(out.match(/actual: \[([^\]]*)\]/)||["",""])[1].split(",").filter(s=>s.trim()).length;console.log("un-skipped run failed:",/fail 1/.test(out));console.log("unreferenced keys reported:",keys);console.log("restored byte-identical:",fs.readFileSync(F,"utf8")===orig)'
  ```
- **Expected Result**: Prints `un-skipped run failed: true`, `unreferenced keys reported: 17`, `restored byte-identical: true`. A run that **passed** un-skipped would mean the assertion is vacuous; a count other than 17 would mean the schema or the exclusion rule moved without the skip reason being revisited.
- **Repeatable Unit Test**: Not applicable: the check works by mutating the test file and re-running the runner inside it. Encoding that as a test would mean a test that rewrites its own source mid-run — the failability proof has to sit outside the suite it is proving.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-006: The suite can be seen failing — the conflation trap goes red on demand
- **Scenario**: Step 9's requirement, stated as a principle: *"A test suite for a four-state model that has never been seen failing is not evidence of anything."* Mutating `--get` so a stored `ask` reports as `unset` must turn the named conflation-trap test red — and the blast radius should be exactly the three ask-state tests, no more (a wider blast would mean the tests are entangled) and no fewer.
- **Steps**:
  1. Mutate `bootstrap-prefs.js`'s `--get` print line to conflate `ask` with `unset`
  2. Run the full prefs harness
  3. Restore and verify by content
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),cp=require("child_process");const F="lib/scripts/bootstrap-prefs.js";const orig=fs.readFileSync(F,"utf8");const from="layer === \x27unset\x27 ? \x27unset\x27 : formatValue(value)";const to="layer === \x27unset\x27 || value === \x27ask\x27 ? \x27unset\x27 : formatValue(value)";if(!orig.includes(from)){console.log("FAIL could not locate the --get print line");process.exit(0)}fs.writeFileSync(F,orig.replace(from,to));const r=cp.spawnSync(process.execPath,["--test","test/bootstrap-prefs.test.js"],{encoding:"utf8"});fs.writeFileSync(F,orig);const out=r.stdout+r.stderr;console.log("conflation test went red:",/✖ a stored .ask. reads back as .ask./.test(out));console.log("its own message fired:",/the conflation trap/.test(out));console.log("failures:",(out.match(/^ℹ fail (\d+)$/m)||[])[1]);console.log("restored byte-identical:",fs.readFileSync(F,"utf8")===orig)'
  ```
- **Expected Result**: Prints `conflation test went red: true`, `its own message fired: true`, `failures: 3`, `restored byte-identical: true`. The three are the named conflation test, the `true → false → ask` overwrite test, and the project-`ask`-beats-global-`true` resolution case — every test whose subject is the `ask` state, and nothing else.
- **Repeatable Unit Test**: Not applicable: same reason as UAT-EDGE-005 — a mutation proof cannot live inside the suite it mutates.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-007: The call-site extractor is proven on both known-good and known-bad forms
- **Scenario**: Step 8 names the exact failure this guards: an extractor that silently matches nothing would make **both** bijection directions pass forever while the schema and its call sites drifted apart. Since the live scripts→schema scan currently finds zero call sites (Phase 1 has none), a broken extractor and a correct one are indistinguishable from the scan's result alone — so the extractor is exercised against a fixture instead.
- **Steps**:
  1. Run the extractor test
- **Command**:
  ```bash
  node --test --test-name-pattern='extractPrefKeys' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. The fixture proves the extractor catches `--get`/`--set`/`--unset` key literals across quoted and bare script paths and a line-continued invocation, while yielding nothing from `--section-key` (which takes a *title*, not a key), from `--list`, from a prose mention, or from variable-expanded keys.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`extractPrefKeys pulls the key literal out of every real invocation form, and nothing out of the rest`).
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-008: The scripts→schema direction passes, and its file walkers are non-vacuous
- **Scenario**: The other half of step 8. This direction is live now and passes **vacuously** today (zero call sites), which is legitimate — but only because `callSiteFiles()` separately asserts that both file populations are non-empty. Without that guard, a broken walker returning `[]` would be indistinguishable from a clean repo.
- **Steps**:
  1. Run the live bijection direction
- **Command**:
  ```bash
  node --test --test-name-pattern='scripts -> schema' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. The walkers find a non-empty set of `lib/scripts/**/*.sh` and `lib/skills/**/*.md` files, and every extracted key literal (currently none) resolves through the schema.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`scripts -> schema: every key literal passed to bootstrap-prefs.js resolves through the schema`).
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-009: The two test populations stay on their own sides of the banner
- **Scenario**: The file's organising rule, from *Approach*: mixing behavior and schema tests "is what lets a drift bug hide behind a passing behavior suite." The helper is deliberately generic, so a **wrong schema entry breaks nothing a behavior test can observe** — a `scope` of `"user"` is simply a scope no layer matches. The separation is what makes the schema assertions mean anything, and until now it was described in a comment but enforced by nothing.
- **Steps**:
  1. Run the separation test
- **Command**:
  ```bash
  node --test --test-name-pattern='own sides of the banner' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. No non-comment line below the `SCHEMA TESTS` banner calls `run(`, `spawnSync(`, or `mkdtempSync(`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: the two test populations stay on their own sides of the banner`) — new in this UAT; failure proven by planting `if (false) run(['--list']);` inside a schema test, which the check caught by line number.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-010: The harness leaves no scratch directories and never touches the real store
- **Scenario**: Step 9's hermeticity requirement. The file is 100% `try/finally` — stricter than the sibling `settings-deny.test.js`, which uses a trailing `fs.rmSync` and deliberately leaks a failing test's directory for inspection. `try/finally` does not survive SIGINT; that residual case falls back to `os.tmpdir()` reaping, the same posture the sibling accepts.
- **Steps**:
  1. Run the full suite
  2. Immediately check for residue and for the real store
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),os=require("os"),path=require("path"),cp=require("child_process");const snap=()=>new Set(fs.readdirSync(os.tmpdir()).filter(f=>/^(prefs-|bootstrap-prefs-)/.test(f)));const before=snap();cp.spawnSync(process.execPath,["--test","test/bootstrap-prefs.test.js"],{encoding:"utf8"});const added=[...snap()].filter(x=>!before.has(x));console.log("NEW scratch dirs created by the suite:",added.length,added);const d=path.join(os.homedir(),".claude");for(const n of ["bootstrap-prefs.json","bootstrap-prefs.README.md"])console.log(fs.existsSync(path.join(d,n))?"PRESENT":"absent ",n);console.log("tmp residue in ~/.claude:",fs.readdirSync(d).filter(f=>/\.tmp-/.test(f)).length)'
  ```
- **Expected Result**: `NEW scratch dirs created by the suite: 0 []`, both store filenames `absent`, and `tmp residue in ~/.claude: 0`.

  > **Probe correction (2026-08-06, during `/uat-auto`).** The originally generated command counted `os.tmpdir()` entries matching `/^(prefs-|bootstrap-prefs-)/` in absolute terms and expected 0. It reported **3** — but none were the suite's. The harness creates dirs with exactly two prefixes, `prefs-` (via `scratchDir()`) and `bootstrap-prefs-slug-`; the three found were `bootstrap-prefs-layers.XXXXXX` and `bootstrap-prefs-smoke.XXXXXX`, whose `mktemp -d` style dot-suffix identifies them as artifacts of the **shell smoke scripts** from TASK-041's implementation session, unrelated to `npm test`. An absolute count makes the assertion hostage to anything else that ever wrote a similarly-named temp dir. Reformulated as a **before/after delta**, which is what the claim actually is — the suite must not *add* a scratch dir — and which stays correct on a dirty `os.tmpdir()`.
- **Repeatable Unit Test**: Not applicable: asserts the absence of side effects on the developer's real home directory and temp dir *after* a full run. A test inside that run cannot observe the state that follows it, and would in any case be running under the redirected `HOME` it is meant to be checking outside of.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-011: The skip has a scheduled owner in ROADMAP-005 Phase 2
- **Scenario**: Step 8's third checkbox, with the reason stated: *"a skipped test with no scheduled owner becomes permanent."* The skip reason inside the test file points forward to Phase 2; the roadmap must point back, or the instruction lives only in a string nobody greps.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const fs=require("fs");const r=fs.readFileSync("wiki/work/roadmaps/ROADMAP-005-ask-once-installer-preferences.md","utf8");const p2=r.slice(r.indexOf("## Phase 2"),r.indexOf("## Phase 3"));console.log("un-skip instruction in Phase 2:",/Un-skip/.test(p2));console.log("names the test file:",/bootstrap-prefs\.test\.js/.test(p2));console.log("names the test:",/schema -> scripts/.test(p2))'
  ```
- **Expected Result**: All three print `true`.
- **Repeatable Unit Test**: Blocked: this is the right invariant but the wrong place to pin it. ROADMAP-005 moves to `roadmaps/archive/` when it completes, so a test hard-coding its active path would break on a successful roadmap — the opposite of the intended signal. Re-home it in Phase 2 if the coupling is wanted after the un-skip.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-012: The whole suite is green
- **Scenario**: Final gate across all eight test files.
- **Steps**:
  1. Run the full suite
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `tests 209`, `pass 208`, `fail 0`, `skipped 1`. The single skip is the schema→scripts bijection; its body is complete, not stubbed (proven in UAT-EDGE-005), and it **does not block completion**.
- **Repeatable Unit Test**: Not applicable: this case *is* the test suite.
- [x] Pass <!-- 2026-08-06 -->

---

## Gaps

- **The skip is proven live today, but nothing re-proves it automatically.** UAT-EDGE-005 confirms the bijection body fails for the right reason, and it is the strongest evidence available — but it is a one-shot manual proof. If Phase 2 lands call sites and the un-skip is forgotten, the test silently stays skipped and this UAT is already archived. The roadmap sub-bullet (UAT-EDGE-011) is the only standing mitigation, and it is prose, not a gate.
- **Test *quality* is not asserted, only presence and failability.** UAT-EDGE-006 proves three tests can go red for one mutation; it does not establish that the other 61 would catch their own regressions. TASK-042 recorded mutation testing per section during implementation (14 schema mutations, `renameSync`→`copyFileSync`, dropped `mkdirSync`, key sorting, injected comments), but that evidence lives in the task record rather than in anything re-runnable.
- **`node --test` skip reporting is parsed by string matching.** UAT-EDGE-004 greps for the `﹣` glyph. A Node release that changes the reporter's symbols would break the check without anything being wrong with the suite. Node's version is pinned by the environment, not by the repo, so this is a real if low-probability fragility.
