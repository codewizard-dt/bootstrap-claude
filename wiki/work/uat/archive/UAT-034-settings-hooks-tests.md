---
id: UAT-034
title: "UAT: Add test/settings-hooks.test.js — template invariants and merge behavior coverage"
status: passed
task: TASK-034
created: 2026-07-31
updated: 2026-07-31
---

# UAT-034 — UAT: Add `test/settings-hooks.test.js` — template invariants and merge behavior coverage

implements::[[TASK-034]]

> **Source task**: [[TASK-034]]
> **Generated**: 2026-07-31

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`; every command below assumes `cwd` is the repo root.
- [ ] `node` (v18+; generated against v26.0.0) on `PATH`, `npm` available.
- [ ] Working tree contains no uncommitted edits to `lib/scripts/templates/settings-hooks.json` or `lib/scripts/merge-settings-hooks.js` you care about — the two `UAT-EDGE` vacuity probes temporarily mutate these tracked files in place and restore the exact original bytes in a `finally` block (each probe asserts byte-identical restoration and then re-runs the suite green before reporting `ok`).
- [ ] **Safety invariant**: nothing here writes the real `~/.claude/settings.json` — the suite under test always passes explicit `--target`/`--source` scratch paths, and UAT-EDGE-003 proves it by `stat` (size + mtime only; contents never read).

**Why this UAT is meta-verification**: TASK-034's deliverable *is* a test suite. So the tests below do not re-test the merge script (UAT-033 owns that); they verify the suite itself — it runs green with exact counts, it is picked up by the `npm test` glob, it covers the plan's required case list (including the 18-hook bijection and the two deferred-push fix cases), and — via temporarily-broken fixtures — that its assertions are not vacuous (they actually fail when the thing they claim to pin is broken).

---

## Test Cases

### UAT-CLI-001: full suite green with exact totals; glob pickup proven by arithmetic

`npm test` (`node --test 'test/*.test.js'`) must pass with **exactly 140 tests / 140 pass / 0 fail**, and the delta between "all suites" and "all suites except `settings-hooks`" must be exactly the 21 tests this file contributes — proving the glob picked the new file up with no `package.json` change, not merely that some tests ran.

> **Amended 2026-07-31**: originally pinned 134 = 113 + 21; `test/install-global.test.js` (6 tests, UAT-035 generation) landed after this UAT was written, making the true totals 140 = 119 + 21. Expectation updated to match; the case's real assertion (settings-hooks contributes exactly 21 green tests via glob pickup) is unchanged.

- **Scenario**: Run the full suite via `npm test`, then the other five test files explicitly, then `settings-hooks` alone; assert 119 + 21 = 140.
- **Repeatable Unit Test**: Not applicable: this case *is* the unit-test run plus meta-arithmetic about the runner's file discovery; embedding a test-that-runs-the-whole-suite inside the suite would recurse.
- **Steps**:
  1. ```bash
     node -e '
     var cp=require("child_process"),assert=require("assert");
     var full=cp.spawnSync("npm",["test"],{encoding:"utf8"});
     assert.strictEqual(full.status,0,"npm test must exit 0, stderr: "+full.stderr);
     var out=full.stdout+full.stderr;
     function n(label){var m=out.match(new RegExp(label+" (\\d+)"));return m?Number(m[1]):NaN;}
     assert.strictEqual(n("tests"),140,"expected exactly 140 total tests, got "+n("tests"));
     assert.strictEqual(n("pass"),140,"expected exactly 140 passing, got "+n("pass"));
     assert.strictEqual(n("fail"),0,"expected 0 failures, got "+n("fail"));
     function tap(args){var r=cp.spawnSync("node",["--test","--test-reporter=tap"].concat(args),{encoding:"utf8"});function c(l){var m=r.stdout.match(new RegExp("# "+l+" (\\d+)"));return m?Number(m[1]):NaN;}return{status:r.status,tests:c("tests"),pass:c("pass"),fail:c("fail")};}
     var others=tap(["test/command-class-hooks.test.js","test/file-suggestion.test.js","test/install-global.test.js","test/run-project-sync.test.js","test/settings-deny.test.js"]);
     var hooks=tap(["test/settings-hooks.test.js"]);
     assert.strictEqual(others.fail,0,"sibling suites must be green");
     assert.strictEqual(hooks.tests,21,"settings-hooks must contribute exactly 21 tests, got "+hooks.tests);
     assert.strictEqual(hooks.fail,0,"settings-hooks must be green in isolation");
     assert.strictEqual(others.tests+hooks.tests,140,"glob-pickup arithmetic broken: "+others.tests+" + "+hooks.tests+" != 140");
     console.log("ok: npm test 140/140/0; glob picked up settings-hooks (119 others + 21 hooks = 140)");
     '
     ```
- **Expected Result**: Prints `ok: npm test 140/140/0; glob picked up settings-hooks (119 others + 21 hooks = 140)`. Exit 0; totals exactly 140/140/0; the five sibling files alone total 119, `settings-hooks` alone totals 21.
- [x] Pass <!-- 2026-07-31 --> <!-- amended 2026-07-31: prior FAIL was stale arithmetic (suite grew 134→140 when test/install-global.test.js landed post-generation); expectation corrected, verdict cleared for re-run -->

---

### UAT-CLI-002: exact per-file counts and coverage of the plan's required case list, by test name

Isolated run of `test/settings-hooks.test.js` must report **exactly 21 tests / 21 pass / 0 fail / 0 skipped / 0 todo** — 7 template invariants + 14 merge-behavior cases (the plan's 12 merge cases plus the two post-UAT-033 deferred-push fix cases). Every required case from the task's step list must be present **by name** in the TAP output — count assertions per case, not just green lines.

- **Scenario**: Run the file alone under the TAP reporter; assert summary counters exactly and match all 21 required name fragments.
- **Repeatable Unit Test**: Not applicable: asserting a test file's own test names/counts from inside that file would be circular; the 21 tests themselves are the repeatable artifact.
- **Steps**:
  1. ```bash
     node -e '
     var cp=require("child_process"),assert=require("assert");
     var r=cp.spawnSync("node",["--test","--test-reporter=tap","test/settings-hooks.test.js"],{encoding:"utf8"});
     assert.strictEqual(r.status,0,"suite must be green, stderr: "+r.stderr);
     function c(l){return Number(r.stdout.match(new RegExp("# "+l+" (\\d+)"))[1]);}
     assert.strictEqual(c("tests"),21);assert.strictEqual(c("pass"),21);assert.strictEqual(c("fail"),0);assert.strictEqual(c("skipped"),0);assert.strictEqual(c("todo"),0);
     var names=r.stdout.split("\n").filter(function(l){return /^ok \d+ - /.test(l);}).map(function(l){return l.replace(/^ok \d+ - /,"");}).join("\n");
     var required=[
      "template is valid JSON and a plain object",
      "ships exactly the 4 event keys",
      "every command is exactly",
      "bijection: template commands",
      "env-content-read-guard keeps its own triple-matcher block",
      "claude-settings-guard matcher is exactly",
      "mv-absolute-path-block keeps its if",
      "merge creates a valid settings file when the target does not exist",
      "merge preserves existing keys and tab indentation",
      "merge is idempotent",
      "drifted matcher on a pure-owned block is rewritten in place",
      "drifted owned entry is replaced in place at the same array position",
      "mixed block: user entry and its position untouched",
      "relocated repo hook in a mixed block",
      "foreign blocks and non-shipped events survive",
      "a new hook shipped in the template is appended",
      "compound run: fully-relocated block leaves no empty placeholder",
      "a pre-existing user empty block is not pruned",
      "merge leaves a malformed JSON target untouched",
      "merge skips when hooks is not an object",
      "three-writer install order"
     ];
     var missing=required.filter(function(f){return names.indexOf(f)===-1;});
     assert.deepStrictEqual(missing,[],"required cases missing from the suite: "+missing.join(" | "));
     assert.strictEqual(required.length,21);
     console.log("ok: 21/21 green, every required case from the plan list present by name");
     '
     ```
- **Expected Result**: Prints `ok: 21/21 green, every required case from the plan list present by name`. All five TAP counters exact; all 21 required fragments (7 invariants, 12 plan merge cases, 2 deferred-push cases) matched.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-CLI-003: independent recheck of the 18-hook bijection claim

The suite's bijection test is only as good as its premise. Recompute the invariant here from scratch — without reusing the suite's helpers: exactly **18** top-level `.js` files under `lib/hooks/`, exactly **18** distinct `node ~/.claude/hooks/<name>.js` basenames wired across the template's four events, and the two sorted sets identical.

- **Scenario**: Enumerate `lib/hooks/*.js` (top level only) and every `command` in `lib/scripts/templates/settings-hooks.json`; compare as sets with exact cardinality.
- **Repeatable Unit Test**: Not applicable: `test/settings-hooks.test.js` already carries this exact assertion permanently (the bijection test); this case exists to verify that test against an independent computation, which by definition must live outside the suite.
- **Steps**:
  1. ```bash
     node -e '
     var fs=require("fs"),assert=require("assert");
     var files=fs.readdirSync("lib/hooks",{withFileTypes:true}).filter(function(d){return d.isFile()&&d.name.endsWith(".js");}).map(function(d){return d.name.replace(/\.js$/,"");}).sort();
     assert.strictEqual(files.length,18,"expected exactly 18 top-level hook files, got "+files.length+": "+files.join(", "));
     var tpl=JSON.parse(fs.readFileSync("lib/scripts/templates/settings-hooks.json","utf8"));
     var wired={};
     Object.keys(tpl).forEach(function(ev){tpl[ev].forEach(function(b){b.hooks.forEach(function(h){var m=/^node ~\/\.claude\/hooks\/([\w-]+)\.js$/.exec(h.command);if(m){wired[m[1]]=true;}});});});
     var wiredList=Object.keys(wired).sort();
     assert.strictEqual(wiredList.length,18,"expected exactly 18 wired hook basenames, got "+wiredList.length);
     assert.deepStrictEqual(wiredList,files,"wired set and file set differ");
     console.log("ok: independent recheck — 18 hook files, 18 wired commands, sets identical");
     '
     ```
- **Expected Result**: Prints `ok: independent recheck — 18 hook files, 18 wired commands, sets identical`. Both counts are exactly 18 and the sorted lists deep-equal.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-EDGE-001: invariant tests are not vacuous — three targeted breaks produce exactly three targeted failures

Prove the template-invariant tests actually detect what they claim by breaking three independent fixtures at once — a stray fifth event key in the template, the `claude-settings-guard` matcher reordered, and a ghost `.js` file dropped into `lib/hooks/` — and asserting the suite fails **exactly** the three corresponding tests (event-key set, bijection, matcher verbatim) while the other 18 stay green. Everything is restored in `finally`, restoration is asserted byte-identical, and the suite is re-run green before `ok` prints.

- **Scenario**: Mutate `lib/scripts/templates/settings-hooks.json` (stray `UserPromptSubmitX: []` event + matcher reorder) and create `lib/hooks/zz-uat034-ghost.js`; run the suite; assert the exact failure set; restore; re-run green.
- **Repeatable Unit Test**: Not applicable: a mutation probe that rewrites tracked repo fixtures cannot live inside the hermetic unit suite it is probing; it is deliberately kept as a self-restoring UAT command.
- **Steps**:
  1. ```bash
     node -e '
     var fs=require("fs"),cp=require("child_process"),assert=require("assert");
     var TPL="lib/scripts/templates/settings-hooks.json";
     var GHOST="lib/hooks/zz-uat034-ghost.js";
     var orig=fs.readFileSync(TPL,"utf8");
     try {
       var t=JSON.parse(orig);
       t.UserPromptSubmitX=[];
       var blocks=t.PreToolUse.filter(function(b){return b.matcher==="Edit|Write|NotebookEdit|MultiEdit";});
       assert.strictEqual(blocks.length,1,"precondition: claude-settings-guard block present");
       blocks[0].matcher="Write|Edit|NotebookEdit|MultiEdit";
       fs.writeFileSync(TPL,JSON.stringify(t,null,2)+"\n");
       fs.writeFileSync(GHOST,"// UAT-034 vacuity probe - deleted by the same command\n");
       var r=cp.spawnSync("node",["--test","--test-reporter=tap","test/settings-hooks.test.js"],{encoding:"utf8"});
       assert.strictEqual(r.status,1,"broken fixtures must make the suite exit non-zero");
       var lines=r.stdout.split("\n");
       var failed=lines.filter(function(l){return /^not ok \d+ - /.test(l);}).map(function(l){return l.replace(/^not ok \d+ - /,"");});
       var passed=lines.filter(function(l){return /^ok \d+ - /.test(l);}).length;
       assert.strictEqual(failed.length,3,"exactly 3 targeted failures expected, got "+failed.length+": "+failed.join(" | "));
       assert.strictEqual(passed,18,"the other 18 tests must stay green, got "+passed);
       assert.ok(failed.join("\n").indexOf("ships exactly the 4 event keys")!==-1,"event-key test did not catch the stray event");
       assert.ok(failed.join("\n").indexOf("bijection: template commands")!==-1,"bijection test did not catch the ghost hook file");
       assert.ok(failed.join("\n").indexOf("claude-settings-guard matcher is exactly")!==-1,"matcher test did not catch the reorder");
     } finally {
       fs.writeFileSync(TPL,orig);
       try{fs.unlinkSync(GHOST);}catch(e){}
     }
     assert.strictEqual(fs.readFileSync(TPL,"utf8"),orig,"template must be restored byte-identical");
     assert.ok(!fs.existsSync(GHOST),"ghost hook file must be removed");
     var again=cp.spawnSync("node",["--test","test/settings-hooks.test.js"],{encoding:"utf8"});
     assert.strictEqual(again.status,0,"suite must be green again after restore");
     console.log("ok: 3 targeted breaks -> exactly the 3 matching invariant tests failed (18 green); fixtures restored byte-identical; suite green again");
     '
     ```
- **Expected Result**: Prints `ok: 3 targeted breaks -> exactly the 3 matching invariant tests failed (18 green); fixtures restored byte-identical; suite green again`. Failure set is exactly {event-key set, bijection, claude-settings-guard matcher}; template restored byte-for-byte; ghost file gone; post-restore run exits 0.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-EDGE-002: merge-behavior tests are not vacuous — a no-op merge script fails all 14, and only those 14

Prove the 13 planned merge cases plus the extra deferred-push case actually exercise the script: temporarily replace `lib/scripts/merge-settings-hooks.js` with a stub that exits 0 doing nothing (the most dangerous silent failure — right exit code, no output, no writes) and assert **exactly 14 tests fail and exactly 7 pass** — every merge-behavior case detects the dead script, and no template invariant depends on it. Restore in `finally`, assert byte-identical, re-run green.

- **Scenario**: Overwrite the merge script with `process.exit(0);`, run the suite, assert the 14/7 split, restore, re-run green.
- **Repeatable Unit Test**: Not applicable: same reason as UAT-EDGE-001 — a probe that stubs out a tracked script under test cannot be a hermetic unit test inside the suite being probed.
- **Steps**:
  1. ```bash
     node -e '
     var fs=require("fs"),cp=require("child_process"),assert=require("assert");
     var MERGE="lib/scripts/merge-settings-hooks.js";
     var orig=fs.readFileSync(MERGE,"utf8");
     try {
       fs.writeFileSync(MERGE,"process.exit(0);\n");
       var r=cp.spawnSync("node",["--test","--test-reporter=tap","test/settings-hooks.test.js"],{encoding:"utf8"});
       assert.strictEqual(r.status,1,"stubbed merge script must make the suite exit non-zero");
       var lines=r.stdout.split("\n");
       var failed=lines.filter(function(l){return /^not ok \d+ - /.test(l);}).map(function(l){return l.replace(/^not ok \d+ - /,"");});
       var passed=lines.filter(function(l){return /^ok \d+ - /.test(l);}).length;
       assert.strictEqual(failed.length,14,"all 14 merge-behavior tests must fail against a no-op script, got "+failed.length+": "+failed.join(" | "));
       assert.strictEqual(passed,7,"exactly the 7 template invariants must still pass, got "+passed);
       assert.ok(failed.join("\n").indexOf("compound run: fully-relocated block leaves no empty placeholder")!==-1,"deferred-push compound case must detect the dead script");
       assert.ok(failed.join("\n").indexOf("a pre-existing user empty block is not pruned")!==-1,"deferred-push user-empty-block case must detect the dead script");
       assert.ok(failed.join("\n").indexOf("three-writer install order")!==-1,"three-writer case must detect the dead script");
     } finally {
       fs.writeFileSync(MERGE,orig);
     }
     assert.strictEqual(fs.readFileSync(MERGE,"utf8"),orig,"merge script must be restored byte-identical");
     var again=cp.spawnSync("node",["--test","test/settings-hooks.test.js"],{encoding:"utf8"});
     assert.strictEqual(again.status,0,"suite must be green again after restore");
     console.log("ok: no-op stub -> exactly the 14 merge cases failed, 7 invariants passed; script restored byte-identical; suite green again");
     '
     ```
- **Expected Result**: Prints `ok: no-op stub -> exactly the 14 merge cases failed, 7 invariants passed; script restored byte-identical; suite green again`. Failure count is exactly 14 (including both deferred-push fix cases and the three-writer sequence), pass count exactly 7; script restored; post-restore run exits 0.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-EDGE-003: safety — the real `~/.claude/settings.json` is stat-identical across a full suite run

The task's safety invariant ("the real `~/.claude/settings.json` is never read or written") must hold at runtime, not just by code inspection. Snapshot the real file's `stat` (existence, size, mtime — contents deliberately never read), run the entire `npm test` suite, and assert the snapshot is unchanged.

- **Scenario**: `fs.statSync` the real settings file before and after `npm test`; deep-equal the two snapshots (an absent file must remain absent).
- **Repeatable Unit Test**: Not applicable: depends on the operator's real `$HOME` state, which a hermetic unit test must not touch; kept as a UAT-only runtime check.
- **Steps**:
  1. ```bash
     node -e '
     var fs=require("fs"),os=require("os"),path=require("path"),cp=require("child_process"),assert=require("assert");
     var real=path.join(os.homedir(),".claude","settings.json");
     function snap(){try{var s=fs.statSync(real);return{exists:true,size:s.size,mtimeMs:s.mtimeMs};}catch(e){return{exists:false};}}
     var before=snap();
     var r=cp.spawnSync("npm",["test"],{encoding:"utf8"});
     assert.strictEqual(r.status,0,"npm test must pass");
     var after=snap();
     assert.deepStrictEqual(after,before,"real ~/.claude/settings.json changed during the test run: "+JSON.stringify({before:before,after:after}));
     console.log("ok: full npm test run left the real ~/.claude/settings.json stat-identical ("+(before.exists?"size "+before.size:"absent")+")");
     '
     ```
- **Expected Result**: Prints `ok: full npm test run left the real ~/.claude/settings.json stat-identical (...)`. Size and mtime (or absence) identical before and after the 134-test run.
- [x] Pass <!-- 2026-07-31 -->

---

## Notes on scope

- **Meta-verification only**: the merge script's behavioral contract was accepted by [[UAT-033]] and the template's shape by [[UAT-032]]; this UAT verifies TASK-034's *test suite* — green with exact counts, glob pickup, required-case coverage, non-vacuity, and its safety invariant. Nothing here re-litigates merge semantics.
- **Count correction**: TASK-034's implementation note said "20 tests — 7 template invariants + 13 merge-behavior cases"; the shipped file actually contains **21 tests — 7 invariants + 14 merge cases** (the plan's 12 merge cases plus the two deferred-push fix cases). The whole-suite total of 134 was always consistent with 21 (113 from the four sibling files + 21). The task note was corrected at UAT generation time; this UAT asserts the real numbers.
- **Vacuity probes mutate tracked files**: UAT-EDGE-001/002 temporarily rewrite `lib/scripts/templates/settings-hooks.json` / `lib/scripts/merge-settings-hooks.js` (and drop a ghost file in `lib/hooks/`), restoring exact original bytes in `finally` and asserting both the byte-identical restore and a green post-restore run before printing `ok`. Run them one at a time; do not interrupt mid-command.
- No new unit test file was created by this UAT: the deliverable under verification *is* the repo's unit suite, and every case above is either the suite run itself, circular-by-construction (asserting the suite's own names from within it), a fixture-mutating probe unsafe inside a hermetic runner, or dependent on the operator's real `$HOME`.
- **Command style constraint**: inline scripts use classic `function(){}` expressions, never arrows — the `serena-bash-grep-block` PreToolUse hook false-positives on `=>` followed by a `.js`-suffixed string and would block the Bash call.
- All six commands were dry-run at generation time and pass (the two probes produced exactly their predicted failure sets: 3/18 and 14/7).
