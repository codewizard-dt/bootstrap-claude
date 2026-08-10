---
id: UAT-050
title: "UAT: Document the helper, the four-state model, and the full key registry in lib/scripts/README.md"
status: passed
task: TASK-050
created: 2026-08-07
updated: 2026-08-07
---

# UAT-050 — UAT: Document the helper, the four-state model, and the full key registry in lib/scripts/README.md

implements::[[TASK-050]]

> **Source task**: [[TASK-050]]
> **Generated**: 2026-08-07

---

## Scope

TASK-050 is a documentation task with **two non-documentation side effects**, and
those are where the risk is:

1. it changed `askedBy` for `gitCommit.versionBump` and `gitCommit.autoPush` from
   `/git-commit` to `install-global.sh` — a **schema** edit, made to satisfy a
   constraint at `test/bootstrap-prefs.test.js:2389` that forbids naming two
   sites; and
2. it changed `install-global.sh`'s final summary line, which is pinned **twice**
   in `test/install-global.test.js` as exact `stdout.includes(...)` matches.

A mismatch in (2) is the classic "green locally, red in a fake-HOME run" defect,
because the pins only fail when the script is actually executed against a
redirected `HOME`. UAT-INT-002 therefore runs those pins rather than trusting a
string comparison alone — though UAT-EDGE-003 does the static three-way
comparison too, since it localises the fault instantly when they disagree.

The documentation itself is verified by **drift**, not by prose review: the new
19-row registry table was transcribed by hand from the schema, and the task's own
step 8 states the stake — *"A drifted doc table is worse than none: it is the
surface a reader trusts instead of opening the JSON."* That check is promoted to
a permanent test rather than living only here.

---

## Prerequisites

- [ ] `node` on `PATH`; all commands run from the repo root
- [ ] No network required
- [ ] **The real `$HOME` is never written.** `test/install-global.test.js` builds a
      scratch template and an `fs.mkdtemp` HOME per test and runs the installer
      against those; no command in this UAT touches `~/.claude/`

---

## Test Cases

### UAT-EDGE-001: the 19-row registry table matches the schema field-for-field, in both directions
- **Scenario**: The registry was transcribed by hand from
  `templates/bootstrap-prefs-schema.json`. Nothing else in the suite reads
  `lib/scripts/README.md`, so a key added, renamed, re-valued, or re-defaulted in
  the schema leaves the table silently stale — and a confidently wrong table is
  worse than no table, because a reader trusts it *instead of* opening the JSON.
  Covers both directions (a schema key missing from the table, and a table row
  for a key that no longer exists), the per-row fields, the `consumer` grouping,
  the `(pattern)` markers for the two `dynamic` keys, and the 7-cell render that
  proves no `values` pipe leaked.
- **Steps**: Run the promoted test file, which parses both registry tables out of
  the README and diffs them against the schema.
- **Command**:
  ```bash
  node --test test/scripts-readme-prefs-docs.test.js
  ```
- **Expected Result**: `# tests 6`, `# pass 6`, `# fail 0`, `# skipped 0`, exit 0.
- **Repeatable Unit Test**: Created: `test/scripts-readme-prefs-docs.test.js`
- [x] Pass <!-- 2026-08-07 -->
  <!-- tests 6 / pass 6 / fail 0 / skipped 0, exit 0. Proven falsifiable before being trusted: un-escaping the pipe in the mcp.context7Scope Values cell failed 2 independent tests; README restored byte-identical (sha256 5a91b86e00d869a2c4ead992a3b4d827f24f2daa3403adcdd054c923b4f2304e before and after). -->


### UAT-EDGE-002: all five `consumer: skill` keys name `install-global.sh`, and none names two sites
- **Scenario**: This is the schema edit TASK-050 made. The task's reasoning is
  that `askedBy` records the **settling** prompt, and the constraint that decided
  it (`test/bootstrap-prefs.test.js:2389`) requires the value to resolve to
  exactly one real `lib/scripts/` file or one real `lib/skills/<name>/SKILL.md` —
  so the compound `"install-global.sh, /git-commit"` is illegal by construction.
  Asserts the outcome directly: all five skill keys agree, the named file exists,
  and no `askedBy` anywhere carries a comma (the compound form).
- **Steps**: Read the schema, filter to `consumer: skill`, and assert the value,
  the file's existence, and the absence of a compound value across all 19 keys.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert");const s=JSON.parse(fs.readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));const skill=Object.entries(s).filter(([,e])=>e.consumer==="skill");a.strictEqual(skill.length,5,"expected 5 consumer:skill keys, got "+skill.length);for(const [k,e] of skill){a.strictEqual(e.askedBy,"install-global.sh",k+" askedBy is "+e.askedBy);}a.ok(fs.existsSync("lib/scripts/install-global.sh"),"askedBy names a file that does not exist");for(const [k,e] of Object.entries(s)){a.ok(!String(e.askedBy).includes(","),k+" askedBy names two sites: "+e.askedBy);}console.log("PASS all 5 skill keys -> install-global.sh; no compound askedBy in "+Object.keys(s).length+" keys");'
  ```
- **Expected Result**: exits 0, prints
  `PASS all 5 skill keys -> install-global.sh; no compound askedBy in 19 keys`.
- **Repeatable Unit Test**: Not applicable: already covered permanently by
  `test/bootstrap-prefs.test.js:2389` (askedBy resolves to one real site) and
  `:2424` (the skill population is exactly these five) — a third copy would be
  duplication, so this case runs as a direct read instead
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS all 5 skill keys -> install-global.sh; no compound askedBy in 19 keys -->


### UAT-EDGE-003: the summary line and both test pins are character-for-character identical
- **Scenario**: TASK-050 changed one string in three places. The two pins are
  exact `stdout.includes(...)` matches, so a single-character divergence — a
  different separator, a dropped period — turns the suite red only when the
  script is actually run. This localises that fault statically: it compares the
  string the script echoes against both pinned literals and requires exactly two
  pins, so a partial update (one pin edited, one missed) is caught by count as
  well as by content.
- **Steps**: Extract the echoed summary from `install-global.sh`, extract every
  `Global setup complete` literal from the test file, and require all three to be
  the same string.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert");const sh=fs.readFileSync("lib/scripts/install-global.sh","utf8");const m=sh.match(/^echo "(Global setup complete[^"]*)"/m);a.ok(m,"no Global setup complete echo found in install-global.sh");const line=m[1];const t=fs.readFileSync("test/install-global.test.js","utf8");const pins=t.match(/Global setup complete[^\x27]*/g)||[];a.strictEqual(pins.length,2,"expected exactly 2 pins in test/install-global.test.js, found "+pins.length);for(const p of pins){a.strictEqual(p,line,"pin does not match the script line\\n  script: "+line+"\\n  pin:    "+p);}a.ok(line.includes("preferences"),"summary line does not name the preferences steps");console.log("PASS 3-way match: "+line);'
  ```
- **Expected Result**: exits 0, prints `PASS 3-way match: Global setup complete
  (hooks + skills + deny list + hooks wiring + file suggestion + preferences +
  MCPs).`
- **Repeatable Unit Test**: Not applicable: the two pins already *are* the
  repeatable test for this string; this case verifies they agree with their
  source, which is a one-time consequence of TASK-050's edit
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS 3-way match: Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + preferences + MCPs). Exactly 2 pins found, both character-identical to the script literal. -->


### UAT-EDGE-004: the documentation gaps the task was created to close are actually closed
- **Scenario**: TASK-050's objective names specific missing content — the helper
  absent from the helpers table, no four-state model, no installed-layout
  explanation, no companion/secrets rules, no `BUG-0009` cross-reference — plus
  two sentences that were **factually wrong** (the helper described as "not built
  yet", and a claim that the per-key table "is not in this file yet"). Asserts
  each is present or gone by name, so a future edit cannot quietly delete a
  section and leave the file looking complete.
- **Steps**: Assert the helper row, the six required headings, the `BUG-0009`
  link, and the absence of both stale sentences.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert");const B=String.fromCharCode(96);const t=fs.readFileSync("lib/scripts/README.md","utf8");a.ok(!t.includes("not built yet"),"the (not built yet) claim is back");a.ok(!/is not in this file yet/.test(t),"the (table is not in this file yet) claim is back");a.ok(new RegExp("^\\\\| "+B+"bootstrap-prefs\\\\.js"+B+" \\\\|","m").test(t),"bootstrap-prefs.js has no row in the helpers table");for(const h of ["## Preference helper notes","### Two values files, and project wins per key","### The four-state model","### The installed layout is what makes skill keys readable","### The generated companion is output, never input","### No preference key ever holds a secret","### The key registry"]){a.ok(t.includes(h),"missing section: "+h);}a.ok(t.includes("BUG-0009"),"no BUG-0009 cross-reference");console.log("PASS helper row + 7 sections + BUG-0009 present; both stale claims gone");'
  ```
- **Expected Result**: exits 0, prints
  `PASS helper row + 7 sections + BUG-0009 present; both stale claims gone`.
- **Repeatable Unit Test**: Created: `test/scripts-readme-prefs-docs.test.js`
  (the two stale-claim assertions are pinned there permanently; the
  section-presence sweep runs here only)
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS helper row + 7 sections + BUG-0009 present; both stale claims gone -->


### UAT-INT-001: the schema and bijection suite is green with zero skipped
- **Scenario**: The `askedBy` edit touches the file that
  `test/bootstrap-prefs.test.js` asserts hardest against — `askedBy` resolution
  (`:2389`), the skill population (`:2424`), the script↔schema bijection in both
  directions, and the `script:line` citation checks. **Zero skipped is
  load-bearing**: ROADMAP-005 Phase 2 un-skipped the `schema -> scripts`
  bijection, and a re-skip would hide exactly the drift this edit could cause.
- **Steps**: Run the preference suite alone and read the summary counters.
- **Command**:
  ```bash
  node --test test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `# fail 0` and `# skipped 0`, exit 0.
- **Repeatable Unit Test**: Not applicable: this is the unit-test file being run
- [x] Pass <!-- 2026-08-07 -->
  <!-- tests 70 / pass 70 / fail 0 / skipped 0 / todo 0, exit 0 — both bijection directions live, no re-skip -->


### UAT-INT-002: the summary line is proven live, by running the installer against a redirected HOME
- **Scenario**: The static three-way match (UAT-EDGE-003) proves the strings are
  equal; it does **not** prove the line is still reachable. Both pins assert on
  `stdout` from a real `install-global.sh` execution — one on the happy path, one
  after a guarded MCP failure — so only running them proves the script still
  prints it in both paths. Each test builds its own scratch template and
  `fs.mkdtemp` HOME; the real `~/.claude/` is never touched.
- **Steps**: Run the installer suite, which executes the script against scratch
  HOMEs.
- **Command**:
  ```bash
  node --test test/install-global.test.js
  ```
- **Expected Result**: `# fail 0`, `# skipped 0`, exit 0 — including
  `fresh run executes all six steps in the TASK-035 order, MCPs last` and
  `a failing install-mcps.sh warns but the script still exits 0 with local
  installs done`, the two tests carrying the pinned summary line.
- **Repeatable Unit Test**: Not applicable: this is the unit-test file being run
- [x] Pass <!-- 2026-08-07 -->
  <!-- tests 7 / pass 7 / fail 0 / skipped 0, exit 0 — the summary line printed on both the happy path and the guarded-MCP-failure path, against fs.mkdtemp HOMEs. Real ~/.claude/bootstrap-prefs.json verified still ABSENT after the run. -->


### UAT-INT-003: the full suite is green with zero skipped
- **Scenario**: The baseline before this task's UAT was 289/289/0/0. This run adds
  the 6 promoted registry tests, so the expected total is 295. A skip anywhere is
  a regression — pinned independently by
  `test/bootstrap-prefs.test.js:2028` ("no test anywhere in test/ is skipped or
  marked todo").
- **Steps**: Run the whole suite from the repo root.
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `# tests 295`, `# pass 295`, `# fail 0`, `# skipped 0`,
  exit 0.
- **Repeatable Unit Test**: Not applicable: this is the suite runner itself
- [x] Pass <!-- 2026-08-07 -->
  <!-- tests 295 / pass 295 / fail 0 / skipped 0 / todo 0, exit 0 — exactly the predicted 289 + 6 promoted -->


---

## Gaps

- **`STEP_BANNERS` in `test/install-global.test.js:36-43` still lists six
  banners, and its test is still named "all six steps".** `install-global.sh` now
  runs eight steps; step 6 prints
  `Installing preference helper (~/.claude/bootstrap-prefs.js)...` and step 7 its
  own banner, neither of which is in the list. So the step-**order** assertion
  does not cover the two new steps: the summary line now advertises
  `preferences`, but nothing verifies the preference steps run, or run in the
  right place. This is **out of TASK-050's stated scope** — the task's step 7
  scoped the change to the summary line plus its two pins, and it did exactly
  that — so it is reported rather than fixed. Closing it means adding the two
  banners to `STEP_BANNERS` and renaming the test; that is a one-line coverage
  task, and TASK-052 (the end-to-end release gate) is the natural place for it.
