---
id: UAT-035
aliases: [UAT-035]
title: "UAT: Reorder install-global.sh — local steps first, MCPs last and guarded, invoke hooks-wiring merge"
status: passed
task: TASK-035
created: 2026-07-31
updated: 2026-07-31
---

# UAT-035 — UAT: Reorder install-global.sh — local steps first, MCPs last and guarded, invoke hooks-wiring merge

implements::[[TASK-035]]

> **Source task**: [[TASK-035]]
> **Generated**: 2026-07-31

---

## Prerequisites

- [ ] Run from the repo root: `/Users/davidtaylor/Repositories/bootstrap-claude`
- [ ] **SAFETY (non-negotiable): every live run uses `HOME="$UAT_TMP/home"` — never the real `$HOME`.** The real `~/.claude` must never be read or written by these tests.
- [ ] **SAFETY: the real `lib/scripts/install-mcps.sh` is never executed** — every test runs from a scratch copy of the template with `install-mcps.sh` replaced by a stub, or passes `--skip-mcps`.
- [ ] One-time scratch setup (rerun to reset between tests if needed):
  ```bash
  UAT_TMP="$(mktemp -d)"
  mkdir -p "$UAT_TMP/tpl" "$UAT_TMP/home"
  cp -R lib "$UAT_TMP/tpl/lib"
  printf '#!/usr/bin/env bash\necho "install-mcps.sh" >> "%s/mcps.log"\nexit 0\n' "$UAT_TMP" > "$UAT_TMP/tpl/lib/scripts/install-mcps.sh"
  chmod +x "$UAT_TMP/tpl/lib/scripts/install-mcps.sh"
  ```
  This creates a full working copy of the template tree at `$UAT_TMP/tpl` whose MCP step is a harmless marker stub (appends to `$UAT_TMP/mcps.log`, exits 0), plus an empty fake HOME at `$UAT_TMP/home`.
- [ ] `node` and `rsync` available on PATH (both are hard requirements of the script itself).

---

## Test Cases

### UAT-CLI-001: Fresh install runs all six steps in the new order, MCPs last
- **Command**: `bash "$UAT_TMP/tpl/lib/scripts/install-global.sh"` (with `HOME="$UAT_TMP/home"`)
- **Description**: Verifies the TASK-035 reorder as observed in output — all five local/offline-safe steps run first, the MCP step runs last, and the final summary names every step.
- **Steps**:
  1. Complete the prerequisite scratch setup (fresh `$UAT_TMP`).
  2. Run:
     ```bash
     HOME="$UAT_TMP/home" bash "$UAT_TMP/tpl/lib/scripts/install-global.sh"; echo "exit=$?"
     ```
  3. Read the stdout top-to-bottom and note the order the step banners appear in.
- **Expected Result**: `exit=0`. The six banners appear in exactly this order: (1) `Installing hooks globally (~/.claude/hooks/)...` (2) `Installing skills globally (~/.claude/skills/)...` (3) `Merging permissions deny list (~/.claude/settings.json)...` (4) `Merging hooks wiring (~/.claude/settings.json)...` (5) `Installing file suggestion picker (~/.claude/file-suggestion.sh)...` (6) `Checking global MCP servers (user scope)...` — the MCP banner is last. First-run merge outcomes appear: `settings.json: created with N deny entries`, `hooks wiring: created` followed by `Restart Claude Code sessions to activate hook changes.`, and `settings.json: "fileSuggestion" set` followed by its restart reminder. Final line: `Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + MCPs).` The stub marker file `$UAT_TMP/mcps.log` now exists.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` ("fresh run executes all six steps in the TASK-035 order, MCPs last")
- [x] Pass <!-- 2026-07-31 -->

### UAT-CLI-002: Fake-HOME settings.json ends up with deny + hooks wiring + fileSuggestion, and all payloads landed
- **Description**: Verifies the fresh run from UAT-CLI-001 actually produced a complete `settings.json` and installed the hook scripts, skills, and file-suggestion picker into the fake HOME.
- **Steps**:
  1. Immediately after UAT-CLI-001 (same `$UAT_TMP`), run:
     ```bash
     node -e "var fs=require('fs'); var h=process.argv[1]; var s=JSON.parse(fs.readFileSync(h+'/.claude/settings.json','utf8')); console.log('deny entries: '+s.permissions.deny.length); console.log('hooks events: '+Object.keys(s.hooks).join(',')); console.log('fileSuggestion: '+JSON.stringify(s.fileSuggestion)); console.log('hooks dir: '+fs.readdirSync(h+'/.claude/hooks').length+' entries'); console.log('skills dir: '+fs.readdirSync(h+'/.claude/skills').length+' entries'); console.log('picker: '+fs.existsSync(h+'/.claude/file-suggestion.sh'));" "$UAT_TMP/home"
     ```
- **Expected Result**: Deny entries count is > 0 (canonical list, currently 116); hooks events list is non-empty and includes `PreToolUse`; `fileSuggestion` prints exactly `{"type":"command","command":"~/.claude/file-suggestion.sh"}`; hooks dir and skills dir both have > 0 entries; `picker: true`. No error output.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` ("fresh run merges deny list, hooks wiring, and fileSuggestion into settings.json")
- [x] Pass <!-- 2026-07-31 -->

### UAT-CLI-003: Idempotent re-run — all merges report up to date, settings.json byte-identical, no restart nudges
- **Description**: Verifies a second run against an already-installed fake HOME is a clean no-op for all three settings merges.
- **Steps**:
  1. Using the same `$UAT_TMP` as UAT-CLI-001/002 (fake HOME already installed), snapshot then re-run:
     ```bash
     cp "$UAT_TMP/home/.claude/settings.json" "$UAT_TMP/settings.before.json"
     HOME="$UAT_TMP/home" bash "$UAT_TMP/tpl/lib/scripts/install-global.sh" --skip-mcps; echo "exit=$?"
     cmp "$UAT_TMP/settings.before.json" "$UAT_TMP/home/.claude/settings.json"; echo "cmp=$?"
     ```
- **Expected Result**: `exit=0` and `cmp=0` (settings.json byte-identical). Stdout contains all three no-op outcomes: `settings.json: deny list already up to date`, `hooks wiring already up to date`, and `settings.json: "fileSuggestion" already set`. Neither `Restart Claude Code sessions` line appears anywhere in the output.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` ("a second run is a no-op: \"already up to date\" messages, identical settings.json, no restart nudges")
- [x] Pass <!-- 2026-07-31 -->

### UAT-CLI-004: --skip-mcps still fully skips the MCP step
- **Description**: Verifies the preserved `--skip-mcps` behavior — the MCP block never runs, stub included.
- **Steps**:
  1. Fresh scratch setup (new `$UAT_TMP`, so `$UAT_TMP/mcps.log` does not pre-exist).
  2. Run:
     ```bash
     HOME="$UAT_TMP/home" bash "$UAT_TMP/tpl/lib/scripts/install-global.sh" --skip-mcps; echo "exit=$?"
     node -e "console.log('mcps.log exists: '+require('fs').existsSync(process.argv[1]+'/mcps.log'));" "$UAT_TMP"
     ```
- **Expected Result**: `exit=0`; stdout does NOT contain `Checking global MCP servers`; `mcps.log exists: false` (the stub was never invoked). The final `Global setup complete (...)` line still prints.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` ("--skip-mcps skips the MCP step entirely")
- [x] Pass <!-- 2026-07-31 -->

### UAT-EDGE-001: Missing lib/hooks — stderr warning, script continues to completion
- **Scenario**: The template copy has no `lib/hooks` directory (the pre-TASK-035 silent-skip hole). The script must warn on stderr and keep going instead of silently skipping or aborting.
- **Steps**:
  1. Fresh scratch setup (new `$UAT_TMP`), then remove the hooks dir from the **copy** (never the real repo):
     ```bash
     mv "$UAT_TMP/tpl/lib/hooks" "$UAT_TMP/tpl/lib/hooks.renamed"
     ```
  2. Run, capturing stderr separately so the warning's stream is provable:
     ```bash
     HOME="$UAT_TMP/home" bash "$UAT_TMP/tpl/lib/scripts/install-global.sh" --skip-mcps 2>"$UAT_TMP/err.log"; echo "exit=$?"
     node -e "console.log(require('fs').readFileSync(process.argv[1]+'/err.log','utf8'));" "$UAT_TMP"
     ```
- **Expected Result**: `exit=0` — the script completed despite the missing directory. `err.log` contains `Warning: $UAT_TMP/tpl/lib/hooks not found — hook scripts NOT installed` (with the literal expanded path). Stdout shows the run continued: the skills, deny-merge, hooks-wiring, and fileSuggestion banners all appear, and the final `Global setup complete (...)` line prints. `$UAT_TMP/home/.claude/settings.json` exists; `$UAT_TMP/home/.claude/hooks/` does not.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` ("missing lib/hooks warns on stderr and the script still completes")
- [x] Pass <!-- 2026-07-31 -->

### UAT-EDGE-002: MCP-install failure — warning on stderr, exit 0, all local installs intact
- **Scenario**: `install-mcps.sh` fails (stubbed to exit 1) and the script runs WITHOUT `--skip-mcps`. Under `set -euo pipefail` this used to abort everything; TASK-035 guards it so hooks, skills, and settings still land and the script exits 0 with a warning.
- **Steps**:
  1. Fresh scratch setup (new `$UAT_TMP`), then replace the stub with a failing one:
     ```bash
     printf '#!/usr/bin/env bash\necho "stub install-mcps.sh failing" >&2\nexit 1\n' > "$UAT_TMP/tpl/lib/scripts/install-mcps.sh"
     chmod +x "$UAT_TMP/tpl/lib/scripts/install-mcps.sh"
     ```
  2. Run without `--skip-mcps`, capturing stderr:
     ```bash
     HOME="$UAT_TMP/home" bash "$UAT_TMP/tpl/lib/scripts/install-global.sh" 2>"$UAT_TMP/err.log"; echo "exit=$?"
     node -e "console.log(require('fs').readFileSync(process.argv[1]+'/err.log','utf8'));" "$UAT_TMP"
     ```
  3. Re-run the settings/payload inspection command from UAT-CLI-002 against this `$UAT_TMP`.
- **Expected Result**: `exit=0` despite the MCP failure. `err.log` contains `Warning: MCP install failed — hooks, skills, and settings were installed; re-run 'bootstrap install' to retry MCPs.` Stdout still ends with `Global setup complete (...)`. The UAT-CLI-002 inspection passes unchanged: deny list, hooks wiring, and fileSuggestion all present in `settings.json`; hooks, skills, and the picker all installed in the fake HOME.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` ("a failing install-mcps.sh warns but the script still exits 0 with local installs done")
- [x] Pass <!-- 2026-07-31 -->

---

## Cleanup

- [ ] `rm -rf "$UAT_TMP"` for every scratch dir created (nothing outside `$UAT_TMP` was touched; the real `$HOME` and the repo working tree are unmodified by these tests).
