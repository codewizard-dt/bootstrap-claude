---
id: UAT-051
title: "UAT: Pin bootstrap-prefs.js and bootstrap-prefs-schema.json into test/npm-pack-contents.test.js"
status: passed
task: TASK-051
created: 2026-08-07
updated: 2026-08-07
---

# UAT-051 — UAT: Pin bootstrap-prefs.js and bootstrap-prefs-schema.json into test/npm-pack-contents.test.js

implements::[[TASK-051]]

> **Source task**: [[TASK-051]]
> **Generated**: 2026-08-07

---

## Scope

TASK-051 added two strings to an existing array. Verifying that they are *there*
is nearly worthless — the task says so itself, and names the real deliverable:

> **step 3's falsifiability check is the real deliverable**, not the assertion
> itself.

Both files already pack today, incidentally, via `package.json`'s blanket `lib/`
glob. So a badly written pin would pass right now and keep passing under the
exact regression it claims to guard (someone narrowing `files`). UAT-INT-002 and
UAT-INT-003 therefore **re-prove falsifiability live**: each negates one path in
`package.json`, runs the pin, and requires it to fail *naming that path* — then
restores `package.json` and verifies it byte-identical by SHA-256.

Both are proven **independently**, not just the first in the list, because a pin
that only fails on its first element is the specific failure this task warned
about.

**Mutation safety.** Each probe does mutate → run → restore inside a single
`try/finally`, so `package.json` is restored even if the test run throws, and the
hash is asserted *after* restoration. A stray `!lib/...` left in `files` is
precisely the regression this test exists to catch and would ship silently.

**No unit tests are promoted, deliberately.** TASK-051 step 4 requires the suite
total to go up by **0** — the two paths join an existing test's loop and no new
`test()` block is added. Promoting anything here would violate the task's own
acceptance criterion, and the pin *is* already the repeatable test.

---

## Prerequisites

- [ ] `node` and `npm` on `PATH`; all commands run from the repo root
- [ ] `npm pack --dry-run` is permitted; **`npm publish` is not** and appears
      nowhere in this file
- [ ] `package.json` starts byte-identical to
      `d7fa2645dc4f4c424c0cde53425905759ae09e313eb0c6896e72324ca80bc2f8`
      (the hash TASK-051 recorded after its own restore)

---

## Test Cases

### UAT-EDGE-001: the pin's shape — two paths added to the existing loop, nothing else
- **Scenario**: The task constrained *how* the pin is added, not just that it is:
  extend the existing required-paths loop rather than add a second test, keep the
  suite zero-dependency, keep one `npm pack` per suite run, and generalise the
  test name so it no longer claims to be about hooks-wiring only. Each of those
  is silently violable — a second `test()` block or a second `npm pack` would
  pass every assertion while roughly doubling the file's runtime.
- **Steps**: Assert both paths are present, the test is renamed, the provenance
  comment is there, exactly three `test()` blocks exist, only `node:` builtins are
  imported, and `npm pack` is invoked exactly once.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert");const t=fs.readFileSync("test/npm-pack-contents.test.js","utf8");for(const p of ["lib/scripts/bootstrap-prefs.js","lib/scripts/templates/bootstrap-prefs-schema.json"]){a.ok(t.includes("\x27"+p+"\x27"),"required path not pinned: "+p);}a.ok(t.includes("tarball ships the runtime artifacts a consumer install depends on"),"test was not renamed to cover both subsystems");a.ok(!t.includes("hooks-wiring artifacts alongside the deny template"),"the old hooks-only test name survives");a.ok(/install-global\.sh step 6/.test(t),"provenance comment for the two new paths is missing");const tests=(t.match(/^test\(/gm)||[]).length;a.strictEqual(tests,3,"expected 3 test() blocks, found "+tests);const packs=(t.match(/npm.{0,4}pack/g)||[]).length;a.ok(packs>=1,"no npm pack invocation found");a.strictEqual((t.match(/spawnSync\(/g)||[]).length,1,"more than one spawnSync — the single module-level pack was duplicated");const imports=t.match(/require\((\x27|")[^\x27"]+(\x27|")\)/g)||[];for(const i of imports){a.ok(i.includes("node:"),"non-builtin import introduced: "+i);}console.log("PASS pin shape: 2 paths, 3 tests, 1 pack, "+imports.length+" builtin imports");'
  ```
- **Expected Result**: exits 0, prints
  `PASS pin shape: 2 paths, 3 tests, 1 pack, 4 builtin imports`.
- **Repeatable Unit Test**: Not applicable: asserts the shape of a test file;
  TASK-051 step 4 requires the suite total to rise by 0, so a promoted test would
  break the task's own acceptance criterion
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS pin shape: 2 paths, 3 tests, 1 pack, 4 builtin imports -->


### UAT-EDGE-002: `package.json` is untouched and carries no `lib/` negation
- **Scenario**: TASK-051 mutated `package.json` twice during its own
  falsifiability proof and restored it. A leftover `!lib/...` in `files` is
  exactly the regression the pin exists to catch, and it would ship silently —
  the repo's own tests would stay green because the sources are all still on
  disk. Asserts the recorded hash *and* the semantic property, since a
  hash-only check would not survive a legitimate unrelated edit.
- **Steps**: Compare the SHA-256 against the recorded value, then assert `files`
  contains the blanket `lib/` and that every negation is confined to `raw/`.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert"),c=require("crypto");const raw=fs.readFileSync("package.json","utf8");const h=c.createHash("sha256").update(raw).digest("hex");a.strictEqual(h,"d7fa2645dc4f4c424c0cde53425905759ae09e313eb0c6896e72324ca80bc2f8","package.json is not byte-identical to the hash TASK-051 recorded");const files=JSON.parse(raw).files;a.ok(files.includes("lib/"),"the blanket lib/ glob is gone");const negs=files.filter((f)=>f.startsWith("!"));for(const n of negs){a.ok(n.startsWith("!raw/"),"a negation outside raw/ is present: "+n);}console.log("PASS package.json intact; negations confined to raw/: "+negs.join(" "));'
  ```
- **Expected Result**: exits 0, prints
  `PASS package.json intact; negations confined to raw/: !raw/research/ !raw/companies/ !raw/*.pdf`.
- **Repeatable Unit Test**: Not applicable: the recorded hash is a point-in-time
  fact about this task's restore, not a durable invariant — a legitimate version
  bump changes it
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS package.json intact; negations confined to raw/: !raw/research/ !raw/companies/ !raw/*.pdf -->


### UAT-INT-001: the pin passes and the tarball is still 191 files with both paths packed
- **Scenario**: The task claims the pin adds nothing to and removes nothing from
  the tarball (191 files at `b85cbe9`). A change in that count would mean this
  "test-only" task altered what ships.
- **Steps**: Run the pack test file, then confirm the file count and the presence
  of both prefs paths from a single `npm pack --dry-run --json`.
- **Command**:
  ```bash
  npm pack --dry-run --json
  ```
- **Expected Result**: valid JSON; `[0].files` has length **191**, and includes
  both `lib/scripts/bootstrap-prefs.js` and
  `lib/scripts/templates/bootstrap-prefs-schema.json`. Nothing is published.
- **Repeatable Unit Test**: Created: `test/npm-pack-contents.test.js` (the
  presence half; the 191 count is deliberately not pinned — it changes on every
  legitimate file addition and would be a maintenance tax, not a guard)
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS tarball 191 files; both prefs paths packed. npm pack --dry-run only; nothing published. -->


### UAT-INT-002: falsifiability A — excluding the helper makes the pin fail, naming it
- **Scenario**: **The task's stated deliverable.** The helper packs only
  incidentally, through the blanket `lib/` glob; nothing names it. If the pin
  cannot fail when it is excluded, it is a tautology that costs runtime and buys
  nothing. Mutates `files` to add `"!lib/scripts/bootstrap-prefs.js"`, runs the
  pin, and requires a non-zero exit whose output names that exact path.
- **Steps**:
  1. Snapshot `package.json` and its SHA-256.
  2. Inject the negation immediately after `"lib/",`.
  3. Run the pack test file and capture status + output.
  4. **Restore in a `finally`**, then assert the hash matches and the run failed
     naming the path.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),cp=require("child_process"),cr=require("crypto"),a=require("assert");const target=process.argv[1];const P="package.json";const orig=fs.readFileSync(P,"utf8");const h=(s)=>cr.createHash("sha256").update(s).digest("hex");const before=h(orig);let res;try{const mutated=orig.replace(/^(\s*)"lib\/",$/m,"$1\"lib/\",\n$1\"!"+target+"\",");a.notStrictEqual(mutated,orig,"failed to inject the negation");fs.writeFileSync(P,mutated);res=cp.spawnSync(process.execPath,["--test","test/npm-pack-contents.test.js"],{encoding:"utf8"});}finally{fs.writeFileSync(P,orig);}a.strictEqual(h(fs.readFileSync(P,"utf8")),before,"package.json was NOT restored byte-identical");a.notStrictEqual(res.status,0,"the pin did NOT fail when "+target+" was excluded — the assertion is a tautology");a.ok((res.stdout+res.stderr).includes("tarball is missing "+target),"the failure did not name the missing path");console.log("PASS falsifiable: "+target+" — restored, sha256 "+before);' lib/scripts/bootstrap-prefs.js
  ```
- **Expected Result**: exits 0, prints
  `PASS falsifiable: lib/scripts/bootstrap-prefs.js — restored, sha256 d7fa2645…`.
  The inner run must have exited non-zero with
  `tarball is missing lib/scripts/bootstrap-prefs.js`.
- **Repeatable Unit Test**: Not applicable: a test that rewrites `package.json`
  mid-suite is hostile to parallel runs and to any concurrent agent; this is a
  deliberate one-shot proof
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS falsifiable: lib/scripts/bootstrap-prefs.js — inner run exited non-zero naming the path; restored, sha256 d7fa2645dc4f4c424c0cde53425905759ae09e313eb0c6896e72324ca80bc2f8 -->


### UAT-INT-003: falsifiability B — the schema path fails independently
- **Scenario**: The task requires **both** paths to be independently falsifiable,
  "not just the first one in the list". A loop that short-circuits, or a pin whose
  second entry was mistyped, passes UAT-INT-002 and fails only here — which is
  precisely why verifying one path is not enough.
- **Steps**: Identical to UAT-INT-002 with the schema path, run **after**
  `package.json` has been restored, so the two probes are genuinely independent
  rather than cumulative.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),cp=require("child_process"),cr=require("crypto"),a=require("assert");const target=process.argv[1];const P="package.json";const orig=fs.readFileSync(P,"utf8");const h=(s)=>cr.createHash("sha256").update(s).digest("hex");const before=h(orig);let res;try{const mutated=orig.replace(/^(\s*)"lib\/",$/m,"$1\"lib/\",\n$1\"!"+target+"\",");a.notStrictEqual(mutated,orig,"failed to inject the negation");fs.writeFileSync(P,mutated);res=cp.spawnSync(process.execPath,["--test","test/npm-pack-contents.test.js"],{encoding:"utf8"});}finally{fs.writeFileSync(P,orig);}a.strictEqual(h(fs.readFileSync(P,"utf8")),before,"package.json was NOT restored byte-identical");a.notStrictEqual(res.status,0,"the pin did NOT fail when "+target+" was excluded — the assertion is a tautology");a.ok((res.stdout+res.stderr).includes("tarball is missing "+target),"the failure did not name the missing path");console.log("PASS falsifiable: "+target+" — restored, sha256 "+before);' lib/scripts/templates/bootstrap-prefs-schema.json
  ```
- **Expected Result**: exits 0, prints
  `PASS falsifiable: lib/scripts/templates/bootstrap-prefs-schema.json — restored,
  sha256 d7fa2645…`. The inner run must have exited non-zero with
  `tarball is missing lib/scripts/templates/bootstrap-prefs-schema.json`.
- **Repeatable Unit Test**: Not applicable: same reason as UAT-INT-002
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS falsifiable: lib/scripts/templates/bootstrap-prefs-schema.json — independently proven from a restored package.json; inner run exited non-zero naming the path; restored, sha256 d7fa2645… -->


### UAT-INT-004: the full suite is green with zero skipped, and `package.json` survived both probes
- **Scenario**: Final state check after two deliberate mutations. Confirms the
  suite is green and — the point of running it *last* — that neither probe left a
  negation behind.
- **Steps**: Run the whole suite from the repo root.
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `# tests 295`, `# pass 295`, `# fail 0`, `# skipped 0`,
  exit 0. (295 = the 289 baseline plus the 6 tests UAT-050 promoted; TASK-051
  itself adds 0.)
- **Repeatable Unit Test**: Not applicable: this is the suite runner itself
- [x] Pass <!-- 2026-08-07 -->
  <!-- tests 295 / pass 295 / fail 0 / skipped 0 / todo 0, exit 0. package.json survived both probes: git status clean, sha256 d7fa2645… unchanged. -->


---

## Gaps

- **The tarball's 191-file count is verified here but deliberately not pinned in
  the suite.** It changes on every legitimate file addition, so a pinned count
  would fail constantly for the right reasons and train people to update it
  without looking — the opposite of a guard. The presence assertions are the
  durable half.
- **Incidental, carried over from TASK-051 step 1 and still unfixed:**
  `test/npm-pack-contents.test.js:10` cites commit `99fbba` where the real SHA is
  `99f3bba`. Cosmetic, in a comment, and out of this task's one-file scope — noted
  so it is not rediscovered a third time.
