---
id: UAT-037
title: "UAT: Document automated hooks wiring — lib/hooks/README.md is no longer a manual-paste instruction sheet"
status: passed
task: TASK-037
created: 2026-07-31
updated: 2026-07-31
---

# UAT-037 — UAT: Document automated hooks wiring — lib/hooks/README.md is no longer a manual-paste instruction sheet

implements::[[TASK-037]]

> **Source task**: [[TASK-037]]
> **Generated**: 2026-07-31

This is a docs-only task, so every test is **static verification**: the claims in the three rewritten docs (`lib/hooks/README.md`, `lib/scripts/README.md`, root `CLAUDE.md`) must match the shipped code (`install-global.sh` step order, `lib.sh` `run_project_sync`, `merge-settings-hooks.js` semantics, `templates/settings-hooks.json` shape). No server, browser, or network is involved. All commands are read-only and run from the repo root.

**Generation-time note on the restart-reminder finding**: TASK-037's "Findings" section recorded that `install-global.sh`'s restart-reminder `case` pattern (`*'change(s) applied'*`) never matched `merge-settings-hooks.js`'s actual output (`N change(s)` is printed as `1 change applied` / `2 changes applied`). Since the docs were written, that pattern was fixed to `*'hooks wiring: created'*|*' applied'*` (and a regression test added — suite 140→141). UAT-DOC-005 verifies the docs' "restart note on created **or changed**" claim is now true against the shipped pattern, and that no doc quotes the old broken pattern or describes the finding as still-open behavior.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude` (all commands assume this cwd)
- [ ] Node available (`node --version` succeeds) — all check commands are `node -e` scripts, per the no-shell-text-tools policy
- [ ] No uncommitted edits to `lib/` or the three docs beyond TASK-037's own work (so failures indict the docs, not unrelated drift)

---

## Test Cases

### UAT-DOC-001: lib/hooks/README.md header describes automated wiring, not manual paste
- **File**: `lib/hooks/README.md` (header, ~lines 1-14)
- **Description**: The header must state that `install-global.sh` both rsyncs the hook scripts to `~/.claude/hooks/` **and** registers them via `merge-settings-hooks.js` merging `lib/scripts/templates/settings-hooks.json`, with manual pasting explicitly retired — and that claim must be true of the shipped script (a `merge-settings-hooks.js` invocation actually exists in `install-global.sh`).
- **Steps**:
  1. Run the command below; it prints the header claims found and confirms the script really invokes the merge.
  2. Read `lib/hooks/README.md` lines 1-14 and confirm the prose reads as automated wiring (registration happens on every `install`/`setup`/`update` run), with no surviving "copies the scripts but does not register them" framing.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var h=fs.readFileSync('lib/hooks/README.md','utf8').split('\n').slice(0,20).join('\n');var s=fs.readFileSync('lib/scripts/install-global.sh','utf8');function has(t,n,lbl){var ok=t.indexOf(n)>=0;console.log((ok?'OK  ':'FAIL')+' '+lbl);return ok;}var a=has(h,'merge-settings-hooks.js','header names merge-settings-hooks.js');var b=has(h,'settings-hooks.json','header points at the wiring template');var c=has(h,'Manual pasting is no longer','header retires manual pasting');var d=has(s,'merge-settings-hooks.js','install-global.sh actually runs the merge');var e=has(h,'install-global.sh','header credits install-global.sh');process.exit(a&&b&&c&&d&&e?0:1);"
  ```
- **Expected Result**: Command exits 0 with five `OK` lines. Header prose (read directly) says the same run that rsyncs the scripts also registers them, idempotently, on every `install`/`setup`/`update`.
- **Repeatable Unit Test**: Not applicable: prose-accuracy judgment over documentation; the underlying script behavior is already unit-covered in `test/install-global.test.js`
- [x] Pass <!-- 2026-07-31 -->

### UAT-DOC-002: Inline wiring JSON replaced by a single pointer to settings-hooks.json
- **File**: `lib/hooks/README.md` (section "Required `~/.claude/settings.json` wiring")
- **Description**: The former ~155-line inline JSON block must be gone, replaced by a pointer to `lib/scripts/templates/settings-hooks.json` as the single source of truth. No second copy of the wiring JSON (which would drift) may exist anywhere in the README, and the pointer's relative link must resolve to a real file.
- **Steps**:
  1. Run the command below. It asserts: zero occurrences of a quoted `"SessionStart"` key and zero `"hooks": [` JSON fragments (the signature of an inlined wiring block — the remaining fenced `jsonc` block in the README is the LSP state file, which is fine), at least one markdown link to `../scripts/templates/settings-hooks.json`, and that the link target exists on disk.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var t=fs.readFileSync('lib/hooks/README.md','utf8');var ses=(t.match(/\"SessionStart\"/g)||[]).length;var frag=(t.match(/\"hooks\": \[/g)||[]).length;var link=t.indexOf('](../scripts/templates/settings-hooks.json)')>=0;var exists=fs.existsSync('lib/scripts/templates/settings-hooks.json');console.log('quoted SessionStart occurrences (want 0): '+ses);console.log('inline hooks-array fragments (want 0): '+frag);console.log('pointer link present (want true): '+link);console.log('template file exists (want true): '+exists);process.exit(ses===0&&frag===0&&link&&exists?0:1);"
  ```
- **Expected Result**: Exit 0 — `0` / `0` / `true` / `true`. The wiring section describes the template as the one place the wiring lives and explicitly says the README does not inline a copy.
- **Repeatable Unit Test**: Not applicable: no-second-copy is a docs-structure invariant; the template's own validity/shape is already unit-covered in `test/settings-hooks.test.js`
- [x] Pass <!-- 2026-07-31 -->

### UAT-DOC-003: Merge-semantics notes match merge-settings-hooks.js shipped behavior
- **File**: `lib/hooks/README.md` (wiring section, "the template owns its blocks" bullets) vs `lib/scripts/merge-settings-hooks.js`
- **Description**: The README's two merge-semantics bullets must state, and the code must actually implement: (a) foreign (user-added) blocks/entries and non-shipped events are never modified, reordered, or removed; relocated repo hooks are warned about but not duplicated; no empty placeholder blocks; always exits 0. (b) Owned entries (`command` at `~/.claude/hooks/<name>.js` with a template basename) are overwritten on the next run, and the documented opt-out (re-point `command` elsewhere) carries the documented **limit**: the stock template entry is re-appended alongside the re-pointed variant (TASK-037 finding 2 — the README must document the shipped, weaker behavior, not the plan's stronger claim).
- **Steps**:
  1. Run the command below to confirm every claim keyword appears in the README's wiring section and that the merge script's only exit calls are `process.exit(0)`.
  2. Read `lib/hooks/README.md` merge-semantics bullets and spot-check them against `test/settings-hooks.test.js` case names (e.g. "relocated repo hook in a mixed block: left in place, warned, not duplicated", "foreign blocks and non-shipped events survive", "compound run: fully-relocated block leaves no empty placeholder block") — every doc claim should have a matching green test.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var t=fs.readFileSync('lib/hooks/README.md','utf8');var sec=t.slice(t.indexOf('## Required'));var src=fs.readFileSync('lib/scripts/merge-settings-hooks.js','utf8');function has(txt,n,lbl){var ok=txt.indexOf(n)>=0;console.log((ok?'OK  ':'FAIL')+' '+lbl);return ok;}var ok=true;ok=has(sec,'never modified, reordered','doc: foreign blocks never touched')&&ok;ok=has(sec,'not','doc: relocated-hook prose present')&&has(sec,'relocated','doc: relocation warning documented')&&ok;ok=has(sec,'empty','doc: no-empty-placeholder documented')&&ok;ok=has(sec,'exits 0','doc: always-exits-0 documented')&&ok;ok=has(sec,'overwritten on the next run','doc: owned-entry overwrite documented')&&ok;ok=has(sec,'re-appends the stock','doc: opt-out limit (re-append) documented')&&ok;var exits=src.match(/process\.exit\((\d+)\)/g)||[];var allZero=exits.length>0&&exits.every(function(e){return e==='process.exit(0)';});console.log((allZero?'OK  ':'FAIL')+' code: every process.exit is exit(0) ('+exits.join(',')+')');ok=ok&&allZero;process.exit(ok?0:1);"
  ```
- **Expected Result**: Exit 0, all `OK`. The opt-out bullet explicitly notes its limit (re-pointed variant preserved, but the shipped hook is re-appended, i.e. not disabled) — matching shipped behavior, not the plan's original stronger claim.
- **Repeatable Unit Test**: Not applicable: the behaviors themselves are already unit-covered in `test/settings-hooks.test.js` (21 cases incl. foreign-preservation, relocation-warn, no-empty-block, malformed-input exit-0); this case verifies the *prose* mirrors them
- [x] Pass <!-- 2026-07-31 -->

### UAT-DOC-004: Matcher-gotcha prose intact and byte-consistent with the template
- **File**: `lib/hooks/README.md` (the three matcher notes) vs `lib/scripts/templates/settings-hooks.json`
- **Description**: The three load-bearing matcher notes must have survived the rewrite and still be *true* of the template: (1) `env-content-read-guard.js` in its own block with matcher `Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*`; (2) `claude-settings-guard.js` as a file-tool hook with matcher `Edit|Write|NotebookEdit|MultiEdit` (adds `NotebookEdit`, drops `Read` vs `env-file-guard.js`'s `Read|Write|Edit|MultiEdit`); (3) the other four command-class guards (`interpreter-indirection-guard.js`, `package-install-consent.js`, `absolute-path-guard.js`, `protected-write-guard.js`) Bash-matched with **no** `if:` filter.
- **Steps**:
  1. Run the command below: it extracts each matcher from the template and asserts the identical string appears in the README prose, then asserts none of the four `if:`-less guards carries an `if` key in the template.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var t=fs.readFileSync('lib/hooks/README.md','utf8');var tpl=JSON.parse(fs.readFileSync('lib/scripts/templates/settings-hooks.json','utf8'));function blockOf(name){var found=null;tpl.PreToolUse.forEach(function(b){(b.hooks||[]).forEach(function(h){if((h.command||'').indexOf(name)>=0)found=b;});});return found;}var ok=true;var envB=blockOf('env-content-read-guard.js');var csB=blockOf('claude-settings-guard.js');function chk(cond,lbl){console.log((cond?'OK  ':'FAIL')+' '+lbl);ok=ok&&cond;}chk(envB&&envB.matcher==='Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*','template: env-content-read-guard own triple matcher');chk(envB&&t.indexOf(envB.matcher)>=0,'README quotes that exact matcher');chk(csB&&csB.matcher==='Edit|Write|NotebookEdit|MultiEdit','template: claude-settings-guard file-tool matcher');chk(csB&&t.indexOf(csB.matcher)>=0,'README quotes that exact matcher');var four=['interpreter-indirection-guard.js','package-install-consent.js','absolute-path-guard.js','protected-write-guard.js'];four.forEach(function(n){var b=blockOf(n);var entry=null;if(b)b.hooks.forEach(function(h){if(h.command.indexOf(n)>=0)entry=h;});chk(b&&b.matcher==='Bash'&&entry&&!('if' in entry),'template: '+n+' Bash-matched, no if:');});chk(t.indexOf('silently inert')>=0,'README keeps the load-bearing-matcher warning');process.exit(ok?0:1);"
  ```
- **Expected Result**: Exit 0, all `OK`. Reading the three notes confirms they are the preserved prose (dual-surface warning for env-content-read-guard, not-the-same-matcher-as-env-file-guard note, own-matching-in-JS note for the four Bash guards).
- **Repeatable Unit Test**: Not applicable: matcher truths are already unit-covered in `test/settings-hooks.test.js` ("env-content-read-guard keeps its own triple-matcher block", "claude-settings-guard matcher is exactly …"); this case pins the prose to them
- [x] Pass <!-- 2026-07-31 -->

### UAT-DOC-005: Closing reminder claims automatic registration + restart note — and the restart note actually fires
- **File**: `lib/hooks/README.md` (closing reminder) vs `lib/scripts/install-global.sh` vs `lib/scripts/merge-settings-hooks.js`
- **Description**: The closing reminder must say registration happens automatically on every run (no "one-time manual step" as a live claim) and that a fresh-created **or changed** wiring prints a restart-your-session note. Post-bugfix, the shipped `case` pattern is `*'hooks wiring: created'*|*' applied'*`, which must match both real merge outputs (`hooks wiring: created` and `hooks wiring: N change(s) applied`). If any of the three docs still quoted the old broken `*'change(s) applied'*` pattern or described the restart reminder as firing only on the `created` path, that is a FAIL.
- **Steps**:
  1. Run the command below: it simulates the shipped `case` glob against both real output strings from `merge-settings-hooks.js`, confirms the README's restart claim covers both paths, and sweeps all three docs for the stale literal `change(s) applied` pattern text.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var s=fs.readFileSync('lib/scripts/install-global.sh','utf8');var r=fs.readFileSync('lib/hooks/README.md','utf8');var ok=true;function chk(c,l){console.log((c?'OK  ':'FAIL')+' '+l);ok=ok&&c;}var pat=s.indexOf(\"*'hooks wiring: created'*|*' applied'*\")>=0;chk(pat,'install-global.sh ships the fixed case pattern');function matches(out){return out.indexOf('hooks wiring: created')>=0||out.indexOf(' applied')>=0;}chk(matches('hooks wiring: created'),'pattern matches the created output');chk(matches('hooks wiring: 1 change applied'),'pattern matches 1 change applied');chk(matches('hooks wiring: 3 changes applied'),'pattern matches N changes applied');chk(r.indexOf('There is no one-time manual step')>=0,'README explicitly retires the one-time manual step');chk(/creates the wiring fresh or applies changes/.test(r),'README restart claim covers created AND changed');chk(r.indexOf('restart')>=0,'README tells the user to restart sessions');['lib/hooks/README.md','lib/scripts/README.md','CLAUDE.md'].forEach(function(f){var t=fs.readFileSync(f,'utf8');chk(t.indexOf(\"change(s) applied\")<0,f+' does not quote the old broken pattern');});process.exit(ok?0:1);"
  ```
- **Expected Result**: Exit 0, all `OK`. The docs' restart-note claim is true of shipped code (finding 1 is fixed, and no doc presents it as still-open or quotes the dead pattern).
- **Repeatable Unit Test**: Not applicable: the fire-on-applied path is already unit-covered in `test/install-global.test.js` ("re-run after a perturbed hooks wiring reports the applied change and prints the restart reminder")
- [x] Pass <!-- 2026-07-31 -->

### UAT-DOC-006: lib/scripts/README.md rows match shipped step order in install-global.sh and lib.sh
- **File**: `lib/scripts/README.md` (rows: `setup-project.sh`, `update-project.sh`, `install-global.sh`, `lib.sh`) vs `lib/scripts/install-global.sh` + `lib/scripts/lib.sh`
- **Description**: No row may still describe the old order ("MCP install (interactive)" first / "MCPs → skills/hooks → wiki scaffold → gitignore → Serena"). The rows must describe: `install-global.sh` runs local steps first (hooks rsync → skills → deny merge → **hooks-wiring merge** → fileSuggestion) with MCPs **last and guarded** (`--skip-mcps` supported); `run_project_sync` runs `install-global.sh --skip-mcps` first, then the guarded interactive MCP install, then wiki scaffold / gitignore / mcp-guide / Serena. There must also be table rows for `merge-settings-hooks.js` and `templates/settings-hooks.json`.
- **Steps**:
  1. Run the command below: it verifies the shipped code order (step comments/invocations in `install-global.sh`; call sequence inside `run_project_sync()`), then asserts the README rows carry the new-order phrases and no old-order phrases.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var ok=true;function chk(c,l){console.log((c?'OK  ':'FAIL')+' '+l);ok=ok&&c;}var ig=fs.readFileSync('lib/scripts/install-global.sh','utf8');var seq=['lib/hooks/','lib/skills/','merge-settings-deny.js','merge-settings-hooks.js','file-suggestion.sh','install-mcps.sh'];var last=-1;seq.forEach(function(n){var i=ig.indexOf(n);chk(i>last,'install-global.sh order: '+n+' after previous step');last=i;});var lib=fs.readFileSync('lib/scripts/lib.sh','utf8');var fn=lib.slice(lib.indexOf('run_project_sync() {'));fn=fn.slice(0,fn.indexOf('\n}'));var seq2=['install-global.sh\" --skip-mcps','install-mcps.sh\" --interactive','sync-wiki-scaffold.sh','merge-gitignore.sh','build-mcp-guide.sh','bootstrap-serena.sh'];last=-1;seq2.forEach(function(n){var i=fn.indexOf(n);chk(i>last,'run_project_sync order: '+n+' after previous step');last=i;});var rm=fs.readFileSync('lib/scripts/README.md','utf8');chk(rm.indexOf('MCP install (interactive), global skills/hooks install')<0,'README: old setup-order phrasing gone');chk(rm.indexOf('MCPs → skills/hooks → wiki scaffold')<0,'README: old run_project_sync summary gone');chk(rm.indexOf('install-global.sh --skip-mcps')>=0,'README: skip-mcps-first sequence documented');chk(/MCPs install \*\*last\*\*/.test(rm),'README: MCPs-last documented');chk(rm.indexOf('merge-settings-hooks.js')>=0,'README: merge-settings-hooks.js row/mentions present');chk(rm.indexOf('templates/settings-hooks.json')>=0,'README: settings-hooks.json template row present');chk(/hooks-wiring merge/.test(rm),'README: install-global row names the hooks-wiring step');process.exit(ok?0:1);"
  ```
- **Expected Result**: Exit 0, all `OK`. Reading the four rows confirms they narrate the same order the code executes, including guarded/non-fatal MCP failure and the restart reminder.
- **Repeatable Unit Test**: Not applicable: step order is already unit-covered in `test/install-global.test.js` ("fresh run executes all six steps in the TASK-035 order, MCPs last") and `test/run-project-sync.test.js`; this case pins the prose to it
- [x] Pass <!-- 2026-07-31 -->

### UAT-DOC-007: Template-row factual claims — 4 events, 1:1 onto 18 hook scripts
- **File**: `lib/scripts/README.md` (`templates/settings-hooks.json` row) vs `lib/scripts/templates/settings-hooks.json` + `lib/hooks/*.js`
- **Description**: The new template row claims the wiring covers 4 events (`SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`) and maps 1:1 onto the 18 hook scripts in `lib/hooks/*.js`. Both numbers must be true on disk (a later hook addition that breaks the bijection would make this row stale).
- **Steps**:
  1. Run the command below: it recomputes the event list and the template-basename ↔ `lib/hooks/*.js` bijection from scratch and compares against the row's claims.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var tpl=JSON.parse(fs.readFileSync('lib/scripts/templates/settings-hooks.json','utf8'));var events=Object.keys(tpl);var names={};events.forEach(function(ev){tpl[ev].forEach(function(b){(b.hooks||[]).forEach(function(h){var m=/([A-Za-z0-9_.-]+\.js)/.exec(h.command||'');if(m)names[m[1]]=true;});});});var scripts=fs.readdirSync('lib/hooks').filter(function(f){return /\.js$/.test(f);});var tn=Object.keys(names).sort();var sn=scripts.sort();var ok=true;function chk(c,l){console.log((c?'OK  ':'FAIL')+' '+l);ok=ok&&c;}chk(events.length===4&&events.indexOf('SessionStart')>=0&&events.indexOf('PreToolUse')>=0&&events.indexOf('PostToolUse')>=0&&events.indexOf('PostToolUseFailure')>=0,'template has exactly the 4 documented events');chk(tn.length===18,'template wires 18 scripts (got '+tn.length+')');chk(sn.length===18,'lib/hooks has 18 top-level .js (got '+sn.length+')');chk(JSON.stringify(tn)===JSON.stringify(sn),'bijection: template basenames === lib/hooks/*.js');var rm=fs.readFileSync('lib/scripts/README.md','utf8');chk(rm.indexOf('4 events')>=0&&rm.indexOf('18 hook scripts')>=0,'README row states 4 events / 18 scripts');process.exit(ok?0:1);"
  ```
- **Expected Result**: Exit 0, all `OK` — both documented numbers recomputed true from disk.
- **Repeatable Unit Test**: Not applicable: already covered by `test/settings-hooks.test.js` ("template ships exactly the 4 event keys", "bijection: template commands <-> lib/hooks/*.js"); this case only cross-checks the README row against those facts
- [x] Pass <!-- 2026-07-31 -->

### UAT-DOC-008: Root CLAUDE.md bullets updated — setup/update/install order, step 5, key-files rows
- **File**: `CLAUDE.md` (Setup Workflow bullets ~71-73, manual step 5 ~85, key-files bullets `lib/hooks/` ~174 and `lib/scripts/install-global.sh` ~176-178)
- **Description**: All CLAUDE.md passages touched by TASK-037 must describe the new reality: `setup`/`update` bullets say hooks/skills/settings land first via `install-global.sh --skip-mcps` with the interactive MCP install second and guarded; the `install` bullet mentions both merges and MCPs-last; step 5 covers hooks + skills + deny + wiring with MCPs last/non-fatal; the `lib/hooks/` bullet no longer claims "wiring is a one-time manual step" / "does NOT register them"; the `install-global.sh` bullet names `merge-settings-hooks.js` + `templates/settings-hooks.json`.
- **Steps**:
  1. Run the command below for phrase-level assertions.
  2. Read the two Setup Workflow bullets and the two key-files bullets end-to-end and confirm the narrated order matches UAT-DOC-006's verified code order.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var t=fs.readFileSync('CLAUDE.md','utf8');var ok=true;function chk(c,l){console.log((c?'OK  ':'FAIL')+' '+l);ok=ok&&c;}chk(t.indexOf('wiring is a one-time manual step')<0,'old one-time-manual claim gone');chk(t.indexOf('does NOT register them')<0,'old does-NOT-register claim gone');chk((t.match(/install-global\.sh --skip-mcps/g)||[]).length>=2,'setup+update bullets describe --skip-mcps-first');chk(t.indexOf('merge-settings-hooks.js')>=0,'names the merge-settings-hooks script');chk(t.indexOf('templates/settings-hooks.json')>=0,'settings-hooks.json template named');chk(/MCPs (install |run )?last/i.test(t),'MCPs-last documented');chk(t.indexOf('registered automatically by')>=0,'lib/hooks bullet: automatic registration');chk(t.indexOf('deny list + hook wiring')>=0,'step 5 / bullets mention both merges');process.exit(ok?0:1);"
  ```
- **Expected Result**: Exit 0, all `OK`. The four passages read consistently with each other and with the two READMEs.
- **Repeatable Unit Test**: Not applicable: prose-consistency judgment over project instructions
- [x] Pass <!-- 2026-07-31 -->

### UAT-EDGE-001: Residual stale-phrasing sweep across all three docs
- **Scenario**: TASK-037's targeted line numbers may have missed a stray "manual" / "by hand" / "one-time" / "paste" / MCP-first phrase elsewhere in the three files (line numbers shifted during the rewrite).
- **Steps**:
  1. Run the command below; it prints every hit for the stale-phrase patterns in the three docs.
  2. Judge each hit: it must be a **negation** ("Manual pasting is no longer required", "There is no one-time manual step", "no longer need manual wiring", "instead of being hand-pasted") or **unrelated** (LSP one-time `systemMessage`/`notified` prose, the clipboard "paste column" hook description, standalone infra scripts "invoked manually", CLAUDE.md's "Manual setup steps" heading for the Serena/MCP descriptions). Any hit that asserts hooks wiring is manual, a one-time step, or that MCP install runs first is a FAIL.
- **Command**:
  ```bash
  node -e "var fs=require('fs');var files=['lib/hooks/README.md','lib/scripts/README.md','CLAUDE.md'];var pats=[/manual/i,/by hand/i,/one-?time/i,/paste/i,/hand-?pasted/i];var n=0;files.forEach(function(f){var t=fs.readFileSync(f,'utf8');t.split('\n').forEach(function(l,i){var hit=false;pats.forEach(function(p){if(p.test(l))hit=true;});if(hit){n++;console.log(f+':'+(i+1)+': '+l.trim());}});});console.log('--- '+n+' hit(s) — every one must be a negation or unrelated to hooks wiring');"
  ```
- **Expected Result**: Every printed hit is a negation or unrelated (at generation time: README:10 negation, README:475 clipboard hook, README:632/635/643/711 LSP one-time notice, README:781 negation, README:797 negation, scripts-README:34 standalone infra, scripts-README:54 "instead of being hand-pasted" negation, CLAUDE.md:79 "Manual setup steps" heading). Zero hits presenting hooks wiring as manual/one-time or MCP install as first.
- **Repeatable Unit Test**: Not applicable: requires human judgment of negation vs. live claim; a keyword denylist would false-positive on the legitimate negations
- [x] Pass <!-- 2026-07-31 -->

### UAT-EDGE-002: Scope containment — nothing under raw/ touched, edits confined to the three docs
- **Scenario**: TASK-037 was a three-file docs task; `raw/` is immutable and must show no working-tree changes, and TASK-037's own diff must not have reached beyond `lib/hooks/README.md`, `lib/scripts/README.md`, `CLAUDE.md` (plus wiki bookkeeping: the task file, indexes, log — and this UAT's own files).
- **Steps**:
  1. Run the command below: it lists any modified/untracked paths under `raw/` (must be none) and prints the full working-tree status for review.
  2. If TASK-037 was already committed, additionally inspect its commit (`git show --stat <sha>`) and confirm the same containment: only the three docs + wiki bookkeeping.
- **Command**:
  ```bash
  git status --porcelain
  ```
- **Expected Result**: No line references a path under `raw/`. Every listed path is one of the three docs, `wiki/**` bookkeeping (task/UAT/index/log), or pre-existing unrelated work (`wiki/work/tasks/TASK-030-*`, `TASK-031-*` were already present before TASK-037).
- **Repeatable Unit Test**: Not applicable: git working-tree state assertion, not deterministic logic
- [x] Pass <!-- 2026-07-31 -->

---

## Gaps

None — every planned check was researched to its source contract; no tests were dropped. No new unit tests were created: all deterministic assertions underlying these cases are already covered by the existing suite (`test/settings-hooks.test.js` — 21 cases incl. the 18-hook bijection, 4-event key check, and exact matcher assertions; `test/install-global.test.js` — 7 cases incl. six-step order and the restart-reminder-on-applied regression test; 141 tests total green).
