---
id: TASK-033
title: "Build lib/scripts/merge-settings-hooks.js — \"template owns its blocks\" hooks-wiring merge"
status: done
created: 2026-07-31
updated: 2026-07-31
depends_on: [TASK-032]
blocks: [TASK-034, TASK-035]
parallel_safe_with: []
uat: "[[UAT-033]]"
tags: [install, hooks, settings]
---

# TASK-033 — Build `lib/scripts/merge-settings-hooks.js` — "template owns its blocks" hooks-wiring merge

derived_from::[[ROADMAP-004]]

## Objective

Write `lib/scripts/merge-settings-hooks.js`, a **sibling** script to `lib/scripts/merge-settings-deny.js` that merges the repo's canonical hook wiring (`lib/scripts/templates/settings-hooks.json`, produced by TASK-032) into a user's `~/.claude/settings.json` `hooks` key. Today, nothing writes the `hooks` key — hook registration is a manual copy-paste from `lib/hooks/README.md`, so new machines and any newly added hook silently never run. This script closes that gap by wiring hooks automatically on every `install-global.sh` run, while never touching user-added custom hooks or blocks.

This is **not** a new `--set-key`/mode of `merge-settings-deny.js` — the deny script does simple additive set-union over a flat array and has a frozen 437-line test suite that must not be disturbed. This is a structured, block-and-entry-aware merge with materially different semantics ("template owns its blocks" ownership + drift adoption + mixed-block handling), so it lives in its own file and copies only the small, genuinely-shared low-level helpers.

## Approach

1. Create `lib/scripts/merge-settings-hooks.js` as a new file (do not modify `merge-settings-deny.js`).
2. Copy the following helpers from `lib/scripts/merge-settings-deny.js` (currently lines ~31-111): `parseArgs` (adapted for this script's own default source path), `warnSkip`, `isPlainObject`, `deepEqual`, `readTarget`, `parseSettings`, `detectIndent`, `writeSettings` (atomic tmp-file + `fs.renameSync` write). Prefix the copied block with a provenance comment, e.g.:
   ```js
   // Helpers below are copied from merge-settings-deny.js (~lines 31-111) rather
   // than shared, because that script's additive set-union semantics and frozen
   // test suite must not be coupled to this script's block-ownership algorithm.
   ```
3. Implement the block-ownership merge algorithm described below on top of those helpers.
4. Keep the same CLI contract as `merge-settings-deny.js`: `--target <path>` / `--source <path>` test seams, defaulting respectively to `~/.claude/settings.json` and `lib/scripts/templates/settings-hooks.json`; the install flow passes no args.
5. The script must **always exit 0** — it is invoked from `install-global.sh` under `set -euo pipefail`, and a settings merge must never abort an install.
6. Malformed input (unparseable target JSON, target's `hooks` key present but not an object, malformed template) → warn to stderr and leave the target file **untouched**, then exit 0 (mirror `warnSkip` behavior in the sibling script).
7. Write only when there is an actual change — no-op runs must not touch the file (helps idempotency and avoids spurious mtime/formatting churn).
8. Preserve the target file's detected indentation (reuse `detectIndent`) and write atomically via a `.tmp-<pid>` file + `renameSync` (reuse `writeSettings`).

## Steps

- [x] Create `lib/scripts/merge-settings-hooks.js` as a new sibling file to `lib/scripts/merge-settings-deny.js` — do not add a new mode/flag to the deny script itself.
- [x] Copy `warnSkip`, `isPlainObject`, `deepEqual`, `readTarget`, `parseSettings`, `detectIndent`, and the atomic `writeSettings` (tmp file + `fs.renameSync`) from `merge-settings-deny.js` (~lines 31-111), with a provenance comment explaining why they're duplicated rather than imported/shared.
- [x] Implement `parseArgs` supporting `--target <path>` (default `~/.claude/settings.json` via `os.homedir()`) and `--source <path>` (default `lib/scripts/templates/settings-hooks.json` relative to `__dirname`); no other flags — this script has no `--set-key` mode.
- [x] Ensure the script **always exits 0**, including on malformed target JSON, a target `hooks` key that isn't an object, or a malformed/missing template — in every such case, warn to stderr and leave the target file completely untouched.
- [x] Define **owned entry**: a hook entry whose `command` matches `node ~/.claude/hooks/<name>.js` (or equivalent absolute-path form used by the template) where `<name>` (the basename, extension stripped) also appears in the template. Any entry not matching this shape is **foreign** and must never be modified, reordered, or removed by the algorithm.
- [x] Top-level case: if the target file doesn't exist, or exists but has no `hooks` key at all → set `hooks` to a deep copy of the template's `hooks` object entirely; treat this as "hooks wiring: created" (do not fall through to per-event/per-block logic in this case).
- [x] Iterate **only** the events present in the template (the 4 shipped: `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure` per TASK-032's template) — never visit or touch any other event key already present in the user's `hooks` object (e.g. `UserPromptSubmit` stays completely untouched even though it's a valid hooks event).
- [x] Per template event: if that event key is absent in the target's `hooks`, deep-copy the template's blocks for that event into the target.
- [x] Per template event that **is** present in target: for each template block `T` (an entry in the event's array, typically `{ matcher, hooks: [...] }`), find a target block `B` in that event's array by **matcher equality**, preferring a candidate block that already contains ≥1 owned entry if multiple target blocks share the same matcher.
- [x] If no matching-matcher block is found, attempt **drift adoption** before appending: look for a target block that is "pure-owned" (every hook entry in it is an owned entry, i.e. no foreign/user entries) whose matcher does **not** match any template matcher, but which shares ≥1 owned basename with `T`. If found, rewrite that block's matcher to `T`'s matcher in place (this propagates a matcher rename from the template without duplicating the block). Never perform drift adoption on a **mixed** block (one containing any foreign/user entry) — mixed blocks must never have their matcher rewritten.
- [x] If neither a matcher match nor a drift-adoption candidate is found, append a fresh copy of `T` (matcher + all its template hook entries) to the event's block array.
- [x] Once a target block `B` is selected/created/adopted for template block `T`, merge entries: for each hook entry `E` in `T`, find an owned entry with the same basename already in `B`. If found and not deep-equal to `E`, **replace it in place** (same array position) with `E`. If found and already deep-equal, leave it (no-op, no "change" recorded).
- [x] If an entry with `E`'s basename is **not** found in `B`, but the same basename exists elsewhere in the same event inside a different, **mixed** block (a block containing at least one foreign/user entry) — leave that entry completely untouched, **warn** to stderr that it appears relocated/duplicated, and do **not** duplicate `E` into `B`. "Never remove/duplicate user-adjacent content" wins over "propagate the template" in this case.
- [x] Otherwise (basename not found anywhere relevant in this event) — append `E` to `B`'s hook-entry array. This is the mechanism that auto-wires a newly-added repo hook into every user's settings on the next `install-global.sh`/`update` run.
- [x] Never modify, reorder, or remove any foreign entry or any block that isn't matched/adopted/appended per the rules above — foreign content is completely inert to this algorithm.
- [x] Track whether any change (block created, block adopted/matcher-rewritten, entry replaced, entry appended, or top-level `hooks` created) actually occurred during the run.
- [x] If no change occurred, print `hooks wiring already up to date` to stdout and do **not** write the file.
- [x] If changes occurred, print one line per change (e.g. `  + <event>/<basename> appended`, `  ~ <event>/<basename> replaced`, `  ~ <event> matcher adopted: <old> -> <new>`) followed by a summary line `hooks wiring: N change(s) applied` (or `hooks wiring: created` for the fresh-target/no-hooks-key case), and write the file atomically preserving detected indentation.
- [x] Verify the script runs standalone via `node lib/scripts/merge-settings-hooks.js --target <scratch-file> --source lib/scripts/templates/settings-hooks.json` against a handful of manually-constructed scratch `settings.json` fixtures covering: no file, file with no `hooks` key, up-to-date file (no-op), drifted matcher on a pure-owned block, mixed block with a relocated repo hook, and a template block/entry not yet present in target — confirming exit code 0 in every case and that untouched fixtures produce byte-identical output on a second run.

  Verified (scratch fixtures under `/private/tmp/.../scratchpad/hooks-verify2/`, `~/.claude/settings.json` never touched): no target file → created; no-`hooks`-key target → created (other keys preserved); idempotent re-run → byte-identical, "already up to date"; drifted matcher on pure-owned block → adopted in place, no duplicate block; mixed block with relocated repo hook → entry left in place + warning, no duplication; missing block + missing entry in an otherwise-present event → both appended, nothing else touched; drifted owned entry (missing flag) → replaced in place, no duplication; malformed target JSON / non-object `hooks` / malformed template → warn to stderr, file byte-identical to before, exit 0; tab-indentation preserved. Additionally verified: a foreign command referencing a basename that collides with a shipped hook name but lives outside `.claude/hooks/` (e.g. `node /repo/lib/hooks/protected-write-guard.js`) is correctly classified as foreign and left completely untouched — this required tightening `extractBasename`'s regex mid-task to require the literal `.claude/hooks/` path segment (see Notes below).

  Fix-loop note (UAT-EDGE-002, 2026-07-31): the merge previously pushed a fresh `{matcher, hooks: []}` placeholder block into the target event array *before* processing the block's entries. When every entry of that template block hit the "relocated into a mixed block — warn, don't insert" path while a different block produced a real change in the same run (so a write occurred), the empty placeholder was persisted to disk. Fixed by deferring the push: a run-created block now only joins the event array after the entry loop, and only if `block.hooks.length > 0`. Pre-existing empty blocks in the user's settings are unaffected (foreign content stays inert — only blocks this run created can be withheld). Verified: UAT-EDGE-002's compound repro now passes, all 8 other UAT-033 scenarios re-run green, plus a foreign pre-existing empty block survives a write untouched.

## Notes for the implementing agent

- Do not write `lib/scripts/templates/settings-hooks.json` here — that is TASK-032's deliverable; this task consumes it as the default `--source`. If TASK-032 is not yet merged, use a hand-built fixture matching the shape described in the plan (`SessionStart`, `PreToolUse` ×10 blocks, `PostToolUse`, `PostToolUseFailure`; commands of the form `node ~/.claude/hooks/<name>.js`; `env-content-read-guard.js` has its own triple-matcher block; `mv-absolute-path-block.js` carries an `"if": "Bash(mv *)"` key alongside `command`) to develop and self-test against, but do not commit that fixture as the real template.
- Do not modify `lib/scripts/install-global.sh`, `lib/scripts/lib.sh`, or any README — those are downstream tasks (TASK-034/TASK-035) that call this script once it exists.
- Do not write `test/settings-hooks.test.js` as part of this task unless explicitly folded in later — the full test suite is its own downstream deliverable per the roadmap's implementation order, though ad-hoc scratch verification per the last step above is expected before marking this done.
- Full authoritative source for every edge case above: `/Users/davidtaylor/.claude/plans/ok-now-parallel-cerf.md`, section "Changes → 2. New merge script" and the "Tests" section (for the behavioral cases this script must support, even though writing the test file itself is out of scope here).

## Implementation note (post-hoc)

Mid-task correctness fix: the first draft's `extractBasename()` matched any path segment literally named `hooks` immediately before `<name>.js` (i.e. `/hooks[\\/]([^\\/\s"']+)\.js\b/`), which did not require the directory to specifically be `.claude/hooks`. That risked misclassifying a foreign/user hook living under some unrelated `hooks/` directory (e.g. a project-local `lib/hooks/foo.js`) as "owned" if its basename happened to collide with one of the 18 shipped hook names — a foreign-content-safety violation, which is the one invariant this algorithm exists to protect. The regex was tightened to require the literal `.claude/hooks/` segment (accepting both the `~/.claude/hooks/...` form and an absolute-path expansion of it), and re-verified with a new fixture: a foreign command `node /repo/lib/hooks/protected-write-guard.js` (basename collision, wrong directory) is now correctly left untouched with no warning and no replacement.

<!-- Updated: 2026-07-31 -->
