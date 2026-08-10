---
id: UAT-040
title: "UAT: Canonical preference key registry — bootstrap-prefs-schema.json"
status: passed
task: TASK-040
created: 2026-08-06
updated: 2026-08-06
---

# UAT-040 — UAT: Canonical preference key registry — bootstrap-prefs-schema.json

implements::[[TASK-040]]

> **Source task**: [[TASK-040]]
> **Generated**: 2026-08-06

---

## Prerequisites

- [x] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [x] Node.js available on `PATH` (the suite runs `node --test`)
- [x] `npm install` has been run (the suite is zero-dependency but `npm test` needs the scripts block)

**Scope note.** TASK-040 shipped a *data file* plus its shape contract — no reader (TASK-041) and no test file (TASK-042) were in scope. These tests therefore assert facts about `lib/scripts/templates/bootstrap-prefs-schema.json` and its documentation, not about helper behavior.

**Safety.** No test in this file touches `~/.claude/bootstrap-prefs.json`, `~/.claude/settings.json`, or runs any installer. Every check is a read-only static assertion.

---

## Test Cases

### UAT-EDGE-001: The schema is plain JSON, parseable with zero preprocessing
- **Scenario**: The file is consumed by three independent readers, all of which use bare `JSON.parse`. A `$comment` key, a trailing comma, or a stray comment would break every one of them at once.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));console.log("keys",Object.keys(s).length,"| array?",Array.isArray(s),"| nested?",Object.values(s).some(e=>Object.values(e).some(v=>v&&typeof v==="object")))'
  ```
- **Expected Result**: Exits 0 and prints `keys 19 | array? false | nested? false` — a flat object of 19 key→entry pairs, no nested groups, no parse error.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: the template is a flat map of key -> entry, with no nested groups`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-002: Every entry carries all seven required fields; exactly two are dynamic
- **Scenario**: A missing field is invisible until a consumer renders it as `undefined`. The two wildcard entries (`guides.*`, `gitignore.section.*`) must be exactly the two that carry `dynamic: true` — asserted in both directions, so neither a missing flag nor a spurious one passes.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node --test --test-name-pattern='seven required fields|are dynamic, and every dynamic key' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 2`, `fail 0`. Both the required-fields test and the dynamic-key bidirectional test pass.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: every entry carries all seven required fields, and nothing beyond \`dynamic\``, `schema: exactly guides.* and gitignore.section.* are dynamic, and every dynamic key ends in \`.*\``)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-003: Scope and consumer enumerations hold, with the expected populations
- **Scenario**: `scope` drives resolution order in TASK-041 and `consumer` drives how loudly `/bootstrap-config` warns. A typo'd `scope: "user"` would make a key resolve from no layer at all.
- **Steps**:
  1. Run the command below to check the enumerations and print the population split
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));const c=(f,v)=>Object.values(s).filter(e=>e[f]===v).length;console.log("scope global/project/either:",c("scope","global"),c("scope","project"),c("scope","either"));console.log("consumer installer/skill:",c("consumer","installer"),c("consumer","skill"));console.log("all legal:",Object.values(s).every(e=>["global","project","either"].includes(e.scope)&&["installer","skill"].includes(e.consumer)))'
  ```
- **Expected Result**: Prints `scope global/project/either: 5 9 5`, `consumer installer/skill: 14 5`, and `all legal: true`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: every scope is global|project|either and every consumer is installer|skill`, `schema: the consumer:"skill" population is exactly the five behavior-changing keys`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-004: The `.gitignore` declines-only invariant is encoded as a one-value grammar
- **Scenario**: The single most load-bearing design call in the file. `merge-gitignore.sh:11` states *"NOTHING is ever added to a project's .gitignore without asking."* A remembered **yes** would silently append lines on a later run and break it, so `gitignore.section.*` has the one-token grammar `false` — no `true` is a legal stored value. A future reader must not "fix" this as a typo.
- **Steps**:
  1. Confirm the grammar is exactly one token and that token is `false`
  2. Confirm the cited invariant sentence is still present in the script
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));const t=s["gitignore.section.*"].values.split("|").map(x=>x.trim());const src=require("fs").readFileSync("lib/scripts/merge-gitignore.sh","utf8").split("\n");console.log("tokens:",JSON.stringify(t));console.log("detail cites the invariant:",/merge-gitignore\.sh:11/.test(s["gitignore.section.*"].detail));console.log("line 11 holds it:",src[10].includes("NOTHING is ever added"))'
  ```
- **Expected Result**: Prints `tokens: ["false"]`, `detail cites the invariant: true`, `line 11 holds it: true`. A widened grammar (two tokens, or `true`) is a **fail**, not an improvement.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: every values grammar is a closed enumeration; gitignore.section.* has exactly one token, \`false\``)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-005: Three-state keys are NOT subject to the declines-only rule
- **Scenario**: The counterpart to UAT-EDGE-004. `prefs.gitTracking` and `gitCommit.versionBump` are choices among outcomes, not add/skip gates, so they record in all directions and are genuinely asked once. Step 2 of the task requires each to say so in its `detail`.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));for(const k of ["prefs.gitTracking","gitCommit.versionBump"]){const e=s[k];console.log(k,"| tokens:",e.values.split("|").length,"| states the exemption:",/declines-only rule does NOT apply|declines-only rule does not apply/.test(e.detail),"| all three directions:",/all three directions/.test(e.detail))}'
  ```
- **Expected Result**: Both keys print 3 tokens, `states the exemption: true`, and `all three directions: true`.
- **Repeatable Unit Test**: Not applicable: asserts explanatory prose in `detail`, which is deliberately free text — pinning exact wording would ossify the one field meant to be rewritten as understanding improves.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-006: Every `script.sh:NNN` citation still points at the line it claims
- **Scenario**: The task's own step 4 found and fixed **five** stale citations, which is direct evidence this rots fast. Inserting one line above a prompt silently invalidates every citation below it. A drifted citation does not break the key — it sends the next reader to the wrong line, which is how a correct entry starts looking like a lie.
- **Steps**:
  1. Run the pinned citation test, which extracts all `*.sh:NNN` citations from every `detail` and verifies each against the real file
- **Command**:
  ```bash
  node --test --test-name-pattern='script:line citation' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. All 11 citations (`install-mcps.sh:286/295/415/434`, `update-project.sh:46`, `merge-gitignore.sh:11/153/313`, `sync-wiki-scaffold.sh:81`, `lib.sh:198`, `install-global.sh:59`) resolve to lines still containing their pinned substring.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: every script:line citation in a detail still points at the line it claims`) — new in this UAT; failure proven both ways (an unpinned new citation, and a pin whose line content changed).
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-007: `mcp.context7Scope` matches what `prompt_scope` actually accepts
- **Scenario**: The approved plan specified `user | project | local`, but `prompt_scope` (`lib.sh:194-206`) has no local branch — any reply not starting with `p`/`P` falls through to `user`. The task corrected the grammar to two values. A third value would be unreachable and would validate a `--set` that the installer could never act on.
- **Steps**:
  1. Confirm the schema grammar is two tokens
  2. Confirm `lib.sh` still emits only those two
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));const src=require("fs").readFileSync("lib/scripts/lib.sh","utf8");const fn=src.slice(src.indexOf("prompt_scope()"),src.indexOf("\n}",src.indexOf("prompt_scope()")));const emitted=[...fn.matchAll(/echo "([a-z]+)"/g)].map(m=>m[1]).sort();const grammar=s["mcp.context7Scope"].values.split("|").map(x=>x.trim()).sort();console.log("schema grammar:",JSON.stringify(grammar));console.log("prompt_scope emits:",JSON.stringify(emitted));console.log("they agree:",JSON.stringify(grammar)===JSON.stringify(emitted))'
  ```
- **Expected Result**: Prints `schema grammar: ["project","user"]`, `prompt_scope emits: ["project","user"]`, and `they agree: true` — the grammar is exactly the set of values the function can return, with no unreachable third value.

  > **Probe correction (2026-08-06, during `/uat-auto`).** The originally generated command scanned the function body for the bare word `local` and expected `false`. It returned `true` — because line 195 is `local name reply`, the **bash `local` builtin** declaring variables, not a local-scope branch. The probe measured the wrong thing; `prompt_scope` (`lib.sh:194-206`) genuinely has only `[pP]*`→`project` and `*`→`user`. Replaced with an assertion on the values the function actually emits, which is the real contract. The requirement under test is unchanged.
- **Repeatable Unit Test**: Not applicable: cross-file agreement between a schema grammar and a shell function's fallthrough branches is the kind of check Phase 2's bijection test subsumes once `lib.sh` actually calls the helper; asserting it on unwired code would pin a coincidence.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-008: `gitignore.review` appears nowhere — it was superseded
- **Scenario**: The plan named `gitignore.review` and TASK-030 named `gitignore.offerSectionUpdates` for the *same* prompt. Reintroducing the old name would silently split one question into two keys, so answering one would leave the other prompting forever.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const raw=require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8");console.log("gitignore.review present:",raw.includes("gitignore.review"),"| canonical key present:",Object.keys(JSON.parse(raw)).includes("gitignore.offerSectionUpdates"))'
  ```
- **Expected Result**: Prints `gitignore.review present: false | canonical key present: true`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: \`gitignore.review\` does not appear — it was superseded by gitignore.offerSectionUpdates`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-009: No API-key prompt produced a schema key, and no key can hold a secret
- **Scenario**: The Brave and Context7 API-key prompts (`install-mcps.sh:111`, `:146`) are permanently out of the store. The invariant is structural, not a keyword ban: two `detail` strings legitimately *name* an API key in order to deny storing it.
- **Steps**:
  1. Run the structural no-secrets test
- **Command**:
  ```bash
  node --test --test-name-pattern='no preference key can hold a secret' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. No key *name* matches `/key|token|secret|password|credential/i`; every `values` is a closed enumeration of literal tokens (so `--set` structurally cannot store an arbitrary string); and every entry whose `detail` names a credential also carries an explicit denial.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: no preference key can hold a secret — no secret-shaped names, no open grammars, and every API-key mention is a denial`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-010: Every `askedBy` resolves to a real script or slash command
- **Scenario**: `askedBy` is the only pointer from a stored answer back to the prompt that produced it, and it is what the companion README prints. A stale one is invisible — the key keeps working and the breadcrumb quietly leads nowhere.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node --test --test-name-pattern='every askedBy names a real' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. All 19 entries resolve — 6 scripts under `lib/scripts/` plus `/git-commit` → `lib/skills/git-commit/SKILL.md`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: every askedBy names a real lib/scripts/ file or a real lib/skills/ command`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-011: Defaults encode today's behavior, and every default is legal for its own key
- **Scenario**: TASK-030's compatibility guarantee: an unanswered key must not change what a user sees. So `research.persistToRaw` defaults `true`, `gitCommit.autoPush` defaults `false`, `gitCommit.versionBump` defaults `"auto"`, and **every `installer` key defaults `null`** — an unasked installer question should be *asked*, not silently answered. A stringified `"true"` default would be truthy in every shell test.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));const bad=Object.entries(s).filter(([,e])=>e.consumer==="installer"&&e.scope!=="either"&&e.default!==null&&!(e.askedBy==="merge-gitignore.sh"&&e.values.split("|").length===3));console.log("autoPush:",JSON.stringify(s["gitCommit.autoPush"].default),"| persistToRaw:",JSON.stringify(s["research.persistToRaw"].default),"| versionBump:",JSON.stringify(s["gitCommit.versionBump"].default));console.log("non-null installer defaults (expect only prefs.gitTracking):",Object.entries(s).filter(([,e])=>e.consumer==="installer"&&e.default!==null).map(([k])=>k))'
  ```
- **Expected Result**: Prints `autoPush: false | persistToRaw: true | versionBump: "auto"` (JSON booleans and a JSON string, not `"false"`/`"true"`), and the non-null installer default list is exactly `[]`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: every non-null default is one of its own entry's legal values, with the right JSON type`, plus the `the keys these round-trip tests rely on still carry the schema default they assume` tripwire)
- [x] Pass <!-- 2026-08-06 -->
- **Correction <!-- 2026-08-06 -->:** Original expectation above read *"the non-null installer default list is exactly `[ 'prefs.gitTracking' ]`"*. `TASK-046` changed `prefs.gitTracking`'s schema `default` from `"exclude"` to `null` (`lib/scripts/templates/bootstrap-prefs-schema.json:62`) because a non-null default made the new three-way git-tracking menu unreachable — `prompt_choice_sticky` saw a remembered hit on the unanswered key and resolved silently instead of asking. The list of `consumer: installer` keys with a non-null `default` is therefore now empty, and this UAT is manual/archived (never run by `npm test`), so nothing enforced the stale claim. Corrected above to `[]`. See `TASK-046` Notes for the full departure record.

### UAT-EDGE-012: The three git-adjacent keys cross-reference each other
- **Scenario**: Step 1's final checkbox. `gitignore.infoExclude`, `gitignore.offerSectionUpdates`, and `prefs.gitTracking` all touch "how git treats files here" but answer different questions. A user reading one in isolation will guess wrong about the others — most damagingly by assuming that declining the section pass also disabled the `.git/info/exclude` mechanism, which it does not.
- **Steps**:
  1. Run the cross-reference test
- **Command**:
  ```bash
  node --test --test-name-pattern='cross-reference each other' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. `gitignore.infoExclude` names both `gitignore.offerSectionUpdates` and `prefs.gitTracking`; the other two each name `gitignore.infoExclude`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: the three git-adjacent keys cross-reference each other in their detail text`) — new in this UAT; failure proven by removing one cross-link.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-013: The shape contract is documented in `lib/scripts/README.md`
- **Scenario**: Step 3. JSON carries no comments, so the file's rules have to live somewhere a reader will find them. The README must cover the flat shape, the eight fields, exact-then-wildcard lookup, the one-value gitignore grammar, `default` as never-written metadata, and the unrecognized-key round-trip guarantee.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const r=require("fs").readFileSync("lib/scripts/README.md","utf8");const need={"section heading":/## Preference-schema notes/,"templates table row":/\| .templates\/bootstrap-prefs-schema\.json. \|/,"exact-then-wildcard":/exact/i,"one-value grammar":/merge-gitignore\.sh:11|false-only|one-value/i,"default is metadata":/never written|not written|metadata/i,"unrecognized round-trip":/unrecognized/i};for(const[n,re]of Object.entries(need))console.log(re.test(r)?"OK  ":"MISS",n)'
  ```
- **Expected Result**: Every line prints `OK` — six checks, no `MISS`.

  > **Probe correction (2026-08-06, during `/uat-auto`).** The originally generated command matched the markdown table cell with literal **backticks** inside the regex. `interpreter-indirection-guard.js` blocks any `node -e` payload containing backticks, since it cannot distinguish a regex literal from a command substitution — the block is correct and the guard is working as designed. The two backticks are replaced with `.` (any char), which matches the same cell without tripping the guard.
- **Repeatable Unit Test**: Not applicable: asserts that documentation prose exists and covers named topics; a regex pin on README wording would fail on every legitimate rewrite while catching nothing a reader would care about.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-014: `CLAUDE.md` is deliberately untouched — Phase 4 owns the docs pass
- **Scenario**: Step 3's third checkbox. ROADMAP-005 Phase 4 adds the helper and the schema to `CLAUDE.md` Key Files together, in one edit. A premature entry here would document a helper that did not exist at the time.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const c=require("fs").readFileSync("CLAUDE.md","utf8");console.log("CLAUDE.md mentions bootstrap-prefs:",/bootstrap-prefs/.test(c))'
  ```
- **Expected Result**: Prints `CLAUDE.md mentions bootstrap-prefs: false`.
- **Repeatable Unit Test**: Not applicable: asserts the *absence* of a docs entry that ROADMAP-005 Phase 4 will deliberately add. Pinning it as a test would turn a scheduled edit into a build break.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-015: The schema ships in the npm tarball with no manifest change
- **Scenario**: `package.json` `files` already ships `lib/`, so the template should be included without a manifest edit — but `raw/` negations exist in that field, so this is verified rather than assumed.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  npm pack --dry-run 2>&1 | grep -c 'lib/scripts/templates/bootstrap-prefs-schema.json'
  ```
- **Expected Result**: Prints `1` — exactly one match, confirming the schema is in the tarball.
- **Repeatable Unit Test**: Blocked: `test/npm-pack-contents.test.js` is the right home for this pin, but that file is currently **untracked** and TASK-040's Notes explicitly defer pinning the schema into it to ROADMAP-005 Phase 4.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-016: The full suite is green and the schema added no regressions
- **Scenario**: TASK-040 shipped data only. The suite must be green end to end, with the one deliberate skip (TASK-042's `schema -> scripts` bijection, un-skipped at Phase 2) and no failures.
- **Steps**:
  1. Run the full suite
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `fail 0` and `skipped 1`. The single skip is the schema→scripts bijection, which reports its reason naming ROADMAP-005 Phase 2 — its body is complete, not stubbed, and it **does not block completion**.
- **Repeatable Unit Test**: Not applicable: this case *is* the test suite.
- [x] Pass <!-- 2026-08-06 -->

---

## Gaps

- **`detail` prose quality is not asserted.** UAT-EDGE-005, -007, -013 and -014 check that the right topics are named, not that the explanations are good. `detail` is the field that stops a user answering a bare key name blind, and its quality is only reviewable by a human. `/bootstrap-config` (Phase 3) is where a bad `detail` would actually be felt.
- **The `gitignore.section.*` slug rule is verified against the helper, not the shell.** `test/bootstrap-prefs.test.js` pins the slugifier (including the em-dash case) via `bootstrap-prefs.js --section-key`, but no shell caller exists yet. Phase 2 must make `merge-gitignore.sh` shell out to `--section-key` rather than reimplement the rule in `awk`/`sed`; until then the two-implementation risk is open by design.
