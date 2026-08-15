---
id: UAT-044
aliases: [UAT-044]
title: "UAT: Wire the install-mcps.sh prompt sites to the preference store"
status: passed
task: TASK-044
created: 2026-08-06
updated: 2026-08-06
---

# UAT-044 — UAT: Wire the install-mcps.sh prompt sites to the preference store

implements::[[TASK-044]]

> **Source task**: [[TASK-044]]
> **Generated**: 2026-08-06

---

## Scope note

TASK-044 routes eight preference keys through the TASK-043 helpers. The headline
item is the **Playwright conflict menu** — the single worst prompt in the
roadmap, which re-asked on *every* run no matter what the user answered, because
options `[1]` and `[2]` both leave a registered `playwright-shared` plus a live
project `playwright` and the gating condition cannot tell those end states apart.

It also carries the one **real defect found during implementation**: the store's
grammar is `shared | alongside | skip` (names, so an answer survives a menu
reorder) while the original `case` matched the digits `1` / `2` / `*`. A stored
name fed into the digit comparison misses every branch, falls through to `*`, and
**silently behaves like `skip`** — the user's answer discarded, no error, no
visible difference from a correct run. UAT-EDGE-001 is the guard against that
returning.

**Hermeticity, and no real MCP registrations.** `install-mcps.sh` exists to shell
out to `claude mcp`, so the e2e cases stub `claude` and `uname` onto `PATH`: the
`claude` stub logs its argv and answers `mcp get` from an env var, and `uname`
reports `Linux` so `_add_playwright` takes its one-line stdio branch instead of
running `npm install -g` and `launchctl`. No real MCP is registered, no real
`~/.claude/bootstrap-prefs.json` is read or written, and this repo's `.gitignore`
and `.git/info/exclude` are hash-guarded around every e2e case.

---

## Prerequisites

- [ ] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude`; `node`, `bash`, and `git` on `PATH`
- [ ] TASK-043's helpers present in `lib/scripts/lib.sh` (`prompt_yn_sticky`, `prompt_choice_sticky`, `has_tty`, `prefs_get`)
- [ ] `npm test` green before starting

---

## Test Cases

### UAT-INT-001: all eight keys are wired, each at the selector its schema scope mandates
- **Description**: The roadmap says "six prompt sites"; the schema is the authority and there are eight keys across seven prompt sites plus the shared scope question. A key wired at the wrong layer is invisible in normal use — it simply never reads back what it wrote.
- **Steps**:
  1. Run the command below. Three keys reach their helper as **positional arguments** to `register_optional_mcp` (`$6` / `$7`), so their `--global` selector is applied inside the wrapper, not at the call site — the check looks in the right place for each.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs");
  const k=JSON.parse(fs.readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));
  const keys=k.keys||k;
  const s=fs.readFileSync("lib/scripts/install-mcps.sh","utf8");
  const w=s.match(/register_optional_mcp\(\) \{[\s\S]*?\n\}/)[0];
  const wrapper={"mcp.braveSearch":/prompt_yn_sticky "\$pref_key" --global/.test(w),
   "mcp.context7":/prompt_yn_sticky "\$pref_key" --global/.test(w),
   "mcp.context7Scope":/prompt_scope "\$name" "\$scope_pref_key" --global/.test(w)};
  const EIGHT=["mcp.serenaMigrate","mcp.serena","mcp.braveSearch","mcp.context7","mcp.context7Scope","mcp.playwright","mcp.playwrightConflict","mcp.playwrightReplace"];
  let bad=0;
  for(const key of EIGHT){
    const scope=keys[key].scope;
    let ok,how;
    if(key in wrapper){ok=wrapper[key];how="via register_optional_mcp wrapper (--global)";}
    else{const want=scope==="global"?"--global":"PROJECT_DIR";
      ok=s.split("\n").filter(l=>l.indexOf(key)!==-1&&!/^\s*#/.test(l)).some(l=>l.indexOf(want)!==-1);
      how="direct call site, selector "+want;}
    if(!ok)bad++;
    console.log((ok?"OK   ":"BAD  ")+key+"  scope="+scope+"  "+how);
  }
  console.log(bad===0?"ALL EIGHT KEYS WIRED AT THEIR SCHEMA SCOPE":"FAILURES: "+bad);
  process.exit(bad===0?0:1);'
  ```
- **Expected Result**: Eight `OK` lines — `mcp.serenaMigrate`, `mcp.serena`, `mcp.playwrightConflict`, `mcp.playwrightReplace` at `PROJECT_DIR`; `mcp.playwright` at `--global` directly; `mcp.braveSearch`, `mcp.context7`, `mcp.context7Scope` at `--global` via the wrapper — then `ALL EIGHT KEYS WIRED AT THEIR SCHEMA SCOPE`.
- **Repeatable Unit Test**: Not applicable: a one-time wiring-completeness audit of a shell script's call sites. The behavioural half is covered by the e2e cases below; `test/bootstrap-prefs.test.js`'s schema↔scripts bijection is the permanent anti-drift check and is un-skipped by TASK-047.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-001: the conflict menu stores the NAME for a digit reply, and is never asked twice
- **Scenario**: The roadmap's headline bug plus the name-vs-digit defect, in one flow. Run 1 answers the menu with the **digit** `1`; run 2 supplies **empty stdin**, so if the menu fired again EOF would resolve to the declared default `skip` and the `shared` branch would not run — making a re-ask impossible to miss.
- **Steps**:
  1. Run the command below. It builds a scratch git project whose **tracked** `.mcp.json` registers `playwright`, which is what reaches the team-owned conflict branch.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="the Playwright conflict menu stores the NAME" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Run 1 reaches the conflict branch, stores `"mcp.playwrightConflict": "shared"` — **the name, not the digit `1`** — registers `playwright-shared`, writes `disabledMcpjsonServers: ["playwright"]` into the project's `.claude/settings.local.json`, and leaves the committed `.mcp.json` unmodified. Run 2 prints the remembered-answer notice on stderr, does **not** print `playwright: left untouched.`, and registers again from the stored answer.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`install-mcps.sh e2e: the Playwright conflict menu stores the NAME for a digit reply, and is never asked twice`). Falsifiability confirmed by reverting the `case` to its pre-fix digit form (`1)` / `2)`), which failed this test alone with `the shared branch did not register playwright-shared`; `install-mcps.sh` was then restored and verified byte-identical by SHA-256.
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-002: a stored `skip` leaves everything untouched and registers nothing
- **Scenario**: `skip` is both a legal stored answer and the declared default, so it shares the `*` branch. A stored `skip` must produce the `left untouched` message and **zero** registrations — and must not be confused with the fall-through that the digit defect produced.
- **Steps**:
  1. Run the command below. stdin is **poisoned** with `1`, which would take the `shared` branch if the menu still fired.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a stored .skip. leaves everything untouched" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. `playwright: left untouched.` appears, the stubbed `claude` log contains **no** `mcp add` calls at all, and no `.claude/settings.local.json` is created in the project.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`install-mcps.sh e2e: a stored skip leaves everything untouched and registers nothing`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-003: a non-interactive run asks nothing and records NOTHING in either layer
- **Scenario**: `install-global.sh` runs this script **without** `--interactive`. That path may read a preference but must never write one — one unattended run baking in a decision is precisely the failure this roadmap removes, and there would be no prompt left to change it with.
- **Steps**:
  1. Run the command below. It runs the real script with no tty seam and asserts on both layers, checking the companion README as well as the values file.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a non-interactive run asks nothing and records NOTHING" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Neither the scratch HOME nor the scratch project has a values file **or** a companion README afterwards — a companion beside a missing values file would itself be proof a write path ran.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`install-mcps.sh e2e: a non-interactive run asks nothing and records NOTHING in either layer`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-004: a stored decline suppresses the NON-INTERACTIVE auto-install too
- **Scenario**: Before this task the non-interactive branch installed every missing MCP unprompted, so a user who declined Brave Search during an interactive `setup` would have it silently installed by the very next `bootstrap install`. Reading the stored decline is allowed on this path; writing is not.
- **Steps**:
  1. Run the command below. It seeds `mcp.braveSearch: false` and fingerprints the store around a non-interactive run.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a stored decline suppresses the NON-INTERACTIVE" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 1 test, 1 pass, 0 fail. Stdout carries `brave-search: skipped (remembered decline — change with /bootstrap-config)`, the stubbed `claude` log contains no brave-search registration, and the store is unchanged by bytes **and** mtime.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`install-mcps.sh e2e: a stored decline suppresses the NON-INTERACTIVE auto-install too`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-002: the conflict `case` branches on names only, in the printed menu order
- **Description**: The structural half of the name-vs-digit defect. The digit→name mapping is **positional**, so the trailing name list must stay in the printed menu order — a mismatch there silently swaps two answers, which no single-answer test would catch.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs");
  const s=fs.readFileSync("lib/scripts/install-mcps.sh","utf8");
  const c=s.match(/case "\$choice" in[\s\S]*?esac/)[0];
  const digit=/^\s*[12]\)/m.test(c);
  const call=s.match(/prompt_choice_sticky mcp\.playwrightConflict[^\n]*/)[0];
  const names=call.trim().replace(/\)"\s*$/,"").split(/\s+/).slice(-3);
  const branches=(c.match(/^\s*([a-z|*]+)\)/gm)||[]).map(x=>x.trim());
  console.log("case branches      : "+JSON.stringify(branches));
  console.log("positional names   : "+JSON.stringify(names));
  console.log("digit branch present: "+digit);
  const ok=!digit && JSON.stringify(names)===JSON.stringify(["shared","alongside","skip"]);
  console.log(ok?"NAMES ONLY, ORDER MATCHES MENU":"DEFECT");
  process.exit(ok?0:1);'
  ```
- **Expected Result**: `case branches : ["shared)","alongside)","skip|*)"]`, `positional names : ["shared","alongside","skip"]`, `digit branch present: false`, then `NAMES ONLY, ORDER MATCHES MENU`. Menu order is `[1]` disable-the-project-one → `shared`, `[2]` alongside → `alongside`, `[3]` don't touch → `skip`.
- **Repeatable Unit Test**: Not applicable: the behavioural consequence is already pinned by UAT-EDGE-001, which fails on exactly this mutation. A second static assertion of the same fact would double the maintenance cost of a future menu change without adding coverage.
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-003: the four schema citations this task moved are accurate
- **Description**: The wiring shifted four prompts (`:286`→`:328`, `:295`→`:341`, `:415`→`:501`, `:434`→`:522`). The task notes record the trap that bit this once already: Serena's `search_for_pattern` reports **0-based** lines while the citations are **1-based**, so renumbering straight from a search result lands every pin one line early.
- **Steps**:
  1. Run the command below — it reads each citation out of the schema and checks the line it names actually contains that prompt.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs");
  const k=JSON.parse(fs.readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));
  const keys=k.keys||k;
  const pins={"mcp.serenaMigrate":"serena: found in this project","mcp.serena":"Install Serena MCP",
   "mcp.playwrightConflict":"How should we proceed? [1/2/3]","mcp.playwrightReplace":"Replace it with the bootstrap shared server"};
  const src=fs.readFileSync("lib/scripts/install-mcps.sh","utf8").split("\n");
  let bad=0;
  for(const key of Object.keys(pins)){
    const m=(keys[key].detail||"").match(/install-mcps\.sh:(\d+)/);
    if(!m){console.log("NO CITATION  "+key);bad++;continue;}
    const n=Number(m[1]);
    const ok=(src[n-1]||"").indexOf(pins[key])!==-1;
    console.log((ok?"OK   ":"STALE")+"  "+key+" -> install-mcps.sh:"+n);
    if(!ok){console.log("        line is: "+JSON.stringify((src[n-1]||"").slice(0,110)));bad++;}
  }
  console.log(bad===0?"ALL 4 CITATIONS ACCURATE":"STALE CITATIONS: "+bad);
  process.exit(bad===0?0:1);'
  ```
- **Expected Result**: Four `OK` lines pointing at `install-mcps.sh:328`, `:341`, `:501`, `:522`, then `ALL 4 CITATIONS ACCURATE`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`CITATION_PINS`, pre-existing — the four rows were updated by TASK-044 step 8 and are asserted on every run)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-004: the tty seam is adopted and the script still parses
- **Description**: Step 7 replaced the bare `[ ! -t 0 ]` conflict guard with `! has_tty`. Without that, no test harness can reach the conflict flow at all — `spawnSync` always hands the child a pipe — and every e2e case above would be unreachable.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && bash -n lib/scripts/install-mcps.sh && node -e '
  const fs=require("fs");
  const bare=fs.readFileSync("lib/scripts/install-mcps.sh","utf8").split("\n")
    .filter(l=>/\[\s*!?\s*-t 0\s*\]/.test(l) && !/^\s*#/.test(l));
  console.log(bare.length===0?"NO BARE -t 0 IN CODE (has_tty adopted)":"BARE -t 0 REMAINS: "+bare.join(" | "));
  process.exit(bare.length===0?0:1);'
  ```
- **Expected Result**: `bash -n` exits silently (clean parse), then `NO BARE -t 0 IN CODE (has_tty adopted)`. The comment-line filter is required — the only remaining `-t 0` in the file is inside the comment explaining the change.
- **Repeatable Unit Test**: Not applicable: a syntax and structural gate over a shell script. Its behavioural consequence — that the conflict flow is reachable at all — is what every e2e case above depends on, so a regression here turns them red immediately.
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-005: API keys never reach the preference store
- **Scenario**: `_add_brave` and `_add_context7` prompt for `BRAVE_API_KEY` / `CONTEXT7_API_KEY` with a bare `read`. Making either sticky would write a secret into a plaintext JSON file that this repo also offers to add to `.gitignore` — a secret in the store is the one failure mode with no clean recovery.
- **Steps**:
  1. Run the command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs");
  const k=JSON.parse(fs.readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));
  const keys=Object.keys(k.keys||k);
  const s=fs.readFileSync("lib/scripts/install-mcps.sh","utf8");
  const secretish=keys.filter(x=>/key|token|secret|password/i.test(x));
  const brave=/read -r -p "  BRAVE_API_KEY/.test(s);
  const ctx=/read -r -p "  CONTEXT7_API_KEY/.test(s);
  console.log("schema keys matching key/token/secret/password: "+JSON.stringify(secretish));
  console.log("BRAVE_API_KEY read stays bare (never sticky)   : "+brave);
  console.log("CONTEXT7_API_KEY read stays bare (never sticky): "+ctx);
  const ok=secretish.length===0&&brave&&ctx;
  console.log(ok?"NO SECRET EVER REACHES THE STORE":"DEFECT");
  process.exit(ok?0:1);'
  ```
- **Expected Result**: `[]` for the secret-shaped key scan, `true` for both bare reads, then `NO SECRET EVER REACHES THE STORE`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (the structural no-secrets invariant, pre-existing from UAT-040)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-006: the full suite is green with no new skips
- **Description**: The Phase-1 bijection skip is gone; a skip reappearing is a regression, not a neutral outcome.
- **Steps**:
  1. Run `npm test` and read the trailer counts.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && npm test
  ```
- **Expected Result**: `fail 0` and `skipped 0`. Test count is **255** — 251 after UAT-043 plus the 4 `install-mcps.sh e2e` tests this UAT added.
- **Repeatable Unit Test**: Not applicable: this case *is* the repeatable suite.
- [x] Pass <!-- 2026-08-06 -->

---

## Notes

**Unit tests created by this UAT** — 4 added to `test/prompt-stickiness.test.js`,
in a new `install-mcps.sh e2e` section built on the file's existing
`withGitScratch` harness plus a new stubbed-`PATH` helper (`writeMcpStubs`,
`runInstallMcps`, `seedConflictProject`).

| Test | Covers |
|---|---|
| `…: the Playwright conflict menu stores the NAME for a digit reply, and is never asked twice` | the roadmap's headline bug **and** the name-vs-digit defect |
| `…: a stored skip leaves everything untouched and registers nothing` | `skip` sharing the `*` branch without becoming a fall-through |
| `…: a non-interactive run asks nothing and records NOTHING in either layer` | the load-bearing no-write rule on the `bootstrap install` path |
| `…: a stored decline suppresses the NON-INTERACTIVE auto-install too` | the silent-reinstall regression |

**This filled a genuine coverage hole.** TASK-047 built e2e coverage for
`merge-gitignore.sh` but none for `install-mcps.sh`, so the roadmap's single
headline bug — and the one real defect found during implementation — had no
repeatable guard at all; both were verified once, by hand, in TASK-044 step 9.
They are now pinned by tests proven to fail on the pre-fix code.
