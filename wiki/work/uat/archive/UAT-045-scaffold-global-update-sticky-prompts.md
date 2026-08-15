---
id: UAT-045
aliases: [UAT-045]
title: "UAT: Wire the sync-wiki-scaffold.sh, install-global.sh, and update-project.sh prompt sites"
status: passed
task: TASK-045
created: 2026-08-06
updated: 2026-08-06
---

# UAT-045 — UAT: Wire the sync-wiki-scaffold.sh, install-global.sh, and update-project.sh prompt sites

implements::[[TASK-045]]

> **Source task**: [[TASK-045]]
> **Generated**: 2026-08-06

---

## Scope note

Three prompt sites, three key families, and **three design decisions that are
invisible in normal use** — which is what this UAT is actually for:

1. **`guides.*` is a dynamic family whose key literal is computed.** The call
   site builds `guides.$guide` from the `OPTIONAL_GUIDES` loop variable and never
   names a guide. Enumerating them a second time is exactly the drift the wildcard
   schema entry exists to prevent.
2. **The store is read *ahead of* the `INTERACTIVE` guard, not behind it.**
   Behind it, a stored `true` would be silently ignored on every headless run — so
   an answer recorded once would only take effect when the user was sitting at a
   tty, which is precisely the case where they'd have been asked anyway.
3. **`update.legacyDocsAck` records `true` only.** Every other Phase 2 key records
   both directions. A persisted `false` from this prompt would abort every future
   `update` at `exit 0`, silently, with no prompt left to change your mind with.
   `false` remains legal and **is still honoured on read**, so `/bootstrap-config`
   can set it deliberately — read and write are asymmetric on purpose.

**Hermeticity.** Every case runs against a `mkdtemp` scratch `HOME` and scratch
project, with the redirect proved before any write. This matters more here than
anywhere else in Phase 2: `install-global.sh` rsyncs into `~/.claude/skills/` and
`~/.claude/hooks/` and would otherwise overwrite the developer's own install.

**Two known testing artifacts — not product defects.** `read -r -p` does not echo
its prompt to a pipe, so the evidence a prompt fired is the answer being consumed
and recorded, never the prompt text. And under `BOOTSTRAP_ASSUME_TTY=1` with
stdin at EOF, `read` returns empty and a sticky prompt records the default — a
documented path unreachable at a real tty.

---

## Prerequisites

- [ ] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude`; `node`, `bash`, `rsync` on `PATH`
- [ ] TASK-043's helpers present in `lib/scripts/lib.sh`
- [ ] `npm test` green before starting

---

## Test Cases

### UAT-EDGE-001: `guides.*` keys are built from the loop variable and remembered by exact key
- **Scenario**: Two guides answered **differently in one run** — the file guide `evals-framework.md` declined, the directory guide `type-checking-templates` accepted. Two different answers is what proves the key literal tracks the loop variable: a hard-coded key would record both under one name.
- **Steps**:
  1. Run the command below. Run 2 uses **poison stdin** (all `y`), so any prompt that still fired would flip the declined guide to delivered.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="guides.\* keys are built from the loop variable" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. The store holds exactly `{"guides.evals-framework.md": false, "guides.type-checking-templates": true}` — **the extension is part of the key** — and both are JSON booleans, not strings. The declined guide is not on disk; the accepted one is. On run 2 the declined guide reports `skipped (remembered answer guides.evals-framework.md=false …)` and stays absent, while the accepted one comes back through the **presence** branch (`refreshed (already present — previously opted in)`), not the stored-answer branch — a file on disk is the stronger signal, and the user opts out by deleting it.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`sync-wiki-scaffold.sh e2e: guides.* keys are built from the loop variable, and each answer is remembered by its exact key`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-002: a stored `true` delivers the guide on a NON-INTERACTIVE run
- **Scenario**: The ordering claim. The schema says a stored `true` delivers the guide on **every** run, so the lookup must sit ahead of the `INTERACTIVE` guard. This is the single most easily-broken decision in the task — moving the lookup behind the guard leaves every interactive test still passing.
- **Steps**:
  1. Run the command below. It seeds `guides.evals-framework.md: true` and runs the scaffold with **no** `--interactive` and **no** tty seam, so nothing can prompt.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a stored .true. delivers the guide on a NON-INTERACTIVE run" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Stdout carries `evals-framework.md: delivered (remembered answer guides.evals-framework.md=true …)` and the guide is on disk. The **other** guide is unanswered with no tty, so it stays absent *and* unrecorded — the store still holds exactly one key, proving the headless run did not record an answer for a question it never asked.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`sync-wiki-scaffold.sh e2e: a stored true delivers the guide on a NON-INTERACTIVE run`). Falsifiability confirmed by wrapping the lookup in `[ "$INTERACTIVE" = true ] && … || echo unset`, which failed this test alone while the interactive test stayed green; `sync-wiki-scaffold.sh` was restored and verified byte-identical by SHA-256.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-003: a `skills.pruneOrphans` decline is remembered, and the second run neither prompts nor deletes
- **Scenario**: `install-global.sh` had no `lib.sh` source at all and hand-rolled its prompt with `[ -t 0 ]` + `read`. `skills.pruneOrphans` is `scope: global` and this script has no project dir, so `--global` is the only correct selector.
- **Steps**:
  1. Run the command below. It plants two stale skill folders in a scratch `HOME`, declines once, then re-runs with **poison stdin** (`y`) — a re-asked prompt would delete them.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="skills.pruneOrphans decline is remembered" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Run 1 detects the stale folders, prints the `Skipped. To remove manually: rm -rf …` escape route, records `skills.pruneOrphans: false` in the **scratch** global layer, and leaves both folders intact. Run 2 prints `skills.pruneOrphans: using remembered answer (no) — change with /bootstrap-config` and both folders survive the poisoned `y`.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`install-global.sh e2e: a skills.pruneOrphans decline is remembered, and the second run neither prompts nor deletes`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-004: `update.legacyDocsAck` records `true` only — a decline writes NOTHING
- **Scenario**: The one asymmetry in Phase 2, and the reason this site deliberately does **not** use `prompt_yn_sticky`. That helper records in both directions, and a persisted `false` here would abort every future `update` at `exit 0` — silently, with no prompt left to change your mind with — bricking the update command until the user found `/bootstrap-config`.
- **Steps**:
  1. Run the command below. It builds a scratch project with legacy `.docs/tasks/x.md` and declines the continue prompt.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="update.legacyDocsAck records .true. only" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. The legacy banner prints, the run reports `Aborted.` and exits 0, and **neither layer has a values file or a companion README** — a companion beside a missing values file would itself prove a write path ran.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`update-project.sh e2e: update.legacyDocsAck records true only — a decline writes NOTHING`). Falsifiability confirmed by adding `prefs_set … false` to the decline path, which failed this test with `an answer was recorded that should not have been`; `update-project.sh` was restored and verified byte-identical by SHA-256.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-005: a stored `false` is still honoured on READ
- **Scenario**: The other half of the asymmetry, and the half most likely to be dropped while "simplifying" the ladder. `false` is never *written* by the prompt, but it stays a legal value — a user who genuinely wants `update` to keep refusing on this project must be able to set it via `/bootstrap-config`.
- **Steps**:
  1. Run the command below. stdin is **poisoned** with `y`, which would continue past the banner if the prompt still fired.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a stored .false. is still honoured on READ" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Stdout carries `update.legacyDocsAck: honouring recorded answer (no) — change with /bootstrap-config` followed by `Aborted.`, exit 0, and the store is unchanged by bytes **and** mtime — this path reads only.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`update-project.sh e2e: a stored false is still honoured on READ, so /bootstrap-config can set it deliberately`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-001: the `guides.*` key is computed, never a literal, and the CLAUDE.md prompt is left alone
- **Description**: Two structural claims. The key must be built as `guides.$guide` with **no** hard-coded guide key anywhere — a literal list would be the second enumeration the wildcard entry exists to prevent. And `sync-wiki-scaffold.sh`'s CLAUDE.md-vs-`CLAUDE.local.md` question is the one prompt in the repo already sticky in both directions (both answers write a sentinel); wiring it to the store would add a second source of truth that could disagree with the disk.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs");
  const s=fs.readFileSync("lib/scripts/sync-wiki-scaffold.sh","utf8");
  const code=s.split("\n").filter(l=>!/^\s*#/.test(l)).join("\n");
  const computed=/guides\.\$guide/.test(code);
  const literals=(code.match(/guides\.(evals-framework|type-checking-templates)/g)||[]);
  console.log("key built as guides.$guide      : "+computed);
  console.log("hard-coded guide key literals   : "+JSON.stringify(literals));
  const stillPlain=code.indexOf("prompt_yn_sticky")!==-1 && !/prompt_yn_sticky[^\n]*CLAUDE/.test(code);
  console.log("CLAUDE.md-vs-local prompt still plain prompt_yn (not sticky): "+stillPlain);
  const ok=computed && literals.length===0 && stillPlain;
  console.log(ok?"GUIDES KEY COMPUTED; CLAUDE.md PROMPT LEFT ALONE":"DEFECT");
  process.exit(ok?0:1);'
  ```
- **Expected Result**: `key built as guides.$guide : true`, `hard-coded guide key literals : []`, the CLAUDE.md prompt still on plain `prompt_yn`, then `GUIDES KEY COMPUTED; CLAUDE.md PROMPT LEFT ALONE`.
- **Repeatable Unit Test**: Not applicable: a structural audit of one shell script. The behavioural half — that the computed key resolves to the exact expected literals — is asserted by UAT-EDGE-001, which compares the whole stored object.
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-002: the three schema citations this task moved are accurate
- **Description**: Sourcing `lib.sh` shifted `install-global.sh`'s prompt (`:59` → `:70`) and the new ladder shifted `update-project.sh`'s (`:46` → `:76`). `OPTIONAL_GUIDES=` was **verified rather than assumed** and genuinely did not move, so its citation was correctly left alone.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs");
  const k=JSON.parse(fs.readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));
  const keys=k.keys||k;
  const spec=[["guides.*","sync-wiki-scaffold.sh","OPTIONAL_GUIDES="],
   ["skills.pruneOrphans","install-global.sh","Delete these"],
   ["update.legacyDocsAck","update-project.sh","Continue with update anyway?"]];
  let bad=0;
  for(const row of spec){
    const key=row[0], file=row[1], pin=row[2];
    const re=new RegExp(file.replace(/\./g,"\\.")+":(\\d+)");
    const m=(keys[key].detail||"").match(re);
    if(!m){console.log("NO CITATION  "+key);bad++;continue;}
    const n=Number(m[1]);
    const line=fs.readFileSync("lib/scripts/"+file,"utf8").split("\n")[n-1]||"";
    const ok=line.indexOf(pin)!==-1;
    console.log((ok?"OK   ":"STALE")+"  "+key+" -> "+file+":"+n);
    if(!ok)bad++;
  }
  console.log(bad===0?"ALL 3 CITATIONS ACCURATE":"STALE: "+bad);
  process.exit(bad===0?0:1);'
  ```
- **Expected Result**: `guides.*` → `sync-wiki-scaffold.sh:81`, `skills.pruneOrphans` → `install-global.sh:70`, `update.legacyDocsAck` → `update-project.sh:76`, then `ALL 3 CITATIONS ACCURATE`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`CITATION_PINS`, pre-existing — the two moved rows were updated by TASK-045 step 6 and are asserted on every run)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-003: the tty seam is adopted across all three scripts and each still parses
- **Description**: Two of the three sites were hand-rolled `read -r -p` blocks gated on a bare `[ -t 0 ]`, which no harness can reach — `spawnSync` always hands the child a pipe. Converting them is what makes every e2e case above executable at all.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && bash -n lib/scripts/sync-wiki-scaffold.sh && bash -n lib/scripts/install-global.sh && bash -n lib/scripts/update-project.sh && node -e '
  const fs=require("fs");
  let bad=0;
  for(const f of ["sync-wiki-scaffold.sh","install-global.sh","update-project.sh"]){
    const bare=fs.readFileSync("lib/scripts/"+f,"utf8").split("\n")
      .filter(l=>/\[\s*!?\s*-t 0\s*\]/.test(l)&&!/^\s*#/.test(l));
    console.log((bare.length===0?"OK   ":"BARE ")+f+(bare.length?": "+bare.join(" | "):""));
    if(bare.length)bad++;
  }
  console.log(bad===0?"NO BARE -t 0 IN ANY OF THE THREE":"FAILURES: "+bad);
  process.exit(bad===0?0:1);'
  ```
- **Expected Result**: All three `bash -n` calls exit silently, then three `OK` lines and `NO BARE -t 0 IN ANY OF THE THREE`. `install-global.sh`'s detection now lives inside `prompt_yn_sticky`; `update-project.sh` calls `has_tty` directly; `sync-wiki-scaffold.sh` never had one.
- **Repeatable Unit Test**: Not applicable: a syntax and structural gate. Its behavioural consequence is that the e2e cases above are reachable at all, so a regression turns them red immediately.
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-004: `install-global.sh` still passes its own suite after gaining the `lib.sh` source
- **Description**: The task discovered that `test/install-global.test.js`'s `buildTemplate()` copies a fixed file list and did **not** include `lib.sh`, so the new `. "$SCRIPT_DIR/lib.sh"` would have aborted all 7 of its tests under `set -euo pipefail`. `lib.sh` + `bootstrap-prefs.js` + the schema were added to that copy list so the harness exercises the real sticky path instead of degrading to `unset` / no-op.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test test/install-global.test.js
  ```
- **Expected Result**: 7 tests, 7 pass, 0 fail, 0 skipped — including the six-step order check, the settings merges, and the idempotent second run.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` (pre-existing; its `buildTemplate()` copy list was extended by TASK-045 step 3)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-005: the full suite is green with no new skips
- **Description**: The Phase-1 bijection skip is gone; a skip reappearing is a regression, not a neutral outcome.
- **Steps**:
  1. Run `npm test` and read the trailer counts.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && npm test
  ```
- **Expected Result**: `fail 0` and `skipped 0`. Test count is **260** — 255 after UAT-044 plus the 5 tests this UAT added.
- **Repeatable Unit Test**: Not applicable: this case *is* the repeatable suite.
- [x] Pass <!-- 2026-08-06 -->

---

## Notes

**Unit tests created by this UAT** — 5 added to `test/prompt-stickiness.test.js`.
None of the three TASK-045 prompt sites had **any** stickiness coverage before
this: `test/install-global.test.js` drives the script but never touches the
orphan-skills prompt, and neither `sync-wiki-scaffold.sh`'s guide ladder nor
`update-project.sh`'s acknowledgement ladder was exercised at all.

| Test | Covers |
|---|---|
| `sync-wiki-scaffold.sh e2e: guides.* keys are built from the loop variable…` | computed dynamic keys + presence-beats-store |
| `sync-wiki-scaffold.sh e2e: a stored true delivers the guide on a NON-INTERACTIVE run` | the store-before-`INTERACTIVE` ordering |
| `install-global.sh e2e: a skills.pruneOrphans decline is remembered…` | the global-selector decline round trip |
| `update-project.sh e2e: update.legacyDocsAck records true only — a decline writes NOTHING` | the write asymmetry |
| `update-project.sh e2e: a stored false is still honoured on READ…` | the read half of the same asymmetry |

**Both load-bearing claims were proven falsifiable by mutation**, then the sources
restored and verified byte-identical by SHA-256 — necessary rather than
ceremonial, since much of this work is untracked and `git diff` proves nothing.
