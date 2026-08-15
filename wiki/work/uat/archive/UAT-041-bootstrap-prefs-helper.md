---
id: UAT-041
aliases: [UAT-041]
title: "UAT: bootstrap-prefs.js — four-state preference helper"
status: passed
task: TASK-041
created: 2026-08-06
updated: 2026-08-06
---

# UAT-041 — UAT: bootstrap-prefs.js — four-state preference helper

implements::[[TASK-041]]

> **Source task**: [[TASK-041]]
> **Generated**: 2026-08-06

---

## Prerequisites

- [x] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there unless a test says otherwise
- [x] Node.js available on `PATH`
- [x] `lib/scripts/bootstrap-prefs.js` and `lib/scripts/templates/bootstrap-prefs-schema.json` both exist (TASK-040 shipped the schema)

**Scope note.** TASK-042 already covers the helper's *computed behavior* in 55 subprocess tests. This UAT deliberately does **not** re-run those. It covers what those tests structurally cannot see: the helper launched the way production launches it — a real end-to-end round trip, a foreign working directory, a redirected `HOME`, and the file's own packaging (shebang, executable bit, zero dependencies).

**Safety.** Every values-file operation goes through `--target` into an `fs.mkdtemp` scratch directory or a redirected `HOME`. **No test touches the real `~/.claude/bootstrap-prefs.json`** — UAT-EDGE-009 asserts that explicitly, before and after. No test runs `install-global.sh` or any installer.

---

## Test Cases

### UAT-EDGE-001: The file is syntactically valid and parses under the running Node
- **Scenario**: Step 7's first gate. A syntax error would make every consumer — installer, skill, `/bootstrap-config` — fail identically and unhelpfully.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node --check lib/scripts/bootstrap-prefs.js
  ```
- **Expected Result**: Exits 0 with no output.
- **Repeatable Unit Test**: Not applicable: `node --check` is subsumed by the suite, which cannot load an unparseable file at all — a dedicated test would be redundant with the harness itself.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-002: Full end-to-end round trip — set → get → invalid → unset → get
- **Scenario**: Step 7's smoke pass, run as one uninterrupted sequence against a real scratch file rather than as isolated assertions. This is the sequence a Phase 2 installer will actually perform, and it pins the four-state model end to end: absence reads `unset`, a stored `ask` reads back `ask` (the **conflation trap** — the failure mode that is invisible in normal use because `unset` and `ask` both produce a prompt), an invalid value exits 1 without touching the file, and `--unset` returns the key to absence rather than writing a `null`.
- **Steps**:
  1. Run the command below. It creates its own `fs.mkdtemp` scratch dir, drives the helper through the full sequence via `--target`, and removes the dir at the end.
- **Command**:
  ```bash
  node -e 'const {spawnSync}=require("child_process"),fs=require("fs"),os=require("os"),path=require("path");const S="lib/scripts/bootstrap-prefs.js";const d=fs.mkdtempSync(path.join(os.tmpdir(),"uat041-")),t=path.join(d,"bootstrap-prefs.json");const r=(...a)=>{const x=spawnSync(process.execPath,[S,...a],{encoding:"utf8"});return{s:x.status,o:x.stdout.trim()}};const ok=(c,m)=>console.log(c?"OK  ":"FAIL",m);ok(r("--get","mcp.braveSearch","--target",t).o==="unset"&&!fs.existsSync(t),"absence reads unset and a read creates nothing");ok(r("--set","mcp.braveSearch","--value","true","--target",t).s===0&&r("--get","mcp.braveSearch","--target",t).o==="true","set true then get true");ok(typeof JSON.parse(fs.readFileSync(t,"utf8"))["mcp.braveSearch"]==="boolean","stored as a JSON boolean, not a string");r("--set","gitCommit.autoPush","--value","ask","--target",t);ok(r("--get","gitCommit.autoPush","--target",t).o==="ask","a stored ask reads back ask, NOT unset (conflation trap)");const b=fs.readFileSync(t,"utf8"),bad=r("--set","gitCommit.versionBump","--value","ask","--target",t);ok(bad.s===1&&fs.readFileSync(t,"utf8")===b,"invalid value exits 1 and writes nothing");ok(fs.existsSync(path.join(d,"bootstrap-prefs.README.md")),"companion README written beside the values file");ok(!fs.readFileSync(t,"utf8").includes("null"),"no null anywhere on disk");ok(r("--unset","mcp.braveSearch","--target",t).s===0&&r("--get","mcp.braveSearch","--target",t).o==="unset","unset returns the key to unset");ok(!Object.keys(JSON.parse(fs.readFileSync(t,"utf8"))).includes("mcp.braveSearch"),"the key is gone from the file entirely");ok(fs.readdirSync(d).filter(f=>/\.tmp-/.test(f)).length===0,"no .tmp-* residue");fs.rmSync(d,{recursive:true,force:true});'
  ```
- **Expected Result**: Ten lines, every one starting `OK`:
  ```
  OK   absence reads unset and a read creates nothing
  OK   set true then get true
  OK   stored as a JSON boolean, not a string
  OK   a stored ask reads back ask, NOT unset (conflation trap)
  OK   invalid value exits 1 and writes nothing
  OK   companion README written beside the values file
  OK   no null anywhere on disk
  OK   unset returns the key to unset
  OK   the key is gone from the file entirely
  OK   no .tmp-* residue
  ```
  Line 3 is load-bearing: a stored `"true"` **string** would be truthy in every shell test and read back as a settled value. Line 4 is the conflation trap.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` — each step of this sequence is already pinned individually there (the named conflation-trap test, the boolean-coercion tests, the exit-1-writes-nothing tests, the residue tests). This case is the **integration** of them in production order, which no single unit test asserts.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-003: The default schema path resolves from a foreign working directory
- **Scenario**: The single most production-specific failure in this task, and one no other test can see. `bootstrap-prefs.js:111` must use `path.join(__dirname, 'templates', ...)`. Every test in the suite passes an explicit `--schema` **and runs from the repo root**, so a cwd-relative default would pass the entire suite and break only in the field — where the caller is an installer that has `cd`'d elsewhere, or a `/git-commit` in an unrelated project. The failure is near-silent: an unfindable schema is a `warnSkip`, so the helper exits 0 with no defaults and no validation, and `gitCommit.versionBump` returns `unset` instead of `auto` — a question that was already answered, re-asked forever.
- **Steps**:
  1. Run the helper by absolute path **from `/tmp`**, not from the repo
- **Command**:
  ```bash
  cd /tmp && node /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/bootstrap-prefs.js --get gitCommit.versionBump
  ```
- **Expected Result**: Prints exactly `auto` — the schema default — on stdout, with **nothing on stderr** and exit 0. A `warnSkip` line about a missing schema, or an output of `unset`, is a fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`the default schema path resolves from any cwd, not just the repo root`) — new in this UAT; failure proven by mutating `:111` to a cwd-relative path, which the test caught while the other 204 stayed green.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-004: `--global` follows a redirected `HOME` and writes the real path shape
- **Scenario**: `os.homedir()` must be used rather than `process.env.HOME` directly. This is what makes hermetic testing possible at all, and it also pins the on-disk layout the roadmap promises: `$HOME/.claude/bootstrap-prefs.json`, with the companion beside it. The parent directory `.claude/` will not exist in a fresh scratch HOME, so this exercises `mkdirSync({ recursive: true })` on the global layer specifically.
- **Steps**:
  1. Run the command below, which builds a scratch `HOME`, sets a global-scope key through `--global`, and asserts the file landed at the documented path
- **Command**:
  ```bash
  node -e 'const {spawnSync}=require("child_process"),fs=require("fs"),os=require("os"),path=require("path");const S="lib/scripts/bootstrap-prefs.js";const H=fs.mkdtempSync(path.join(os.tmpdir(),"uat041home-"));const env=Object.assign({},process.env,{HOME:H});const r=(...a)=>{const x=spawnSync(process.execPath,[S,...a],{encoding:"utf8",env});return{s:x.status,o:x.stdout.trim()}};const ok=(c,m)=>console.log(c?"OK  ":"FAIL",m);const vf=path.join(H,".claude","bootstrap-prefs.json");r("--set","mcp.braveSearch","--value","false","--global");ok(fs.existsSync(vf),"values file at <scratchHOME>/.claude/bootstrap-prefs.json");ok(fs.existsSync(path.join(H,".claude","bootstrap-prefs.README.md")),"companion beside it");ok(r("--get","mcp.braveSearch","--global").o==="false","--get --global reads back false");ok(JSON.parse(fs.readFileSync(vf,"utf8"))["mcp.braveSearch"]===false,"on-disk value is the JSON boolean false");ok(!fs.existsSync(path.join(os.homedir(),".claude","bootstrap-prefs.json")),"real HOME untouched");fs.rmSync(H,{recursive:true,force:true});'
  ```
- **Expected Result**: All five lines print `OK`:
  ```
  OK  values file at <scratchHOME>/.claude/bootstrap-prefs.json
  OK  companion beside it
  OK  --get --global reads back "false"
  OK  on-disk value is the JSON boolean false
  OK  real HOME untouched
  ```
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (the `withLayers()` resolution-order suite, whose hermeticity guard asserts the redirected global path sits inside the scratch `HOME` *before* each test body runs).
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-005: The helper matches its named precedent — shebang plus executable bit
- **Scenario**: Step 1 requires matching `merge-settings-deny.js` exactly. This is a real fork, not a formality: the two existing manipulators **disagree** — `merge-settings-deny.js` is `0755`, `merge-settings-hooks.js` is `0644`, both with shebangs. Both invocation forms must work, since call sites use both: `node <path>` ignores the shebang and needs no `+x`, while direct `<path>` execution needs both.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node --test --test-name-pattern='stated precedent' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. The helper carries `#!/usr/bin/env node`, is mode `0755`, and its mode equals `merge-settings-deny.js`'s.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`the helper matches its stated precedent: shebang plus executable bit`) — new in this UAT.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-006: The helper is zero-dependency and runs with no `node_modules`
- **Scenario**: The helper runs inside installers that may execute **before** `npm install`, and from a global `~/.claude/` install with no `node_modules` anywhere near it. A single non-builtin `require` would turn a preference read into a crash at the moment the store is least recoverable.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node --test --test-name-pattern='zero-dependency' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. Every `require()` in the file resolves to a Node builtin — today exactly `fs`, `os`, `path`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`the helper is zero-dependency — node builtins only, no node_modules at run time`) — new in this UAT.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-007: `--section-key` collapses the em dash to one dash, not three
- **Scenario**: The departure TASK-041 added beyond its brief, acting on TASK-040's handover. `lib/scripts/templates/gitignore` carries the title `Claude Code — machine-local MCP registration (…)`, containing an **em dash (U+2014)**. The obvious shell slugifier (`[^a-z0-9]` over bytes) sees that one character as three UTF-8 bytes and emits three dashes — producing a key that does not match the one the schema documents, so a remembered decline silently stops matching and the prompt re-asks forever.
- **Steps**:
  1. Run the slugifier tests, which exercise `--section-key` against every real banner title in the template
- **Command**:
  ```bash
  node --test --test-name-pattern='em-dash|section-key|slugified key' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 4`, `fail 0` — all four slugifier tests: the em-dash title is still present in the template, `--section-key` collapses it to a single dash rather than three, every real banner title's slug matches the rule the schema documents, and a slugified key resolves through the `gitignore.section.*` wildcard while enforcing its one-value grammar.

  > **Probe correction (2026-08-06, during `/uat-auto`).** The originally generated filter used `em dash` with a **space**, which does not match the test named `em-dash` with a hyphen; it selected only 2 of the 4 slugifier tests, against an expectation of "at least 3". The under-selection was in the filter, not the code — all four tests pass. Pattern widened to `em-dash|section-key|slugified key` and the expectation pinned to the exact count, so a future test being dropped from this family is visible instead of absorbed by a vague "at least".
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (the four slugifier tests TASK-041 added).
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-008: A malformed values file degrades on read and refuses to write
- **Scenario**: The asymmetry that keeps a corrupt store from becoming data loss. On `--get` the helper warns and degrades to `unset` (exit 0, so a corrupt file never aborts an install under `set -euo pipefail` or blocks a commit). On `--set` and `--unset` it warns and exits **0 without writing** — clobbering a file the user may have hand-edited into invalidity would destroy real answers to recover a machine convenience.
- **Steps**:
  1. Run the command below, which writes garbage to a scratch target and drives all three operations against it
- **Command**:
  ```bash
  node -e 'const {spawnSync}=require("child_process"),fs=require("fs"),os=require("os"),path=require("path");const S="lib/scripts/bootstrap-prefs.js";const d=fs.mkdtempSync(path.join(os.tmpdir(),"uat041bad-")),t=path.join(d,"bootstrap-prefs.json");const G="{ this is not json at all ";fs.writeFileSync(t,G);const r=(...a)=>{const x=spawnSync(process.execPath,[S,...a],{encoding:"utf8"});return{s:x.status,o:x.stdout.trim(),e:x.stderr.trim()}};const ok=(c,m)=>console.log(c?"OK  ":"FAIL",m);const g=r("--get","mcp.braveSearch","--target",t);ok(g.s===0,"--get exits 0");ok(g.o==="unset","--get prints unset");ok(g.e.includes(t),"--get warns on stderr naming the file");ok(r("--set","mcp.braveSearch","--value","true","--target",t).s===0&&fs.readFileSync(t,"utf8")===G,"--set exits 0 and the garbage bytes survive byte-identical");ok(r("--unset","mcp.braveSearch","--target",t).s===0&&fs.readFileSync(t,"utf8")===G,"--unset exits 0 and the garbage bytes survive byte-identical");ok(fs.readdirSync(d).filter(f=>/\.tmp-/.test(f)).length===0,"no .tmp-* residue");fs.rmSync(d,{recursive:true,force:true});'
  ```
- **Expected Result**: All six lines print `OK`:
  ```
  OK  --get exits 0
  OK  --get prints unset
  OK  --get warns on stderr naming the file
  OK  --set exits 0 and the garbage bytes survive byte-identical
  OK  --unset exits 0 and the garbage bytes survive byte-identical
  OK  no .tmp-* residue
  ```
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (the malformed-file tests in the exit-code-contract section, including the `--unset` case — corruption surviving `--set` but being rewritten by `--unset` would be the same data loss by another door).
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-009: The run never touches the real `~/.claude/bootstrap-prefs.json`
- **Scenario**: The hermeticity guarantee. Step 7 states it as a hard rule. A test that wrote to the developer's real store would corrupt answers that are, by design, never re-asked — an unrecoverable failure that no later run would surface.
- **Steps**:
  1. Run the command below **after** all other tests in this file have run
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),os=require("os"),path=require("path");const d=path.join(os.homedir(),".claude");const names=["bootstrap-prefs.json","bootstrap-prefs.README.md"];for(const n of names)console.log(fs.existsSync(path.join(d,n))?"PRESENT":"absent ",n);console.log("tmp residue:",fs.readdirSync(d).filter(f=>/\.tmp-/.test(f)).length)'
  ```
- **Expected Result**: Both names print `absent`, and `tmp residue: 0`. (Baseline captured before this UAT ran: both absent.)
- **Repeatable Unit Test**: Not applicable: asserts the *absence* of a side effect on the developer's real home directory. A unit test asserting this would itself have to run in the environment it is protecting, and would pass trivially inside the redirected-`HOME` harness — the check is only meaningful run against the real `HOME`, from outside the suite.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-010: The suite is green with the schema, helper, and packaging tests together
- **Scenario**: Whole-suite regression gate. The helper is consumed by the schema tests (via `--section-key`) and by every behavior test, so a change here has the widest blast radius in Phase 1.
- **Steps**:
  1. Run the full suite
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `fail 0` and `skipped 1`. The single skip is TASK-042's `schema -> scripts` bijection, deliberately skipped until ROADMAP-005 Phase 2 wires the first call site; its body is complete, not stubbed, and it **does not block completion**.
- **Repeatable Unit Test**: Not applicable: this case *is* the test suite.
- [x] Pass <!-- 2026-08-06 -->

---

## Gaps

- **No test proves the helper behaves correctly when called from a shell script**, because no shell script calls it yet. `prompt_yn_sticky` / `prompt_choice_sticky` land in Phase 2, and their load-bearing rule — record an answer only when it was actually asked interactively — lives in `lib.sh`, not here. This helper has no concept of a tty and cannot be tested for one.
- **`mcp.playwrightConflict`'s name→branch mapping is unverifiable at this stage.** The helper stores `shared`/`alongside`/`skip` by name and knows nothing about `install-mcps.sh:415`'s `1`/`2`/`3` menu. Feeding a stored name straight into the digit comparison would fall through every branch and silently behave like `skip`. Phase 2 must add the explicit mapping at the call site; there is nothing to assert until it does.
- **The `--unset`-creates-nothing judgment call is pinned but not user-validated.** `--unset` against a values file that does not exist prints `was already unset (no preferences file at <path>)` and creates neither the file nor a companion. That is deliberate, but it is a design choice a human should confirm reads correctly in `/bootstrap-config` (Phase 3) rather than something a test can judge.
