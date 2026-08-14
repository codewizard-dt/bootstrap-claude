---
id: UAT-053
title: "UAT: Add lib/scripts/install-obsidian.sh (app + plugin auto-install)"
status: passed
task: TASK-053
created: 2026-08-13
updated: 2026-08-14
tags: [obsidian, installer, automation]
---

# UAT-053 — UAT: Add lib/scripts/install-obsidian.sh (app + plugin auto-install)

implements::[[TASK-053]]

> **Source task**: [[TASK-053]]
> **Generated**: 2026-08-13

This UAT covers the **STATIC/behavioral contract** of `lib/scripts/install-obsidian.sh`: flag
parsing, guard structure (no step ever aborts the script), the non-interactive prefs-gating
mirror of `register_optional_mcp`, OS-branch dispatch, malformed/partial GitHub release
handling, and idempotency of the `community-plugins.json` merge. It deliberately does **not**
re-run the real, network-dependent happy path (real `brew`/`flatpak` install, real GitHub
releases against the three pinned plugins) — that was already exercised manually and recorded
in [[TASK-058]] (happy path + [[BUG-0011]] discovery) and [[TASK-059]] (non-fatal-failure and
declined-prompt paths). Every case below was chosen specifically because neither of those manual
runs exercised it.

All 13 cases are backed by one promoted unit test file, `test/install-obsidian.test.js`, using
this repo's existing `spawnSync` + curated-`HOME` + PATH-stub-bin harness convention (see
`test/run-project-sync.test.js` and `test/prompt-stickiness.test.js`) — no live network, no real
`brew`/`flatpak`, and no writes outside per-test scratch directories.

---

## Prerequisites

- [ ] Repo checked out at the bootstrap-claude root; `node` available (v18+; developed/verified
      against v26.0.0)
- [ ] Nothing here touches the real `$HOME` or this repo's own real `.obsidian/` — every test
      runs against a scratch `HOME` and a scratch `--project-dir`.

---

## Test Cases

### UAT-CLI-001: No `--project-dir` given skips plugin install with a WARNING, script still exits 0
- **Scenario**: `install-obsidian.sh` invoked with no `--project-dir` flag at all — a guard case
  never exercised by TASK-058/059, which always passed a real project dir.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. Stdout contains `WARNING: no --project-dir given — skipping Obsidian plugin install.` and no `.obsidian/` directory is created anywhere.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("no --project-dir given skips plugin install with a WARNING, exits 0")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-CLI-002: Non-interactive + stored `obsidian.installApp=false` skips app install and never calls `uname`
- **Scenario**: The script's own non-interactive mirror of `register_optional_mcp` (lines ~228-240) — an explicit stored `false` diverts, reading the preference directly via `prefs_get` rather than through a prompt helper.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. Stdout contains `obsidian.installApp: skipped (remembered decline — change with /bootstrap-config)`. `_install_obsidian_app` is never entered — proven by a `uname` stub that logs its own invocation, and the log file never appears.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("non-interactive + stored obsidian.installApp=false skips app install and never calls uname")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-CLI-003: Non-interactive + stored `obsidian.plugins=false` at the project selector skips plugin install and never calls `curl`
- **Scenario**: Same non-interactive mirroring applied to the project-scoped `obsidian.plugins` key (selector = the project dir itself, never `--global`).
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. Stdout contains `obsidian.plugins: skipped (remembered decline — change with /bootstrap-config)`. `_install_obsidian_plugin` is never entered (a logging `curl` stub is never invoked), and `.obsidian/` is never created in the project dir.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("non-interactive + stored obsidian.plugins=false at the project selector skips plugin install and never calls curl")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-CLI-004: Non-interactive with NO stored preference proceeds with app install (unset does not divert, only an explicit `false` does)
- **Scenario**: Confirms the "only a stored `false` diverts" half of the contract — `true`, `ask`, and (here) `unset` all proceed with the install, mirroring `register_optional_mcp`'s non-interactive branch exactly.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. `_install_obsidian_app` runs (proven via a stubbed `uname` returning an unrecognized OS name, `TestOS`); stdout contains `Obsidian: no automated installer for 'TestOS' — install manually from https://obsidian.md/download`.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("non-interactive with NO stored preference proceeds with app install (unset does not divert, only an explicit false does)")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-CLI-005: Linux + flatpak already listing Obsidian short-circuits, and `flatpak install` is never called
- **Scenario**: The Linux/flatpak app-install branch (`_install_obsidian_app`'s `Linux)` case) — never exercised by TASK-058/059, both run on macOS/Darwin.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. Stdout contains `Obsidian (flatpak) already installed — skipping.` A `flatpak` stub that logs `install` invocations separately from `list` invocations shows the `install` subcommand was never reached.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("Linux + flatpak already listing Obsidian short-circuits and never calls `flatpak install`")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-CLI-006: Linux + flatpak absent from PATH warns and continues rather than erroring
- **Scenario**: `command -v flatpak` guard — flatpak not installed at all. Also never exercised on the macOS verification machine.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0 (not aborted despite `set -euo pipefail`). Stdout contains `WARNING: flatpak not found — install Obsidian manually from https://obsidian.md/download`.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("Linux + flatpak absent from PATH warns and continues rather than erroring")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-001: Release with no `manifest.json` asset warns and skips the plugin (exit 0)
- **Scenario**: A GitHub release whose `assets` array lacks a `manifest.json` entry entirely — `_gh_release_asset_url` legitimately returns empty, never even reaching a manifest download. Real GitHub responses during TASK-058 always had a well-formed manifest asset, so this path was never hit for real.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. Stderr contains `latest release has no manifest.json asset (or the release JSON was malformed) — skipping plugin.` No `.obsidian/plugins/` or `community-plugins.json` created — every plugin (the same synthetic release is served for all three real plugin constants) was skipped.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("release with no manifest.json asset warns and skips the plugin (exit 0)")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-002: `manifest.json` missing its `id` field warns and skips the plugin (exit 0)
- **Scenario**: `manifest.json` downloads successfully but is missing/malformed the one field the installer actually depends on (`.id` — the authoritative plugin directory name).
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. Stderr contains `manifest.json is missing/malformed its 'id' field — skipping plugin.`
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("manifest.json missing its 'id' field warns and skips the plugin (exit 0)")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-003: Release with no `main.js` asset warns and skips the plugin (exit 0)
- **Scenario**: `manifest.json` resolves fine (so `plugin_dir` is created) but the release has no `main.js` asset — the one asset the installer treats as required.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. Stderr contains `latest release has no main.js asset — skipping plugin.`
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("release with no main.js asset warns and skips the plugin (exit 0)")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-004: Release with no `styles.css` asset still installs successfully (styles.css is optional)
- **Scenario**: Confirms `styles.css` is genuinely optional per the task's Approach ("`styles.css` only if that asset exists") — a release with `manifest.json` + `main.js` but no `styles.css` must still succeed, silently, with no warning.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0. No `styles.css`-related warning anywhere in stdout. `plugins/stub-plugin/main.js` exists; `plugins/stub-plugin/styles.css` does not. `community-plugins.json` is exactly `["stub-plugin"]`.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("release with no styles.css asset still installs successfully (styles.css is optional)")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-005: A fully successful plugin install must leave `manifest.json` in the plugin directory
- **Scenario**: Obsidian requires `manifest.json` inside a plugin's own folder to discover and load it. **This case documented [[BUG-0011]]** (`_install_obsidian_plugin` downloaded `manifest.json` only to parse its `id`, then discarded it without ever copying it into `$plugin_dir/manifest.json`) and, per Test Integrity, asserted the *required* contract rather than the buggy behavior. Fixed 2026-08-14 (commit `e71ded6`) — the plugin directory now receives `manifest.json` alongside `main.js`/`styles.css`.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: `plugins/stub-plugin/manifest.json` exists after a fully successful plugin install (manifest + main.js + styles.css all present in the synthetic release).
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("BUG-0011 — a fully successful plugin install must leave manifest.json in the plugin directory")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-14 -->

### UAT-EDGE-006: Running the installer twice enables the same id idempotently — no duplicates, "already enabled" the second time
- **Scenario**: The idempotent `community-plugins.json` merge in `_enable_obsidian_plugin` — TASK-058/059 each ran the installer only once, so re-run idempotency was never actually exercised end-to-end.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: After the first run, `community-plugins.json` is exactly `["stub-plugin"]`. After a second run against the same project dir, stdout contains `stub-plugin: already enabled in <path>/.obsidian/community-plugins.json.` and the file is still exactly `["stub-plugin"]` — no duplicate entry.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("running the installer twice enables the same id idempotently — no duplicates, \"already enabled\" the second time")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-007: A malformed (non-array) `community-plugins.json` warns and is left byte-for-byte unchanged
- **Scenario**: `_enable_obsidian_plugin`'s defensive parse/shape check — a pre-existing `community-plugins.json` that isn't a JSON array must not be crashed on or silently overwritten.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/install-obsidian.test.js
  ```
- **Expected Result**: Exit 0 (not aborted). Stderr contains `is not a JSON array — skipping enable for stub-plugin.` The file's bytes are identical before and after the run.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` ("a malformed (non-array) community-plugins.json warns and is left byte-for-byte unchanged")
- **Unit Test Command**: `node --test test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

---

## Gaps found while generating this UAT

Recorded here rather than silently omitted; none block this UAT.

1. **The real `brew install --cask obsidian` / real `flatpak install` execution paths are not (and cannot hermetically be) covered here.** Both are guarded, side-effecting package-manager invocations — appropriate for the manual verification already done in TASK-058 (macOS, app pre-installed so the real `brew install` line itself was not exercised there either) and TASK-059 (macOS, brew-missing failure simulated via `PATH` stripping), not for a hermetic unit test. This UAT instead verifies the *dispatch* around those calls (OS detection, already-installed short-circuits, the `||` non-fatal guard) using stubbed `uname`/`flatpak`/`brew`.
2. **The real GitHub API / real plugin release payload shapes for the three pinned plugins are not re-fetched here.** TASK-058 already confirmed the real releases parse correctly end-to-end (all three plugin ids resolved, `main.js` + `styles.css` both present for all three). This UAT instead uses a synthetic single plugin identity (`stub-plugin`) looped through the real script's real three-constant loop, which is sufficient for testing the shared `_install_obsidian_plugin`/`_gh_release_asset_url`/`_enable_obsidian_plugin` logic — that logic does not vary per plugin repo slug.
3. **BUG-0011 (UAT-EDGE-005) was intentionally a currently-failing case, not an oversight, until fixed 2026-08-14 (commit `e71ded6`).** It existed so this suite would auto-detect the moment BUG-0011 was fixed, rather than silently asserting the broken behavior was correct — which is exactly what happened: no edit to this test was needed.
4. **`uatGenerate.promoteTests` was read as the legacy value `true`**, which this run mapped to `dedicated` (today's default behavior) per the skill's legacy-grammar table. `/bootstrap-config` can migrate it to the current `sibling | never | dedicated` grammar explicitly.
