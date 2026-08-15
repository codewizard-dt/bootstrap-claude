---
id: TASK-034
aliases: [TASK-034]
title: "Add test/settings-hooks.test.js — template invariants and merge behavior coverage"
status: done
created: 2026-07-31
updated: 2026-07-31
depends_on: [TASK-032, TASK-033]
blocks: [TASK-038]
parallel_safe_with: [TASK-035]
uat: "[[UAT-034]]"
tags: [install, hooks, tests]
---

# TASK-034 — Add `test/settings-hooks.test.js` — template invariants and merge behavior coverage

derived_from::[[ROADMAP-004]]

## Objective

Give `lib/scripts/templates/settings-hooks.json` (TASK-032) and `lib/scripts/merge-settings-hooks.js` (TASK-033) the same weight of test coverage `test/settings-deny.test.js` gives the deny-list merge: prove the template's shape is correct and stays correct as hooks are added, and prove the "template owns its blocks" merge algorithm behaves exactly as the plan at `/Users/davidtaylor/.claude/plans/ok-now-parallel-cerf.md` (section "Changes → 6. Tests") specifies — on scratch files only, never touching the real `~/.claude/settings.json`.

## Approach

Mirror `test/settings-deny.test.js` style throughout: `node:test` + `node:assert`, `fs.mkdtempSync`-based scratch directories cleaned up with `fs.rmSync(dir, { recursive: true, force: true })` after each test, and a `run(args)` helper that spawns `merge-settings-hooks.js` via `execFileSync`/`spawnSync` with explicit `--target <scratchPath>` (and `--source <templatePath>` where a non-default template is needed) so the real settings file is never opened. Load `lib/scripts/templates/settings-hooks.json` and the `.js` files under `lib/hooks/` (top level only) as fixtures the same way the deny test loads `entries` from `settings-deny.json`.

Two `describe`-style sections (plain comment banners, matching the existing file's `// --- section ---` convention are fine — no `describe` blocks are used there):

1. **Template invariants** — static assertions against the JSON file itself, no subprocess needed.
2. **Merge behavior** — each scenario spawns the real script against a scratch target and asserts on the resulting file (and stdout/stderr where the deny test does the same, e.g. drift/duplicate warnings).

The file must be named `test/settings-hooks.test.js` — `package.json`'s `test` script is `node --test 'test/*.test.js'`, so no wiring beyond correct naming and placement is needed for `npm test` to pick it up.

## Steps

- [x] Create `test/settings-hooks.test.js` with the shared scaffolding: imports (`node:test`, `node:assert`, `node:fs`, `node:path`, `node:child_process`), `REPO`/`TEMPLATE`/`MERGE` path constants (`lib/scripts/templates/settings-hooks.json`, `lib/scripts/merge-settings-hooks.js`), a `scratchDir()` helper using `fs.mkdtempSync`, and a `run(args)` helper that spawns the merge script and returns `{ status, stdout, stderr }`, following `test/settings-deny.test.js`'s existing helpers as the pattern to match
- [x] **Template invariant: valid JSON** — `JSON.parse` the template file does not throw; top-level value is a plain object (not an array — contrast with the deny template's bare-array shape)
- [x] **Template invariant: exactly the 4 event keys** — assert `Object.keys(template)` is exactly `['SessionStart', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure']` (order-insensitive set comparison), so a stray `UserPromptSubmit` or typo'd key fails loudly
- [x] **Template invariant: every command is `node ~/.claude/hooks/<file>.js`** — walk every block/entry in every event and assert each `command` string matches `^node ~/\.claude/hooks/[\w-]+\.js$` (allow the `mv-absolute-path-block.js` entry's surrounding `if` wrapper structure — assert on the extracted command substring, not the raw string, if the entry has an `if` key)
- [x] **Template invariant: bijection with `lib/hooks/*.js`** — list `.js` files directly under `lib/hooks/` (excluding the `lib/hooks/lib/` subdirectory and `README.md`), derive the basename set from every `command` in the template, and assert the two sets are equal in both directions: every hook file is wired (nothing added-but-forgotten) and every wired command names a file that still exists (nothing wired-but-deleted). Report the specific missing/extra basenames on failure, not just a boolean, matching the diagnostic style of the deny test's `no duplicate entries` test
- [x] **Template invariant: `env-content-read-guard.js` keeps its own triple-matcher block** — locate the block(s) containing an entry whose command names `env-content-read-guard.js` and assert its `matcher` is the expected 3-alternative pattern (per `lib/hooks/README.md`'s wiring section) and that it is not merged into a different tool's block
- [x] **Template invariant: `claude-settings-guard.js` matcher is exactly `Edit|Write|NotebookEdit|MultiEdit`** — find the block containing its entry and assert `matcher === 'Edit|Write|NotebookEdit|MultiEdit'` verbatim (order and pipe-separation matter — this is the exact string the plan calls out)
- [x] **Template invariant: `mv-absolute-path-block.js` keeps its `if`** — assert the entry object for this hook has an `if` key equal to `"Bash(mv *)"` (per the plan's "Changes → 1" note), not just a bare `command`
- [x] **Merge: fresh target created** — `run(['--target', <nonexistent path under scratchDir>, '--source', TEMPLATE])`; assert exit 0, file now exists, and its parsed `hooks` key deep-equals the template; assert stdout reports creation (mirror the deny test's "merge creates a valid settings file when the target does not exist")
- [x] **Merge: existing keys and indentation preserved** — seed a scratch target with unrelated top-level keys (`model`, `env`) at a distinctive indent (tabs, per the deny test's tab-preservation case), run the merge, assert those keys are untouched and the file's indentation character is unchanged
- [x] **Merge: idempotent re-run is byte-identical** — run the merge twice against the same target; assert the second run's stdout says "already up to date" (or the script's actual wording — check `merge-settings-hooks.js`'s messages once TASK-033 lands) and the file bytes are identical before/after the second run
- [x] **Merge: drifted matcher on a pure-owned block is rewritten without duplication** — seed a target block whose matcher differs from the template's for a hook whose command basename appears only in that one block (no user entries in it); run the merge; assert the block's matcher is rewritten to match the template and no duplicate block for that hook was appended
- [x] **Merge: drifted entry replaced in place** — seed a target with an owned entry (matching `~/.claude/hooks/<name>.js`) whose command or other fields differ from the template's version; run the merge; assert the entry is replaced in place (same position) with the template's version, not duplicated
- [x] **Merge: mixed block preserves user entries and order, updates/appends repo entries** — seed a target block containing both a foreign/user hook entry and a repo-owned entry, in a specific order; run the merge; assert the user entry and its position are untouched, while the repo entry is updated or a missing repo entry is appended, without disturbing the user entry's index
- [x] **Merge: relocated repo hook in a mixed block is left untouched, warned, and not duplicated** — seed a mixed block where a repo-owned basename already appears somewhere unexpected within it (not matching the template's expected slot); run the merge; assert the entry is not moved or duplicated, and stderr contains a warning naming the relocated hook (per the plan's "never-remove wins over propagation" rule)
- [x] **Merge: foreign blocks and non-shipped events untouched** — seed a target with a `UserPromptSubmit` event and a fully-foreign `PreToolUse` block (no owned entries at all); run the merge; assert both are byte-for-byte untouched after
- [x] **Merge: new-hook-in-template is appended** — using a custom `--source` fixture template (written to scratch) that has one extra entry beyond what a pre-seeded target's matching block contains, run the merge; assert the new entry is appended to the existing block
- [x] **Merge: malformed JSON target is untouched, exit 0** — seed a target with unparseable garbage text; run the merge; assert exit status 0 and file bytes unchanged (mirror the deny test's malformed-target case)
- [x] **Merge: `hooks: "nope"` (wrong type) target is untouched, exit 0** — seed a target whose `hooks` key is a non-object (e.g. a string); run the merge; assert exit status 0 and file bytes unchanged (mirror the deny test's "skips when permissions.deny is not an array" case)
- [x] **Merge: three-writer sequence matches `test/settings-deny.test.js`'s existing install-order test (~lines 388-414)** — on one scratch target, run the deny merge (`merge-settings-deny.js --target <t> --source <denyTemplate>`), then the hooks merge (`merge-settings-hooks.js --target <t> --source <hooksTemplate>`), then the fileSuggestion `--set-key` step (`merge-settings-deny.js --target <t> --set-key fileSuggestion --set-value <SUGGESTION>`); assert all three survive together in one file (`permissions.deny`, `hooks`, and `fileSuggestion` all present and correct); then re-run all three again and assert the file is byte-identical to the first three-writer result (idempotent full sequence)
- [x] Run `npm test` locally and confirm `test/settings-hooks.test.js` is picked up by the `test/*.test.js` glob and all new cases pass alongside the existing suite

<!-- Updated: 2026-07-31 -->

## Implementation notes

- All 21 steps land in a single deliverable: `test/settings-hooks.test.js` (21 tests — 7 template invariants + 14 merge-behavior cases; count corrected at UAT generation, the note originally said 20/13). `npm test`: 134 tests, 0 failures; the `test/*.test.js` glob picked the file up with **no `package.json` change needed**.
- Beyond the plan's list, two extra cases cover TASK-033's post-generation deferred-push fix explicitly: (a) the UAT-EDGE-002 compound scenario — a fully-relocated template block plus a real change in the same run writes **no** empty `{matcher, hooks: []}` placeholder; (b) a pre-existing *user* empty block (`{matcher: "MyThing", hooks: []}`) survives a merge untouched — the guard only withholds blocks the run itself created.
- The mixed-block case also asserts in-place replacement of a drifted owned entry (extra `timeout` key stripped) at its original index, with the user entry's index-0 position preserved across the write.
- Safety invariant held: every spawn passes explicit `--target`/`--source` at `mkdtemp` scratch paths; the real `~/.claude/settings.json` is never read or written.
