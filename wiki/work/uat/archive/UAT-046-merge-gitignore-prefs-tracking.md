---
id: UAT-046
title: "UAT: merge-gitignore.sh — prefs.gitTracking three-way prompt and declines-only wiring"
status: passed
task: TASK-046
created: 2026-08-06
updated: 2026-08-06
---

# UAT-046 — UAT: merge-gitignore.sh — prefs.gitTracking three-way prompt and declines-only wiring

implements::[[TASK-046]]

> **Source task**: [[TASK-046]]
> **Generated**: 2026-08-06

---

## Scope note

The invariant at `merge-gitignore.sh:11` — ***nothing is ever added to a
project's `.gitignore` without asking*** — has to survive this task verbatim.
Everything below is ultimately in service of that.

Three things make this task distinctive:

1. **The declines-only rule lives in the schema data, not at call sites.**
   `gitignore.section.*` has a one-value grammar of `false`, so a `--set true`
   *exits 1*. An accepted section is therefore never recorded, and a section that
   gains new lines in a later template version is still offered by title rather
   than appended silently.
2. **Section keys are computed by `bootstrap-prefs.js --section-key`, never
   slugified in shell.** One banner title carries an **em dash (U+2014)**; a
   byte-wise `[^a-z0-9]` slugifier sees three UTF-8 bytes and emits three dashes,
   producing a key that never matches — so the remembered decline silently stops
   matching and the prompt re-asks forever.
3. **`prefs.gitTracking` carried the second real defect found in Phase 2.** It
   shipped with `"default": "exclude"`; because `--get` resolves *through* the
   default, an unanswered key read back as settled, `_sticky_lookup` returned
   `hit:exclude`, and the menu printed and then immediately said *using
   remembered answer* — writing both prefs files into `.git/info/exclude` with
   nobody having answered. Fixed by `default: null`; UAT-EDGE-004 and UAT-INT-004
   are the two guards against it returning.

**Hermeticity.** This is the one script whose entire job is writing to a
`.gitignore` and a `.git/info/exclude`, and this checkout has both. Every e2e
case runs under `withGitScratch`, which hashes **this repo's** two files before
the body and re-hashes after — so a leaked relative path fails an assertion
instead of landing as an unreviewed edit in the working tree.

---

## Prerequisites

- [ ] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude`; `node`, `bash`, `git` on `PATH`
- [ ] TASK-043's helpers present in `lib/scripts/lib.sh`
- [ ] `npm test` green before starting

---

## Test Cases

### UAT-EDGE-001: an accepted section records NO key — the declines-only invariant, end to end
- **Scenario**: The promise at the top of the script. A remembered `true` would append lines on a later run with nobody asked, which is exactly what the one-token grammar exists to prevent. **Every** section is accepted, so the assertion is that the whole `gitignore.section.*` family is empty — not merely that one key is missing.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="an accepted section records NO gitignore.section" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Every entry of every section is present in `.gitignore` (the accepts really happened), and the store carries **no** `gitignore.section.*` key at all.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`merge-gitignore.sh e2e: an accepted section records NO gitignore.section.* key — declines-only, end to end`, pre-existing from TASK-047)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-002: a declined section stores exactly the key `--section-key` computes, em dash included
- **Scenario**: The Unicode slug trap. Declining **every** section makes this the strongest form of the claim: the whole stored key set is compared against the whole set the CLI computes from the same titles, in order.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a declined section stores exactly the key" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. The stored keys equal `--section-key <title>` for every declined title; the em-dash section is recorded under a key containing **one** dash where the em dash was (asserted by `doesNotMatch(/--/)`); and a second run fed poison stdin offers nothing, reports every section as skipped-by-remembered-answer under the computed key, and leaves `.gitignore`, `.git/info/exclude` and the store all byte-identical.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`merge-gitignore.sh e2e: a declined section stores exactly the key --section-key computes, and a second run does not offer it`, pre-existing from TASK-047)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-003: the one-token grammar rejects `--set true` on a section key, and no call site attempts it
- **Scenario**: The declines-only rule is enforced by the data. This checks both halves — that the grammar actually refuses, and that no call site tries to work around it.
- **Steps**:
  1. Run the command below in a scratch project with a redirected `HOME`.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude
  S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
  export HOME="$S/home"; mkdir -p "$HOME" "$S/proj"
  export PROJ="$S/proj"
  node lib/scripts/bootstrap-prefs.js --list --project "$PROJ" | tail -1
  KEY="gitignore.section.claude-code-machine-local-mcp-registration-absolute-paths-regenerated-by-setup"
  echo "--- --set true on a section key (must exit 1, write nothing) ---"
  node lib/scripts/bootstrap-prefs.js --set "$KEY" --value true --project "$PROJ"; echo "exit=$?"
  node -e 'const fs=require("fs");const p=process.env.PROJ+"/.claude/bootstrap-prefs.json";console.log(fs.existsSync(p)?"WROTE A FILE (defect)":"no file written — grammar rejected it")'
  echo "--- --set false on the same key (must succeed) ---"
  node lib/scripts/bootstrap-prefs.js --set "$KEY" --value false --project "$PROJ"; echo "exit=$?"
  echo "--- no call site ever sets a section key to true ---"
  node -e '
  const fs=require("fs");
  const s=fs.readFileSync("lib/scripts/merge-gitignore.sh","utf8");
  const bad=s.split("\n").filter(l=>/prefs_set/.test(l)&&/SECTION_KEY/.test(l)&&/true/.test(l));
  console.log(bad.length===0?"NO CALL SITE SETS A SECTION KEY TRUE":"DEFECT: "+bad.join(" | "));
  process.exit(bad.length===0?0:1);'
  ```
- **Expected Result**: The `Layers:` line resolves inside the scratch dir. `--set true` prints `Error: "true" is not a legal value … expected one of: false`, `exit=1`, and **no file is written**. `--set false` succeeds with `exit=0`. Then `NO CALL SITE SETS A SECTION KEY TRUE`. Note the em-dash key is spelled with **one** dash — the same key UAT-EDGE-002 asserts.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: every values grammar is a closed enumeration; gitignore.section.* has exactly one token, false`, pre-existing)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-004: `prefs.gitTracking` — each option routes the two prefs paths, and none is re-asked
- **Scenario**: The three-way choice, and the behavioural guard against defect (b). Three **separate** scratch repos, one per option, because the answer is sticky by design — a second repo would read the first's stored choice and never reach the menu. Every section and the exclude question are declined, so the only thing touching either file in each run is the menu answer itself.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="prefs.gitTracking — each option routes" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. `[1]` puts both paths in `.gitignore` under `# bootstrap preferences (remembered installer answers)` and leaves `.git/info/exclude` byte-identical; `[2]` puts both in `.git/info/exclude` under `# bootstrap preferences (machine-local)` and creates **no** `.gitignore`; `[3]` touches neither. Each digit resolves to its **name** in the store (`gitignore` / `exclude` / `neither`), and a second run fed poison stdin re-asks nothing and changes nothing.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`merge-gitignore.sh e2e: prefs.gitTracking — each option routes the two prefs paths to .gitignore, to .git/info/exclude, or nowhere, and none is re-asked`, pre-existing from TASK-047). **Confirmed to be a real guard against defect (b)**: restoring `"default": "exclude"` in the schema made this test fail with `[gitignore] the digit 1 resolved to the wrong name` — the menu resolving without being asked. The schema was restored and verified byte-identical by SHA-256.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-005: a stored `false` master gate skips the section pass but leaves `.git/info/exclude` working
- **Scenario**: The cross-key independence claim. `gitignore.infoExclude`, `gitignore.offerSectionUpdates` and `prefs.gitTracking` are three different questions, cross-referenced in all three directions by the schema precisely so nobody collapses them into one switch. Declining the section pass must leave the exclude mechanism fully working — the most damaging way to get this wrong.
- **Steps**:
  1. Run the command below. It seeds the master gate to `false`, then answers the exclude question yes and chooses `neither` for the menu.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a stored .false. master gate skips the section pass" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Stdout carries `.gitignore: skipped entirely — no sections offered. (remembered answer gitignore.offerSectionUpdates=false …)`, no section is previewed, and no `.gitignore` is created — **but** `.serena/`, `raw/` and `wiki/` all still reach `.git/info/exclude`.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`merge-gitignore.sh e2e: a stored false master gate skips the section pass but leaves .git/info/exclude working`). Falsifiability confirmed by adding `exit 0` to the master gate's `false` branch — the plausible "simplification" — which failed this test with `.serena/ did not reach .git/info/exclude`; `merge-gitignore.sh` was restored and verified byte-identical by SHA-256.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-006: a stored `ask` master gate restores the opening question, and declining it records `false`
- **Scenario**: The third branch of the `scope: either` key. `ask` must always prompt — collapsing it into the resolved default would silently drop the opening question for anyone who deliberately asked to keep being asked.
- **Steps**:
  1. Run the command below. The discriminator is the message text: a remembered skip carries a `(remembered answer …)` suffix and a genuinely-asked decline does not.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a stored .ask. master gate restores the opening question" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Stdout carries the bare `.gitignore: skipped entirely — no sections offered.` line **without** a `(remembered answer …)` suffix, no sections are offered, and the decline records `gitignore.offerSectionUpdates: false` — the declines-only wiring for this prompt.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`merge-gitignore.sh e2e: a stored ask master gate restores the opening question, and declining it records false`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-001: every prompt in the script is answered from scripted stdin, in order
- **Description**: The harness claim the other e2e cases rest on. Accepting exactly one section and declining the rest is the evidence that the run consumes one stdin line per prompt — if stdin were off by a line a *different* section would be merged and the store would carry a different key set. That is stronger than counting prompt strings, which under a pipe never appear at all.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="every prompt is answered from scripted stdin" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Exactly one section is merged, and it is the intended one.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`merge-gitignore.sh e2e: every prompt is answered from scripted stdin, in order, and exactly one section is merged`, pre-existing from TASK-047)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-002: the three schema citations this task moved are accurate, and the tty seam is adopted
- **Description**: The new ladder shifted `Review .gitignore updates?` (`:153` → `:171`) and the exclude prompt (`:313` → `:376`); the invariant sentence at `:11` is in the header comment and correctly did not move. `prefs.gitTracking`'s detail deliberately carries **no** line citation, so no new pin was needed — the citation test fails on an unpinned citation by design.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && bash -n lib/scripts/merge-gitignore.sh && node -e '
  const fs=require("fs");
  const k=JSON.parse(fs.readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));
  const keys=k.keys||k;
  const spec=[["gitignore.section.*","NOTHING is ever added"],
   ["gitignore.offerSectionUpdates","Review .gitignore updates?"],
   ["gitignore.infoExclude","Keep .serena/, raw/, wiki/ out of git on THIS machine"]];
  const src=fs.readFileSync("lib/scripts/merge-gitignore.sh","utf8").split("\n");
  let bad=0;
  for(const row of spec){
    const m=(keys[row[0]].detail||"").match(/merge-gitignore\.sh:(\d+)/);
    if(!m){console.log("NO CITATION  "+row[0]);bad++;continue;}
    const n=Number(m[1]);
    const ok=(src[n-1]||"").indexOf(row[1])!==-1;
    console.log((ok?"OK   ":"STALE")+"  "+row[0]+" -> merge-gitignore.sh:"+n);
    if(!ok)bad++;
  }
  console.log("gitignore.section.* grammar: "+JSON.stringify(keys["gitignore.section.*"].values));
  console.log("prefs.gitTracking default  : "+JSON.stringify(keys["prefs.gitTracking"].default));
  const bare=src.filter(l=>/\[\s*!?\s*-t 0\s*\]/.test(l)&&!/^\s*#/.test(l));
  console.log(bare.length===0?"NO BARE -t 0 IN CODE":"BARE -t 0: "+bare.join(" | "));
  if(bare.length)bad++;
  console.log(bad===0?"ALL STATIC CHECKS PASS":"FAILURES: "+bad);
  process.exit(bad===0?0:1);'
  ```
- **Expected Result**: `bash -n` clean, then three `OK` lines at `merge-gitignore.sh:11`, `:171`, `:376`; the section grammar prints as the single token `"false"`; `prefs.gitTracking default : null`; `NO BARE -t 0 IN CODE`; then `ALL STATIC CHECKS PASS`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`CITATION_PINS` — the two moved rows were updated by TASK-046 step 7 and are asserted on every run)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-003: the three git-adjacent keys still cross-reference each other
- **Description**: Because they are three separate questions that are easy to conflate, the schema documents each one's relationship to the other two. A dropped cross-reference is how the next person collapses them.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="the three git-adjacent keys cross-reference each other" test/bootstrap-prefs.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: the three git-adjacent keys cross-reference each other in their detail text`, pre-existing from UAT-040)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-004: no installer-asked key carries a non-null default — defect (b), generalized
- **Description**: The schema-level guard against the `prefs.gitTracking` defect returning, and against the same mistake being made on any other installer key. `--get` resolves *through* the default, so a non-null default on a key that exists to be asked is indistinguishable from an answer the user never gave — it silences the exact prompt the key was created for. `ask` is not an escape hatch here: `prefs.gitTracking`'s own grammar rejects it, so `null` is the only value meaning "unanswered". The operational default survives at the call site as `prompt_choice_sticky`'s `<default-name>` argument.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="no consumer:.installer. key carries a non-null default" test/bootstrap-prefs.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail — the offender list is empty, and the guard is non-vacuous (installer keys exist to be checked). The rule is deliberately scoped to `consumer: "installer"`: the five `consumer: "skill"` keys are read by slash commands that need a defined starting behaviour, and four of them carry `ask` in their grammar so an unanswered key resolves to "keep asking" rather than to a silent decision.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: no consumer:"installer" key carries a non-null default — a default makes its prompt unreachable`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-005: the full suite is green with no new skips
- **Description**: The Phase-1 bijection skip is gone; a skip reappearing is a regression, not a neutral outcome.
- **Steps**:
  1. Run `npm test` and read the trailer counts.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && npm test
  ```
- **Expected Result**: `fail 0` and `skipped 0`. Test count is **263** — 260 after UAT-045 plus the 3 tests this UAT added.
- **Repeatable Unit Test**: Not applicable: this case *is* the repeatable suite.
- [x] Pass <!-- 2026-08-06 -->

---

## Notes

**This task arrived with the strongest pre-existing coverage in Phase 2.**
TASK-047 had already built four `merge-gitignore.sh` e2e tests covering the
declines-only invariant, the em-dash slug, the scripted-stdin harness, and all
three `prefs.gitTracking` options. So this UAT adds only what was genuinely
missing — **3 tests**:

| Test | File | Covers |
|---|---|---|
| `…: a stored false master gate skips the section pass but leaves .git/info/exclude working` | `test/prompt-stickiness.test.js` | cross-key independence |
| `…: a stored ask master gate restores the opening question, and declining it records false` | `test/prompt-stickiness.test.js` | the `ask` branch of the `scope: either` key |
| `schema: no consumer:"installer" key carries a non-null default…` | `test/bootstrap-prefs.test.js` | defect (b), generalized to every installer key |

The master gate's `true` branch needed no new test — it is the resolved default,
so every pre-existing e2e case already exercises it.

**Both defects verified still fixed.** Defect (b) was confirmed to be genuinely
guarded rather than incidentally passing: restoring `"default": "exclude"` made
UAT-EDGE-004 fail with `the digit 1 resolved to the wrong name`. The new
UAT-INT-004 now also catches it at the schema layer, before any script runs.
