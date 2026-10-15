---
id: BUG-0012
aliases: [BUG-0012]
title: bootstrap-prefs TUI reset asks a false "stored in BOTH layers" question for keys with a schema default
status: open
severity: low
priority: "—"
created: 2026-09-19
updated: 2026-09-19
reporter: David Taylor
assignee: unassigned
tags: "—"
linked_task: "[[TASK-0105]]"
---

# BUG-0012 — bootstrap-prefs TUI reset asks a false "stored in BOTH layers" question for keys with a schema default

relates_to::[[bootstrap-prefs-editor-tui]]

Found while writing `test/bootstrap-prefs-tui-verification.test.js` (TASK-0105). Filed non-interactively by the tackling agent; reproduction re-verified against a scratch HOME.

## Summary

In reset mode, when a `scope: either` key is stored only in the project layer, the TUI still prints `<key> is stored in BOTH layers…` and offers a Global choice, although nothing is stored globally. Every `scope: either` key has a schema default, so all of them are affected.

## Environment

- Platform: macOS (Darwin 25.3.0), Node v26
- Components: `lib/scripts/bootstrap-prefs-tui.js` (`storedLayers()`, ~lines 1032-1043; `resetKey()`, ~lines 1061-1066), `lib/scripts/bootstrap-prefs.js` (`--get`)
- Version: repo at 5.3.0, commit `6ec4cbf` (working tree with uncommitted TASK-0103/0104 changes)
- Config: scratch HOME (no global values file), scratch project with a `.git` or `.claude/` marker

## Steps to Reproduce

1. With `HOME` pointed at an empty scratch dir and `<p>` a scratch project directory (with `.git/`), run `node lib/scripts/bootstrap-prefs.js --set gitCommit.autoPush --value true --project <p>`.
2. From `<p>`, run `node lib/scripts/bootstrap-prefs-tui.js` (unpinned — no `--project`/`--global`).
3. Choose `2) Reset a preference`, then choose `gitCommit.autoPush`.

## Expected Behavior

Only the project layer holds a value, so the TUI states the single layer (`Layer: Project layer …`) and does not ask which layer to clear.

## Actual Behavior

The TUI prints `gitCommit.autoPush is stored in BOTH layers. Clearing the project layer alone re-exposes the global answer instead of re-opening the question; clear both (one reset per layer) to re-open it.` and then asks `Which layer?` with project and global options.

Direct probe: `node lib/scripts/bootstrap-prefs.js --get gitCommit.autoPush --global` exits 0 and prints `false` — the resolved schema default, not a stored value. `storedLayers()` treats any `--get` output other than empty/`unset` as "stored globally" (`alsoGlobal = probe.status === 0 && … !== '' && … !== 'unset'`).

## Reproducibility

- Reproducibility: always
- First seen: 2026-09-19
- Last seen: 2026-09-19

## Test coverage note

`test/bootstrap-prefs-tui-verification.test.js` covers the positive both-layers case and asserts the negative case only with the default-less key `mcp.serena`, with a comment pointing at this bug. Once fixed, extend the negative case to a defaulted `scope: either` key.

## Root Cause Analysis

> Filled in by `/bug-close`.

## Resolution

> Filled in by `/bug-close`.

## Related

- [[TASK-0105]] — discovered during verification
- [[TASK-0103]] — implements the TUI
