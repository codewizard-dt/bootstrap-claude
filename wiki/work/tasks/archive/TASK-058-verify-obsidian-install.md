---
id: TASK-058
title: "Manually verify guarded Obsidian install end-to-end on at least one platform"
status: done
created: 2026-08-13
updated: 2026-08-13
depends_on: [TASK-053, TASK-055]
blocks: []
parallel_safe_with: [TASK-059]
uat: "[[UAT-058]]"
tags: [obsidian, installer, verification]
---

# TASK-058 — Manually verify guarded Obsidian install end-to-end on at least one platform

## Objective

Run the new `lib/scripts/install-obsidian.sh` (from TASK-053, wired in by TASK-055 — both must be `status: done` first) against this actual repository on the current machine, and confirm the Obsidian app installs (or is correctly detected as already installed) and all three plugin folders + `.obsidian/community-plugins.json` are populated correctly in a real project vault.

## Approach

This is a real, side-effecting manual verification (it will attempt an actual `brew install --cask obsidian` / plugin download over the network against this machine) — not a code-writing task. Run it directly against this repo's own project root as the target vault. Record actual observed output and the resulting file tree as evidence, and file a `/bug-file` for any discrepancy found rather than silently marking done.

## Steps

### 1. Run the installer directly <!-- agent: general-purpose -->

- [x] Run `bash lib/scripts/install-obsidian.sh --interactive --project-dir "$(pwd)"` (or the equivalent non-interactive path if the interactive prompts can't be automated in this environment — check `lib/scripts/lib.sh`'s `has_tty`/`BOOTSTRAP_ASSUME_TTY` test-seam pattern first, used elsewhere in this repo's own test suite for driving guarded prompts non-interactively).
  - Observe and record: does the Obsidian app install or get correctly detected as already present; does `.obsidian/plugins/dataview/`, the Graph Link Types plugin's actual manifest-declared id folder, and the Breadcrumbs plugin's actual manifest-declared id folder each contain `manifest.json` + `main.js`; does `.obsidian/community-plugins.json` list all three ids.

### 2. Record findings <!-- agent: general-purpose -->

- [x] Record findings in this task's `## Notes` section (edit this file after running) or as a companion UAT file once `/uat-generate` is run against this task — follow whichever format `wiki/work/uat/lifecycle.md` specifies as the current convention for manual-verification tasks.

### 3. File bugs for any failure <!-- agent: general-purpose -->

- [x] If any step fails or behaves unexpectedly, file it via `/bug-file` rather than silently marking this task done — this verification task exists specifically to catch installer bugs before they ship.

## Notes

Derived from `raw/research/obsidian-setup-automation/index.md`'s Solution Comparison (app-install risk mitigation) and `wiki/work/roadmaps/ROADMAP-006-obsidian-plugin-automation.md` Phase 4. Depends on TASK-053 (script) and TASK-055 (wiring) both being done first — there is nothing to verify until both land.

### Verification run (2026-08-13)

**Command:** `bash lib/scripts/install-obsidian.sh --project-dir "$(pwd)"` (run from repo root; no `--interactive` flag or stdin-piping needed — the non-interactive branches for `obsidian.installApp`/`obsidian.plugins` in `install-obsidian.sh` default to proceeding when no sticky preference is recorded, and none was recorded on this machine). Exit code: `0`.

**Stdout:**
```
Obsidian.app already installed — skipping.
dataview: enabled in /Users/davidtaylor/Repositories/bootstrap-claude/.obsidian/community-plugins.json.
graph-link-types: enabled in /Users/davidtaylor/Repositories/bootstrap-claude/.obsidian/community-plugins.json.
breadcrumbs: enabled in /Users/davidtaylor/Repositories/bootstrap-claude/.obsidian/community-plugins.json.
```

**App install path:** Obsidian.app was already present at `/Applications/Obsidian.app`, so the installer took the "already installed" skip branch, not the real `brew install --cask obsidian` path. Note it wasn't brew-cask-managed on this machine (`brew list --cask obsidian` shows no `Caskroom/obsidian`), so the brew-install code path specifically was not exercised by this run — worth a follow-up run on a machine without Obsidian, or via `brew uninstall`, if that path needs direct coverage.

**Plugin folders** (`.obsidian/plugins/`, via Serena `list_dir`): `dataview/`, `graph-link-types/`, `breadcrumbs/` all created, each containing `main.js` + `styles.css`. Folder names match the manifest-declared plugin ids.

**`.obsidian/community-plugins.json`:** `["dataview", "graph-link-types", "breadcrumbs"]` — all three ids present as designed.

**Bug found — `manifest.json` missing from every plugin folder.** Confirmed via Serena `find_file` (zero matches for `manifest.json` under `.obsidian/plugins`) and by reading `_install_obsidian_plugin` in `lib/scripts/install-obsidian.sh` (lines 96–171): the function downloads `manifest.json` to a temp file (`manifest_tmp`) solely to parse the `id` field, then downloads `main.js`/`styles.css` straight into `$plugin_dir`, but never copies `manifest_tmp` into `$plugin_dir/manifest.json` — the temp file is deleted (`rm -f "$release_tmp" "$manifest_tmp"`) without ever landing in the real plugin directory. This is deterministic/unconditional, not sibling-run interference (TASK-059's concurrent negative-path run showed no evidence of interfering with this run — no unexpected prompts, PATH stripping, or file churn observed). Filed as [BUG-0011](../bugs/BUG-0011-obsidian-plugin-manifest-not-copied.md).

**Verdict:** Happy path runs cleanly end-to-end (exit 0, all 3 plugins fetched, ids registered in `community-plugins.json`, app-present path exercised, no crashes/hangs) but the resulting install is **not actually functional in Obsidian** — Obsidian requires `manifest.json` in each plugin folder to load a community plugin, and it's missing from all three. The real `brew install --cask obsidian` path was not exercised (app pre-existed, non-brew-managed).

<!-- Updated: 2026-08-13 -->
