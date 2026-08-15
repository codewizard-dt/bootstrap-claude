---
id: UAT-038
aliases: [UAT-038]
title: "UAT: Fake-HOME end-to-end verification of resilient hook install + hooks wiring, and the minor release"
status: passed
task: TASK-038
created: 2026-07-31
updated: 2026-07-31
---

# UAT-038 — UAT: Fake-HOME end-to-end verification of resilient hook install + hooks wiring, and the minor release

implements::[[TASK-038]]

> **Source task**: [[TASK-038]]
> **Generated**: 2026-07-31

TASK-038 was itself the ROADMAP-004 verification gate: it ran the plan's full verification matrix (recorded per-step in the task file) and cut release commit `b85cbe9`. This UAT is therefore **confirmation-of-record**: it verifies the release deliverables exist exactly as recorded, and spot re-runs only the fake-HOME idempotency check. It deliberately does **not** re-run the full matrix — that behavior is covered by the repeatable suite (`test/install-global.test.js`, `test/settings-hooks.test.js`, and siblings), which UAT-CLI-004 executes.

---

## Prerequisites

- [x] Run from the repo root: `/Users/davidtaylor/Repositories/bootstrap-claude`
- [x] **SAFETY (non-negotiable): UAT-CLI-006 runs the installer only against a scratch `HOME` from `mktemp -d` — never the real `$HOME`.** The real `~/.claude` must never be read or written by these tests.
- [x] `git`, `node`, `npm`, `rsync`, and `shasum` available on PATH
- [x] Do **not** `git push` and do **not** `npm publish` at any point — the release commit staying local is part of what is being verified (publishing is the user's step; npm login was reported expired)

---

## Test Cases

### UAT-CLI-001: Release commit b85cbe9 exists on main with the exact [minor] style and both trailers
- **Description**: Confirms the TASK-038 step 6 deliverable — the release commit — exists, sits on `main`, uses the established `[minor] Release X.Y.0: …` summary style, and carries both repo-convention trailers.
- **Steps**:
  1. Run:
     ```bash
     git show -s --format='%H%n%B' b85cbe9
     ```
  2. Run:
     ```bash
     git branch --contains b85cbe9
     ```
- **Expected Result**: Full hash `b85cbe9860fff9807c3c0c740fc0740eb02c165e`. Subject line starts `[minor] Release 2.17.0:` and summarizes the MCP-failure-proof install ordering, the `settings-hooks.json` + `merge-settings-hooks.js` hooks wiring ("template owns its blocks"), and the test-count delta `108→141`. Body contains both trailers verbatim: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01Fd8yWSCB17f29xCzTXJqE5`. `git branch --contains` lists `main`.
- **Repeatable Unit Test**: Not applicable: git-history record fact, not program logic
- [x] Pass <!-- 2026-07-31 -->

### UAT-CLI-002: Commit is the tip of main, exactly one ahead of origin/main (unpushed by design), and the code tree is clean
- **Description**: Confirms the release commit is `HEAD` of `main`, that it has **not** been pushed (the deliberate stopping point — publish is left to the user), and that no code/tooling files are modified outside the wiki bookkeeping produced by this UAT itself.
- **Steps**:
  1. Run:
     ```bash
     git rev-parse HEAD main origin/main
     ```
  2. Run:
     ```bash
     git log --oneline origin/main..main
     ```
  3. Run:
     ```bash
     git status --porcelain
     ```
- **Expected Result**: `HEAD` and `main` both resolve to `b85cbe9860fff9807c3c0c740fc0740eb02c165e`; `origin/main` resolves to `790867608833a7d52fa634143d62aca776c9a7b9` (v2.16.0). `origin/main..main` lists exactly one commit: `b85cbe9`. `git status --porcelain` reports **only** paths created or edited after the release commit by this UAT's generation: `test/npm-pack-contents.test.js`, `wiki/work/uat/UAT-038-hooks-wiring-release.md`, `wiki/work/uat/index.md`, `wiki/work/tasks/TASK-038-hooks-wiring-release.md`, and `wiki/log.md` — nothing else (in particular no modified `lib/`, `bin/`, or `package.json`).
- **Repeatable Unit Test**: Not applicable: git-history/working-tree record fact, not program logic
- [x] Pass <!-- 2026-07-31 -->

### UAT-CLI-003: package.json says 2.17.0 — in the working tree and inside the release commit
- **Description**: Confirms the minor version bump (2.16.0 → 2.17.0) is both committed in `b85cbe9` and live in the working tree.
- **Steps**:
  1. Run:
     ```bash
     node -e "console.log('worktree: '+require('./package.json').version);"
     ```
  2. Run:
     ```bash
     git show b85cbe9:package.json
     ```
- **Expected Result**: Step 1 prints `worktree: 2.17.0`. Step 2 shows `"version": "2.17.0"` (and `"name": "@codewizard-dt/bootstrap"`).
- **Repeatable Unit Test**: Not applicable: release-record fact; version is intentionally hand-bumped per release
- [x] Pass <!-- 2026-07-31 -->

### UAT-CLI-004: npm test fully green — the repeatable suite that covers the verification matrix passes
- **Description**: Confirms the recorded 141/141 result still holds. The full behavioral matrix (fake-HOME install, idempotent merges, MCP-failure resilience, missing-`lib/hooks` warning) lives in this suite — passing here is what licenses this UAT to stay lean.
- **Steps**:
  1. Run:
     ```bash
     npm test
     ```
- **Expected Result**: `fail 0`, `cancelled 0`. At release commit `b85cbe9` the suite was 141 tests; this UAT added `test/npm-pack-contents.test.js` (+3), so a run from the current tree reports `tests 144` / `pass 144`. Any failure is a regression to reopen upstream (TASK-034–037), not to patch here.
- **Repeatable Unit Test**: Not applicable: this case *is* the repeatable suite run
- [x] Pass <!-- 2026-07-31 -->

### UAT-CLI-005: Tarball ships settings-hooks.json + merge-settings-hooks.js with no landing-zone/PDF leakage
- **Description**: Confirms TASK-038 step 5 — the new hooks-wiring template and merge script are in the published tarball alongside the deny template, and nothing from `raw/research/`, `raw/companies/`, or any `raw/*.pdf` leaks in. Dry-run only; nothing is published.
- **Steps**:
  1. Run:
     ```bash
     npm pack --dry-run --json 2>/dev/null | node -e "var d='';process.stdin.on('data',function(c){d+=c;});process.stdin.on('end',function(){var files=JSON.parse(d)[0].files.map(function(f){return f.path;});['lib/scripts/templates/settings-hooks.json','lib/scripts/merge-settings-hooks.js','lib/scripts/templates/settings-deny.json'].forEach(function(p){console.log(p+': '+(files.indexOf(p)!==-1));});var leaks=files.filter(function(p){return p.indexOf('raw/research/')===0||p.indexOf('raw/companies/')===0||/\.pdf\$/i.test(p);});console.log('leaks: '+leaks.length);console.log('total: '+files.length);});"
     ```
- **Expected Result**: All three template/script paths print `: true`; `leaks: 0`; `total: 188` (the packed-file count recorded at the release commit — `test/` and `wiki/` are outside the `files` allowlist, so this UAT's own additions do not change it).
- **Repeatable Unit Test**: Created: `test/npm-pack-contents.test.js` (3 tests: pack succeeds, hooks-wiring artifacts ship, no landing-zone/PDF leakage)
- [x] Pass <!-- 2026-07-31 -->

### UAT-CLI-006: Fake-HOME idempotency spot re-run — second install is a byte-identical no-op (scratch HOME only)
- **Description**: Live spot re-run of the TASK-038 step 2 idempotency check: install twice into a throwaway `HOME`; the second run must print all three no-op merge outcomes and leave `settings.json` byte-identical. **Runs only against a `mktemp -d` scratch HOME.**
- **Steps**:
  1. Create the scratch HOME and run the installer twice, hashing `settings.json` after each run:
     ```bash
     UAT_TMP="$(mktemp -d)"
     HOME="$UAT_TMP/home" bash lib/scripts/install-global.sh --skip-mcps >"$UAT_TMP/run1.log" 2>&1; echo "run1=$?"
     shasum -a 256 "$UAT_TMP/home/.claude/settings.json"
     HOME="$UAT_TMP/home" bash lib/scripts/install-global.sh --skip-mcps >"$UAT_TMP/run2.log" 2>&1; echo "run2=$?"
     shasum -a 256 "$UAT_TMP/home/.claude/settings.json"
     ```
  2. Assert the second run printed all three no-op outcomes:
     ```bash
     node -e "var t=require('fs').readFileSync(process.argv[1]+'/run2.log','utf8');['settings.json: deny list already up to date','hooks wiring already up to date','\"fileSuggestion\" already set'].forEach(function(s){console.log(JSON.stringify(s)+': '+(t.indexOf(s)!==-1));});" "$UAT_TMP"
     ```
  3. Discard the scratch dir:
     ```bash
     rm -rf "$UAT_TMP"
     ```
- **Expected Result**: `run1=0` and `run2=0`. The two SHA-256 hashes are identical (byte-identical `settings.json` across the re-run). Step 2 prints `true` for all three strings: `settings.json: deny list already up to date`, `hooks wiring already up to date`, and `"fileSuggestion" already set`. The real `$HOME` is never touched.
- **Repeatable Unit Test**: Not applicable: already covered by `test/install-global.test.js` ("a second run is a no-op: \"already up to date\" messages, identical settings.json, no restart nudges") — this case is the live confirmation-of-record spot check the task requires
- [x] Pass <!-- 2026-07-31 -->

---

## Cleanup

- [x] `rm -rf "$UAT_TMP"` for the UAT-CLI-006 scratch dir (nothing outside it was touched; the real `$HOME` and the repo working tree are unmodified by these tests).
