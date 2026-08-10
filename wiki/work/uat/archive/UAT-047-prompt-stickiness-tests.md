---
id: UAT-047
title: "UAT: test/prompt-stickiness.test.js — sticky-prompt coverage and the bijection un-skip"
status: passed
task: TASK-047
created: 2026-08-06
updated: 2026-08-06
---

# UAT-047 — UAT: test/prompt-stickiness.test.js — sticky-prompt coverage and the bijection un-skip

implements::[[TASK-047]]

> **Source task**: [[TASK-047]]
> **Generated**: 2026-08-06

---

## Scope note

**The deliverable is a test file, so this UAT is meta-verification.** The risk in
a task like this is not a broken feature — it is a suite that *looks* like
coverage without being it. Every case below therefore targets that directly:
the bijection actually runs, its allowlist cannot be abused, the paired scan is
not passing on an empty set, the suite can be *seen* failing, and nothing it
touches escapes its scratch dirs.

That failure mode is not hypothetical here. Un-skipping the bijection cold
reported **all seventeen** non-dynamic keys unreferenced rather than the four the
roadmap predicted — not seventeen missing call sites, but an extractor that only
recognised the direct `bootstrap-prefs.js --get/--set` form while every Phase 2
call site goes through a `lib.sh` wrapper. The paired `scripts -> schema`
direction had been **passing on a genuinely empty found-set the whole time**.
UAT-INT-002 is the guard against that returning.

**Note on counts.** TASK-047's own Notes record 26 tests in
`test/prompt-stickiness.test.js` and a 245-test suite. Both have since grown:
UAT-043 through UAT-046 added 17 more tests to that file plus 3 elsewhere, and
this UAT adds 1. The Phase-1 skip remains gone throughout, which is the property
that matters and the one UAT-INT-003 now enforces permanently.

---

## Prerequisites

- [ ] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude`; `node`, `bash`, `git` on `PATH`
- [ ] Phase 2's call sites present (TASK-044/045/046 all `done`) — the bijection's hard half asserts against them
- [ ] `npm test` runnable

---

## Test Cases

### UAT-INT-001: the bijection runs unskipped, and its allowlist cannot be abused
- **Description**: `PHASE_3_PENDING` exists so four `consumer: "skill"` keys whose call sites land in Phase 3 do not fail Phase 2. It is guarded on three sides so it cannot become a permanent escape hatch: every entry must be a real non-dynamic schema key, must carry `consumer: "skill"`, and must be **genuinely still unreferenced** — so it empties itself when Phase 3 lands rather than rotting.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="schema -> scripts" test/bootstrap-prefs.test.js
  ```
- **Expected Result**: 1 test, 1 pass, **0 skipped** — the test runs rather than being skipped. Every `consumer: "installer"` non-dynamic key is asserted with no exemption, and `PHASE_3_PENDING` holds exactly `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema -> scripts: every non-dynamic schema key is referenced by at least one script or skill`). **Guard 2 confirmed to genuinely fire**: parking the installer key `mcp.braveSearch` in `PHASE_3_PENDING` failed with `its consumer is "installer", not "skill" — an installer key unreferenced by Phase 2 is a bug in Phase 2, not something to allowlist`. Restored and re-verified passing.
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-002: the paired `scripts -> schema` scan is not passing on an empty set
- **Description**: The vacuous-pass failure mode this whole section exists to prevent, and the one that actually bit during implementation. A scan that silently matches nothing reports success forever; the fix was teaching the extractor the six `lib.sh` wrapper call shapes, **not** adding an allowlist.
- **Steps**:
  1. Run the command below — it confirms the test pins a non-zero found count rather than merely asserting that whatever it found resolves.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs");
  const s=fs.readFileSync("test/bootstrap-prefs.test.js","utf8");
  const t=s.match(/test\(\s*.scripts -> schema[\s\S]*?\n\}\);/);
  if(!t){console.log("scripts -> schema test NOT FOUND");process.exit(1);}
  const hasNonZero=/found\.length\s*>\s*0/.test(t[0]);
  console.log("scripts -> schema test present : true");
  console.log("pins a non-zero found count    : "+hasNonZero);
  const m=t[0].match(/assert\.ok\(\s*found\.length[^\n]*/);
  console.log(m?("  -> "+m[0].trim()):"  (no found.length assertion line matched)");
  process.exit(hasNonZero?0:1);'
  ```
- **Expected Result**: `scripts -> schema test present : true`, `pins a non-zero found count : true`, and the matched line `assert.ok(` / `found.length > 0,`. Without that pin, the extractor could silently match nothing and the test would still pass.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (the `found.length > 0` assertion is itself the permanent guard; this case verifies the guard exists)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-003: no test anywhere in `test/` is skipped or marked todo
- **Description**: Phase 1 deliberately shipped one skipped test and TASK-047 un-skipped it. From that point the suite's skip count is 0, and **a skip reappearing is a regression, not a neutral outcome**. This needed enforcing because `node --test` reports `skipped N` in a trailer no gate reads, and a skipped test is indistinguishable from a passing one in every summary that matters.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="no test anywhere in test/ is skipped" test/bootstrap-prefs.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. The scan covers every `*.test.js` in `test/`, strips comments first (this file's own prose says "skip" repeatedly, and the bijection test narrates its former skip at length), and looks for `.skip()` calls plus skip/todo options in a test config object.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`suite: no test anywhere in test/ is skipped or marked todo`). Falsifiability confirmed by planting `test.skip(` in `test/npm-pack-contents.test.js`, which failed naming the offending file and form; the file was restored and verified byte-identical by SHA-256.
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-004: the two test populations stay on their own sides of the banner
- **Description**: `test/bootstrap-prefs.test.js`'s organising rule — nothing below the schema banner spawns the helper or makes scratch dirs. That separation is what makes the schema assertions trustworthy: the helper is deliberately generic, so a *wrong schema entry* breaks nothing a behavior test can observe. This UAT added a test below that banner, so the invariant is re-checked.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="two test populations" test/bootstrap-prefs.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail — the new skip-scan test reads files with `fs.readdirSync`/`fs.readFileSync` and neither spawns the helper nor creates a scratch dir, so it belongs below the banner.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: the two test populations stay on their own sides of the banner`, pre-existing from UAT-042)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-001: the suite can be SEEN failing — the stickiness read
- **Scenario**: A suite that cannot fail is decoration. Breaking `prefs_get` so it always answers `unset` must turn every remembered-answer claim red while the claims that do not depend on a stored answer's identity stay green.
- **Steps**:
  1. Record `sha256(lib.sh)`.
  2. Change `prefs_get`'s final `printf '%s\n' "$out"` to print `unset` — a single-line edit that shifts no line numbers, so the `lib.sh:387` citation pin is never at risk.
  3. Run `node --test test/prompt-stickiness.test.js`; restore; re-verify by hash.
- **Expected Result**: The remembered-answer tests go red — both `prompt_yn_sticky` remembered cases, both `ask` cases, both unrecognized-value cases, both `no tty still READS the store` cases, every `merge-gitignore.sh` e2e case, and the harness smoke test that seeds a pref and reads it back. The no-store/no-tty tests and the pure digit/name/default cases stay green. **Note the documented nuance**: the two `no tty still READS the store` tests are *by design* sensitive to `prefs_get`, so "non-interactive tests stay green" is not a clean binary — they correctly go red too.
- **Repeatable Unit Test**: Not applicable: a deliberate one-time mutation of a production file. Making it permanent would mean shipping a broken `prefs_get` behind a flag, which is worse than the manual check.
- [x] Pass <!-- 2026-08-06 -->
  - **Observed 2026-08-06**: 43 tests → **21 pass / 22 fail**, `lib.sh` line count unchanged at 657 so no citation pin moved. Red exactly as predicted: the seeded-pref harness smoke test, all four `prompt_yn_sticky` stored-value tests, all four `prompt_choice_sticky` stored-value tests, both `no tty still READS the store` tests (the documented nuance), `prompt_scope`'s sticky round trip, and every `merge-gitignore.sh` / `install-mcps.sh` / `sync-wiki-scaffold.sh` e2e case that depends on a stored answer. Green: the no-store/no-tty tests, both stored-`ask`-with-no-tty tests, the pure digit/name/default resolution tests, and the structural guards. Restored and verified byte-identical by SHA-256.

### UAT-EDGE-002: the suite can be SEEN failing — the non-interactive no-write rule
- **Scenario**: The load-bearing claim of the whole roadmap. Making the non-interactive branch record its auto-answer must turn the "records nothing" tests red — and only those.
- **Steps**:
  1. Record `sha256(lib.sh)`.
  2. In `prompt_yn_sticky`'s `if ! has_tty` block, append `; prefs_set "$key" "$selector" false` to the existing echo line (same two-line shape, no line-count change).
  3. Run `node --test test/prompt-stickiness.test.js`; restore; re-verify by hash.
- **Expected Result**: Exactly two tests go red — `prompt_yn_sticky: no tty and no stored answer — returns 1, ignores stdin, and records NOTHING in either layer` and `prompt_yn_sticky: a stored ask with no tty answers no, leaves the ask intact, and records NOTHING`. Everything else stays green, **including** both `prompt_choice_sticky` "records nothing" tests — that function has its own separate non-interactive branch, and the isolation is itself evidence the two functions' coverage does not cross-contaminate.
- **Repeatable Unit Test**: Not applicable: same reason as UAT-EDGE-001.
- [x] Pass <!-- 2026-08-06 -->
  - **Observed 2026-08-06**: 43 tests → **41 pass / 2 fail**, `lib.sh` line count unchanged at 657. Red: exactly the two predicted `prompt_yn_sticky` "records NOTHING" tests. Green: everything else, **including** both `prompt_choice_sticky` no-write tests — that function has its own separate non-interactive branch, so the isolation confirms the two functions' coverage does not cross-contaminate. Restored and verified byte-identical by SHA-256.

### UAT-INT-005: the full suite is green with zero skips
- **Description**: The headline acceptance gate. The Phase-1 skip is gone, so any remaining skip is unaccounted for.
- **Steps**:
  1. Run `npm test` and read the trailer counts.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && npm test
  ```
- **Expected Result**: `fail 0`, `skipped 0`, `todo 0`, `cancelled 0`. Test count is **264** — 263 after UAT-046 plus the 1 skip-guard this UAT added.
- **Repeatable Unit Test**: Not applicable: this case *is* the repeatable suite.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-003: a full suite run leaves no trace outside its scratch dirs
- **Scenario**: The hermeticity guarantee in the test file's own banner. These tests drive real shell scripts whose job is writing to `$HOME/.claude/` and to a project's `.gitignore` and `.git/info/exclude` — and this checkout has both. The risk is one-way: if a redirect failed, the damage is done before any assertion could notice, and none of the three files is in this repo's diff surface.
- **Steps**:
  1. Fingerprint the four artifacts and count `os.tmpdir()` entries **before** the `npm test` of UAT-INT-005.
  2. Re-measure after and compare.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs"),os=require("os"),crypto=require("crypto"),path=require("path");
  const before=JSON.parse(fs.readFileSync(process.env.HERMETIC_BEFORE,"utf8"));
  const rec={};
  for(const f of [".gitignore",".git/info/exclude"]){
    const p="/Users/davidtaylor/Repositories/bootstrap-claude/"+f;
    rec[f]=fs.existsSync(p)?crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0,16):"absent";
  }
  const st=path.join(os.homedir(),".claude","settings.json");
  rec["~/.claude/settings.json"]=fs.existsSync(st)?(()=>{const s=fs.statSync(st);return s.size+"/"+s.mtimeMs;})():"absent";
  const pj=path.join(os.homedir(),".claude","bootstrap-prefs.json");
  rec["~/.claude/bootstrap-prefs.json"]=fs.existsSync(pj)?"PRESENT":"absent";
  // SUITE-OWNED scratch dirs only — see the note below on why a raw count is wrong.
  const PREFIXES=["prompt-sticky-","prefs-","bootstrap-prefs-","install-global-","run-project-sync-","settings-"];
  rec["suite scratch dirs"]=fs.readdirSync(os.tmpdir()).filter(x=>PREFIXES.some(p=>x.startsWith(p))).length;
  let bad=0;
  for(const k of Object.keys(rec)){
    if(k==="suite scratch dirs"){
      const d=rec[k]-before[k];
      console.log((d<=0?"OK   ":"LEAK ")+k+": "+before[k]+" -> "+rec[k]+" (delta "+d+")");
      if(d>0)bad++;
      continue;
    }
    const same=String(rec[k])===String(before[k]);
    console.log((same?"OK   ":"CHANGED ")+k+": "+before[k]+(same?"":" -> "+rec[k]));
    if(!same)bad++;
  }
  console.log(bad===0?"NOTHING ESCAPED THE SCRATCH DIRS":"HERMETICITY FAILURES: "+bad);
  process.exit(bad===0?0:1);'
  ```
- **Expected Result**: `.gitignore` and `.git/info/exclude` byte-identical; `~/.claude/settings.json` identical in size and mtime; `~/.claude/bootstrap-prefs.json` **absent before and after** — the real store never created; and the suite-owned scratch-dir delta is `0`.

  > **Why the scan is prefix-filtered rather than a raw `os.tmpdir()` count.** A raw count measures a directory shared with the whole OS. Measured that way during this run it moved `410 → 412`, and the two new entries were `uv-*.lock`, `xcrun_db` and `TemporaryItems` — nothing to do with this suite. (TASK-047's own Step 9 hit the same noise from the other side, recording a delta of **−2**.) Filtering to the suite's own `mkdtemp` prefixes makes the claim falsifiable: it counts exactly the dirs this suite creates and is unaffected by unrelated churn. Note that 3 such entries exist and persist across runs — `bootstrap-prefs-layers.*` and `bootstrap-prefs-smoke.*`, left by the **shell** smoke scripts of TASK-041's implementation session, already identified as pre-existing in UAT-042. The delta being 0 is the claim, not the absolute.
- **Repeatable Unit Test**: Blocked: measuring "before and after a full suite run" cannot be done from inside that same run. The per-test half is already enforced — every scratch dir is `mkdtempSync` and removed in a `finally`, `withScratchEnv` refuses to run unless a read-only probe proves the redirect landed, and the `merge-gitignore.sh` cases hash this repo's two files around each body.
- [x] Pass <!-- 2026-08-06 -->
  - **Observed 2026-08-06** across a full 264-test run: `.gitignore` `d2be0b6b9f5b4e67` unchanged · `.git/info/exclude` `014438e14d5489c1` unchanged · `~/.claude/settings.json` `8772 bytes / mtime 1785789176075.6123` unchanged · `~/.claude/bootstrap-prefs.json` **absent before and after** · suite-owned scratch dirs `3 → 3` (delta **0**). The probe was corrected mid-run from a raw `os.tmpdir()` count to a prefix-filtered one after the raw count moved `410 → 412` on unrelated OS churn — a measurement bug, not a leak, and the same one UAT-042 resolved the same way.

---

## Notes

**Unit test created by this UAT** — 1, in `test/bootstrap-prefs.test.js`:
`suite: no test anywhere in test/ is skipped or marked todo`.

TASK-047's Step 9 asserts "zero skips" as a one-time manual check. Nothing made
it permanent, yet it is exactly the property most likely to erode: a test skipped
"temporarily" while chasing an unrelated failure reads as a passing one in every
summary, and the skip count lives in a trailer no gate reads. The guard forces
any future skip to be accompanied by a deliberate edit to this test, so the
reason gets written down and reviewed instead of slipping in as a one-word
change.

One implementation wrinkle worth recording: the test scans its own directory, so
its offender labels deliberately avoid spelling the option forms literally — a
label reading `{ skip: … }` matched its own pattern and failed the test on its
own description.

**Both allowlist and skip guards were proven falsifiable**, and every mutated
file was restored and verified byte-identical by SHA-256 rather than by
`git diff` — several of these files are untracked in this checkout.
