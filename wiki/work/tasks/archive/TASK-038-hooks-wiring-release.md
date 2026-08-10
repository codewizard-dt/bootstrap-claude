---
id: TASK-038
title: "Fake-HOME end-to-end verification of resilient hook install + hooks wiring, and the minor release"
status: done
created: 2026-07-31
updated: 2026-07-31
depends_on: [TASK-034, TASK-035, TASK-036, TASK-037]
blocks: []
parallel_safe_with: []
uat: "[[UAT-038]]"
tags: [release, verification]
---

# TASK-038 — Fake-HOME end-to-end verification of resilient hook install + hooks wiring, and the minor release

derived_from::[[ROADMAP-004]]

## Objective

Close out ROADMAP-004 Phase 3 by proving, end-to-end and against scratch state only, that the resilient hook install + automated `settings.json` hooks-wiring work (TASK-034–TASK-037: `settings-hooks.json` template, `merge-settings-hooks.js`, the reordered/guarded `install-global.sh` and `lib.sh`, and the updated READMEs) actually behaves as specified in the approved plan (`/Users/davidtaylor/.claude/plans/ok-now-parallel-cerf.md`, "Verification" section), then cut the `[minor]` release commit that ships it. This is the last item before the feature is done — everything upstream is implementation; this task is the acceptance gate.

## Approach

This task performs **only** the plan's "Verification" section (its 5 numbered checks) plus the release step named in "Implementation order" step 7. It does not re-implement anything from TASK-034–037 — if a check fails, that is a signal to reopen the relevant upstream task, not to patch code here.

**Hard constraint, non-negotiable:** never run the real installer (`install-global.sh`, `setup-project.sh`, or anything they call) against the real `$HOME`. Every runtime check in this task runs with `HOME` redirected to a throwaway scratch directory (precedent: TASK-029 step 5 confirmed `os.homedir()` follows a redirected `HOME`). Never write to `~/.claude/settings.json` or `~/.claude/hooks/` on the machine actually running this task. Use `mktemp -d` (or equivalent) for every scratch `HOME` and scratch project directory, and treat leftover scratch dirs as disposable.

Publishing is explicitly out of scope: this task ends at a committed `[minor]` release commit on `main`. Do not run `npm publish` and do not `git push` — the plan and repo convention (see `git log --oneline`, e.g. `90dd130`/`7908676`) is that the release commit itself is the deliverable; the user publishes separately (note: npm login was previously reported expired, which is exactly why this is left to the user).

## Steps

### 1. `npm test` fully green

- [x] Run `npm test` from the repo root and confirm the full suite passes, including `test/settings-hooks.test.js` (TASK-036) alongside the existing `test/settings-deny.test.js` and other suites. Do not proceed to runtime verification if any test fails — fix forward into the relevant upstream task first. *(141/141 pass, 0 fail — settings-hooks, install-global, run-project-sync suites all green)*
<!-- Updated: 2026-07-31 -->

### 2. Fake-HOME end-to-end: `install-global.sh --skip-mcps`

- [x] Create a scratch `HOME` (e.g. `mktemp -d`). Run `HOME=<scratch> bash lib/scripts/install-global.sh --skip-mcps` from the repo root.
- [x] Assert `<scratch>/.claude/hooks/` contains all 18 hook `.js` files (the bijection with `lib/hooks/*.js` asserted by `test/settings-hooks.test.js`), plus the `lib/` subdirectory (`lib/hooks/lib/command-parse.js` and any siblings) copied alongside. *(18 top-level .js + lib/{command-parse,serena-languages,serena}.js; `diff -r` vs `lib/hooks/` clean)*
- [x] Assert `<scratch>/.claude/skills/` is populated (non-empty, mirrors `lib/skills/`). *(59 skill dirs, `diff -r` clean)*
- [x] Assert `<scratch>/.claude/settings.json` exists and contains: the merged deny list (from `settings-deny.json`), the `hooks` key wired per `settings-hooks.json` (SessionStart, PreToolUse ×10, PostToolUse, PostToolUseFailure blocks — commands pointing at `<scratch>/.claude/hooks/<name>.js`, not the repo path), and the `fileSuggestion` key. *(116 deny entries; hooks key deep-equal to template — 19 commands over 18 scripts; commands use the template's `node ~/.claude/hooks/<name>.js` tilde form (resolves to $HOME at runtime), zero repo-path references; fileSuggestion set + file-suggestion.sh executable)*
- [x] Re-run the identical command a second time against the same scratch `HOME`. Assert the deny merge prints "already up to date" (or equivalent), the hooks-wiring merge prints "hooks wiring already up to date" (per the plan's merge-script contract), and `<scratch>/.claude/settings.json` is byte-identical before and after the second run (e.g. `diff` against a saved copy, or compare checksums). *(all three "already up to date/set" lines printed; SHA-256 identical)*
- [x] Discard the scratch `HOME`.

### 3. MCP-failure resilience

- [x] Create a fresh scratch `HOME`. Run `HOME=<scratch> bash lib/scripts/install-global.sh` **without** `--skip-mcps`, with MCP install forced to fail — either stub `lib/scripts/install-mcps.sh` in a copy of the repo to exit non-zero, or run in an environment where `claude`/`npm` are absent from `PATH`. Assert: hooks (all 18 + `lib/` subdir), skills, and settings wiring (deny + hooks + fileSuggestion) still install correctly; an MCP-failure warning is printed to stderr; the script exits `0`. *(stubbed install-mcps.sh exit 1 in a repo copy; exit 0; stderr warning "MCP install failed — hooks, skills, and settings were installed; re-run 'bootstrap install' to retry MCPs."; 18 hooks + lib/, 60 skills, 116 deny, 10 PreToolUse groups, fileSuggestion all landed)*
- [x] Repeat the same failure scenario through the higher-level entry point: create a separate scratch project directory and a separate scratch `HOME`, then run `HOME=<scratch-home> bash lib/scripts/setup-project.sh <scratch-project-dir>` (or the project's documented invocation) with the same forced MCP failure. Confirm `run_project_sync` in `lib.sh` still completes hooks/skills/wiring and reaches `sync-wiki-scaffold.sh`/`build-mcp-guide.sh`/`bootstrap-serena.sh` despite the MCP warning, per the plan's `lib.sh` reorder (§4). *(run_project_sync warned "MCP install failed — continuing with wiki sync" then delivered full scaffold, assembled mcp-tools.md, and reached bootstrap-serena.sh — which failed only because `claude` was a stub, as expected)*
- [x] Discard both scratch dirs.

### 4. Missing-`lib/hooks` warning path

- [x] Make a throwaway copy of the repo (or work in a git worktree) and rename/remove its `lib/hooks` directory so the rsync source is missing.
- [x] Run `HOME=<scratch> bash lib/scripts/install-global.sh --skip-mcps` from that copy. Assert the new warning fires ("Warning: … lib/hooks not found — hook scripts NOT installed" per the plan's `install-global.sh` §3 change) and the script continues to completion (skills, deny merge, fileSuggestion still run) rather than aborting. *(exact warning on stderr; exit 0; skills, 116-entry deny merge, hooks wiring, fileSuggestion all completed. Observation: in this failure mode the hooks wiring is still merged and points at `~/.claude/hooks/` scripts that were never installed — by design, warning-then-continue)*
- [x] Discard the throwaway copy and its scratch `HOME`.

### 5. npm tarball contents

- [x] Run `npm pack --dry-run` from the repo root and confirm the file listing includes `lib/scripts/templates/settings-hooks.json` (and `lib/scripts/merge-settings-hooks.js`) alongside the existing `settings-deny.json` template — i.e. the new template ships in the published tarball, consistent with `package.json`'s `files` field (`lib/` is included wholesale; only `raw/research/`, `raw/companies/`, and `raw/*.pdf` are negated). *(all three present; 188 files / 407 kB packed; no raw/research, raw/companies, or PDF leakage)*

### 6. Version bump and `[minor]` release commit

- [x] Bump `package.json` `version` from `2.16.0` to `2.17.0` (minor bump, per repo convention — this feature is additive/backward-compatible: new template, new merge script, reordered install with new warnings, no breaking change to existing consumers).
- [x] Stage the release changes and commit on `main` with a `[minor] Release 2.17.0: …` summary line in the established style (cf. `git log --oneline`: `7908676`, `90dd130`, `bea8131`) — summarizing the resilient hook-install reordering/guarding, the new `merge-settings-hooks.js` "template owns its blocks" wiring, and the test-count delta. *(commit includes all ROADMAP-004 work: code, tests, template, docs, and wiki bookkeeping — this file's final state ships in it)*
- [x] Do **not** run `npm publish` and do **not** `git push`. Leave both to the user (npm login was previously reported expired, so publish will need re-authentication first). *(honored — nothing pushed or published)*
<!-- Updated: 2026-07-31 -->

## Verification traceability

| Plan "Verification" item | Step above |
|---|---|
| 1. `npm test` full merge coverage | Step 1 |
| 2. Fake-HOME end-to-end (18 hooks, skills, settings.json; idempotent re-run) | Step 2 |
| 3. MCP-failure resilience (`install-global.sh` + `setup-project.sh`) | Step 3 |
| 4. Missing-hooks warning | Step 4 |
| 5. Optional real-machine smoke | Deliberately **not** performed — out of scope per this task's hard constraint against touching the real `$HOME`; covered instead by the scratch-`HOME` checks above |
| Implementation order step 7: version bump / `[minor]` release | Step 6 |
| (Added, not in plan's numbered list but required by this ticket) npm tarball contents | Step 5 |
