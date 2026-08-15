---
id: BUG-0011
aliases: [BUG-0011]
title: install-obsidian.sh never writes manifest.json into the installed plugin directory
status: verified
severity: high
priority: P1
created: 2026-08-13
updated: 2026-08-14
reporter: David Taylor
assignee: David Taylor
tags: obsidian, installer, plugin-install
linked_task: "[[TASK-058]]"
---

# BUG-0011 — install-obsidian.sh never writes manifest.json into the installed plugin directory

`_install_obsidian_plugin` in `lib/scripts/install-obsidian.sh` downloads each
plugin's `manifest.json` only to a temp file, uses it solely to parse the
plugin's `id`, then discards it. `main.js` (and optional `styles.css`) are
written into the real plugin directory, but `manifest.json` never is. Obsidian
requires `manifest.json` in a plugin's folder to recognize and load it, so
every plugin installed by this script is enabled in
`community-plugins.json` but will not actually load.

## Summary

`lib/scripts/install-obsidian.sh:96-171` (`_install_obsidian_plugin`):

1. Downloads the latest release's `manifest.json` to `manifest_tmp` (a
   `mktemp` file), used only to extract `plugin_id` via a `node -e` snippet.
2. Creates `plugin_dir="$vault_dir/.obsidian/plugins/$plugin_id"`.
3. Downloads `main.js` directly into `$plugin_dir/main.js`.
4. Optionally downloads `styles.css` into `$plugin_dir/styles.css`.
5. Cleans up with `rm -f "$release_tmp" "$manifest_tmp"` — `manifest_tmp` is
   deleted without ever being copied into `$plugin_dir/manifest.json`.

There is no code path in the function that writes a `manifest.json` into the
real plugin directory. This is unconditional — it happens on every successful
plugin install, not just under failure/edge conditions.

## Environment

- Platform: macOS 26.3 (Darwin 25.3.0)
- Component: `lib/scripts/install-obsidian.sh`
- Repo: bootstrap-claude, current `main` branch
- Discovered while executing TASK-058 (manual end-to-end verification of the
  guarded Obsidian installer)

## Steps to Reproduce

```sh
cd /Users/davidtaylor/Repositories/bootstrap-claude
bash lib/scripts/install-obsidian.sh --project-dir "$(pwd)"
```

Then inspect the resulting plugin directories:

```sh
ls .obsidian/plugins/dataview
ls .obsidian/plugins/graph-link-types
ls .obsidian/plugins/breadcrumbs
cat .obsidian/community-plugins.json
```

## Expected Behavior

Each installed plugin's directory should contain `manifest.json` alongside
`main.js` (and `styles.css` when present), so Obsidian can actually discover
and load the plugin. `community-plugins.json` listing a plugin id implies
Obsidian will attempt to load it from `.obsidian/plugins/<id>/manifest.json`
— the installer should not enable an id in that file without also placing a
valid manifest at the path Obsidian will read it from.

## Actual Behavior

Confirmed by running the steps above against this repo's real `.obsidian/`
vault:

- Exit code: `0`
- Stdout:
  ```
  Obsidian.app already installed — skipping.
  dataview: enabled in /Users/davidtaylor/Repositories/bootstrap-claude/.obsidian/community-plugins.json.
  graph-link-types: enabled in /Users/davidtaylor/Repositories/bootstrap-claude/.obsidian/community-plugins.json.
  breadcrumbs: enabled in /Users/davidtaylor/Repositories/bootstrap-claude/.obsidian/community-plugins.json.
  ```
- `.obsidian/plugins/` contains `dataview/`, `graph-link-types/`, and
  `breadcrumbs/`, each with `main.js` + `styles.css` — but a Serena
  `find_file` for `manifest.json` under `.obsidian/plugins` returned **zero**
  matches across all three folders.
- `.obsidian/community-plugins.json` correctly lists
  `["dataview", "graph-link-types", "breadcrumbs"]`.

So the script reports success and the plugin ids are enabled, but none of the
three installed plugins have the `manifest.json` Obsidian needs to load them.

## Reproducibility

- `always` — deterministic; the code path that would copy the manifest simply
  does not exist, so this reproduces on every run regardless of network
  timing or which plugin is installed.
- First seen: 2026-08-13
- Last seen: 2026-08-13

## Impact

Every plugin installed by `install-obsidian.sh` (Dataview, Graph Link Types,
Breadcrumbs, and any future plugin routed through
`_install_obsidian_plugin`) is silently non-functional in Obsidian despite
the script reporting success and despite the plugin id appearing enabled in
`community-plugins.json`. A user (or the automated `run_project_sync()` path
wired in by TASK-055) has no signal that anything is wrong — the failure is
only visible by actually opening the vault in Obsidian and seeing the
plugins missing/greyed out in Settings → Community plugins.

## Workaround

> Manually copy each plugin's `manifest.json` from its GitHub release into
> the corresponding `.obsidian/plugins/<id>/manifest.json` after running the
> installer, or re-download it directly:
> `curl -fsSL <manifest asset URL from the latest GitHub release> -o .obsidian/plugins/<id>/manifest.json`

## Notes for the fixer

Straightforward fix: in `_install_obsidian_plugin`, after `plugin_dir` is
created (`lib/scripts/install-obsidian.sh:139-144`), copy `manifest_tmp` into
`$plugin_dir/manifest.json` (e.g. `cp "$manifest_tmp" "$plugin_dir/manifest.json"`)
before the final `rm -f "$release_tmp" "$manifest_tmp"` cleanup at line 170.
Should be unconditional — the function already returns early on every earlier
failure, so by the time execution reaches the `main.js` download, the
manifest is known-good and parseable.

This verification run did not exercise the real `brew install --cask
obsidian` app-install path (Obsidian.app was already present on the test
machine, and not brew-cask-managed) — that path remains unverified and may
warrant a separate follow-up run on a machine without Obsidian installed.

## Root Cause Analysis

`_install_obsidian_plugin` downloaded `manifest.json` purely as a lookup value — its only purpose in the function was to extract the plugin's `id` string so the destination directory could be named. The temp file holding it was never carried forward as a deliverable artifact: `main.js` and `styles.css` were both written directly into `$plugin_dir` via `curl -o`, but no equivalent line existed for `manifest.json` — the code path that would copy it into the real plugin directory was simply never written. The final `rm -f "$release_tmp" "$manifest_tmp"` cleanup then silently discarded it. The defect was purely an omission (a missing step), not an incorrect one — there was no code path anywhere in the function, correct or buggy, that produced a `manifest.json` in the real plugin directory.

## Resolution

| Field | Value |
|-------|-------|
| Fix commit | `e71ded6` |
| Fix version | — |
| Linked PR | — |
| Linked task | [[TASK-053]] |
| Regression test | `test/install-obsidian.test.js` — "install-obsidian.sh: BUG-0011 — a fully successful plugin install must leave manifest.json in the plugin directory" (existed pre-fix, failing by design; now passes) |

Fix: copy the already-downloaded `manifest_tmp` into `$plugin_dir/manifest.json` immediately after the plugin directory is created, before the `main.js` download — unconditional, matching the existing overwrite-on-every-refresh semantics of `main.js`/`styles.css`. Verified two ways: (1) the regression test now passes (`node --test --test-name-pattern="BUG-0011" test/install-obsidian.test.js`), full suite green at 338/338; (2) re-ran the real installer against this repo's own `.obsidian/` vault and confirmed `manifest.json` now present in all three plugin directories (`dataview`, `graph-link-types`, `breadcrumbs`).

## Related

- `lib/scripts/install-obsidian.sh:96-171` (`_install_obsidian_plugin`)
- `wiki/work/tasks/TASK-058-verify-obsidian-install.md` — verification task
  that discovered this
- `wiki/work/tasks/TASK-053-install-obsidian-script.md` — task that authored
  the installer
- `wiki/work/tasks/TASK-055-wire-install-obsidian-run-sync.md` — wires this
  installer into `run_project_sync()`
