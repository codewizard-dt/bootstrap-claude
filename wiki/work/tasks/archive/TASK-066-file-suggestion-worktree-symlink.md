---
id: TASK-066
aliases: [TASK-066]
title: "Fix fileSuggestion @-autocomplete for git worktrees with symlinked wiki/raw"
status: done
created: 2026-08-20
updated: 2026-08-21
depends_on: []
blocks: []
parallel_safe_with: [TASK-031, TASK-039, TASK-060]
uat: "[[UAT-066]]"
tags: [claude-code, autocomplete, git-worktree, fileSuggestion, bug]
---

# TASK-066 — Fix fileSuggestion @-autocomplete for git worktrees with symlinked wiki/raw

derived_from::[[file-suggestion-worktree-symlink-gap]]

## Objective

Fix `lib/scripts/templates/file-suggestion.sh` so `@`-autocomplete correctly re-includes the sentinel-scoped `wiki/`/`raw/`/`.serena/` directories when run from a git worktree (not just the main checkout), including when those directories are symlinked into the worktree from the main checkout. Two independent, compounding bugs must both be fixed — fixing only one still leaves the picker blind in the worktree+symlink case. See `wiki/knowledge/concepts/file-suggestion-worktree-symlink-gap.md` for the full diagnosis.

## Approach

- **Bug 1 (exclude-file resolution)**: `sentinel_entries()` currently guards on `[ -f .git/info/exclude ]`, which assumes `.git` is a directory relative to cwd. In a linked worktree, `.git` is a `gitdir: <path>` pointer file, and the real, shared `info/exclude` lives in the main checkout's common git dir. Replace the hardcoded path with `git rev-parse --git-common-dir` resolution: it prints `.git` when run from the main worktree and the absolute common-dir path when run from a linked worktree, so one code path covers both. Fall back to the current no-git-repo behavior (return 0, no re-inclusion) when `git` is absent or the command fails — do not regress the existing non-git-repo test case.
- **Bug 2 (symlink traversal)**: `list_reincluded()`'s `rg --files --no-ignore "$dir"` call and its `find "$dir" -type f` fallback do not follow symlinks by default. Add `--follow` to the `rg` invocation and `-L` to the `find` invocation, scoped to `list_reincluded()` only — do not change `list_base()`'s `rg --files` (tracked files are not expected to be symlinked directories, and changing base-listing traversal is out of scope).
- Preserve every existing behavior and test in `test/file-suggestion.test.js`: sentinel scoping, comment-block termination, absolute/parent-traversal rejection, hostile-query escaping, the 15-result cap, the git-ls-files and find fallbacks, and the installed-artifact (shebang/+x) check. This is an additive fix, not a rewrite.
- **No new wiring needed for auto-propagation.** `lib/scripts/install-global.sh` already unconditionally `cp`s `templates/file-suggestion.sh` → `~/.claude/file-suggestion.sh` on every run (no existence/copy-once guard — the script is template-owned and always refreshed), and both `setup-project.sh` and `update-project.sh` invoke `install-global.sh --skip-mcps` first. So once this fix lands in the template, running `npx @codewizard-dt/bootstrap update` (or `setup`/`install`) picks it up automatically for every existing installation — verify this behavior explicitly (step 4) rather than assuming it, since nothing currently pins it down with a test.

## Steps

### 1. Fix exclude-file resolution for worktrees  <!-- agent: general-purpose -->

- [x] In `lib/scripts/templates/file-suggestion.sh`'s `sentinel_entries()`, replace the hardcoded `[ -f .git/info/exclude ] || return 0` and the trailing `awk ... .git/info/exclude` target with a resolved common-dir path:
  - `common_dir=$(git rev-parse --git-common-dir 2>/dev/null) || return 0`
  - `exclude_file="$common_dir/info/exclude"`
  - `[ -f "$exclude_file" ] || return 0`
  - Pass `$exclude_file` to the `awk` call instead of the literal `.git/info/exclude`.
- [x] Verify this still works unmodified from the main worktree (where `git rev-parse --git-common-dir` prints `.git`, a path relative to cwd — the script already `cd`s into `CLAUDE_PROJECT_DIR` first, so this resolves correctly without extra handling).

<!-- Updated: 2026-08-20 -->
> **Step 1 done.** `sentinel_entries()` now resolves `common_dir=$(git rev-parse --git-common-dir 2>/dev/null) || return 0`, reads `$common_dir/info/exclude`, and passes that path to `awk`. `bash -n lib/scripts/templates/file-suggestion.sh` passes. No runtime verification yet — deferred to step 4.

### 2. Follow symlinks in the re-inclusion pass  <!-- agent: general-purpose -->

- [x] In `list_reincluded()`, change `rg --files --no-ignore "$dir"` to `rg --files --no-ignore --follow "$dir"`.
- [x] Change the `find "$dir" -type f | sed 's|^\./||'` fallback to `find -L "$dir" -type f | sed 's|^\./||'`.

<!-- Updated: 2026-08-20 -->
> **Step 2 done.** `list_reincluded()` now calls `rg --files --no-ignore --follow "$dir"` and `find -L "$dir" -type f`. `bash -n` passes. `list_base()` and `sentinel_entries()` untouched by this step.

### 3. Add regression tests to test/file-suggestion.test.js  <!-- agent: general-purpose -->

- [x] Add a worktree fixture helper alongside the existing `mkRepo`/`scratchDir` helpers: create a bare or full git repo, then `git worktree add <path> -b <branch>` a second checkout from it. Write the canonical sentinel block to the **main** checkout's `.git/info/exclude` (the shared file) and fixture files (reuse `FIXTURE_FILES` or a subset) under the main checkout.
- [x] New test: from the linked worktree's directory (as `CLAUDE_PROJECT_DIR`), with `wiki/`/`raw/` present as real directories there too (worktrees get their own working tree copy of tracked files, but for this test create them directly under the worktree path since the sentinel dirs are untracked), running the picker re-includes the sentinel-scoped paths — proving Bug 1's fix (this must fail against the pre-fix script; verify by temporarily reverting to confirm the repro, per this repo's existing "BUG REPRO" test convention, then leave only the passing post-fix assertions in the committed test).
- [x] New test: same worktree setup, but make `wiki/` (or another sentinel dir) a **symlink** (`fs.symlinkSync`) inside the worktree pointing at a real directory containing fixture files (e.g. the main checkout's copy, or a separate scratch dir) — the picker must still list files inside it, proving Bug 2's fix. Include a companion assertion that without `--follow` this would return nothing (either by documenting the pre-fix repro in a comment, matching the "BUG REPRO" pattern used elsewhere in this file, or by a literal repro test).
- [x] Confirm no existing test regresses: the non-git-repo case, the no-`.git/info/exclude`-present case, and the plain main-worktree cases must all still pass unchanged.
- [x] Clean up worktrees in test teardown (`git worktree remove` or plain `rmSync` on the scratch dirs is sufficient since these are throwaway repos under `os.tmpdir()`).

<!-- Updated: 2026-08-20 -->
> **Step 3 done — 24/24 passing (20 pre-existing + 4 new), stable across repeated runs.** Added `mkWorktree`/`cleanupWorktree`/`revertFix(bug)` helpers to `test/file-suggestion.test.js` matching existing conventions; `revertFix` derives a pre-fix scratch copy of the *live* script via targeted string substitution (never touches the committed file) for BUG REPRO tests. 4 new tests: worktree re-inclusion works (Bug 1), BUG REPRO proving the pre-fix hardcoded path is blind from a worktree, symlinked sentinel dir still traversed (Bug 2), BUG REPRO proving the pre-fix `find` fallback (no `-L`) misses a symlinked dir.
> **Empirical finding:** `rg` already dereferences a symlink passed as its own top-level argument even without `--follow` — no observable difference from `--follow` via the `rg` path in this environment. `-L` on the `find` fallback is the change that produces a real, deterministic repro/fix. `--follow` is kept anyway (correct per rg's documented semantics for nested symlinks and cheap insurance), and REPRO test 4 deliberately forces the `find` fallback (restricted `PATH`) to get a real before/after. No leftover worktrees/scratch state in the real repo (`git status`/`git worktree list` clean).

### 4. Verify, including auto-propagation via update  <!-- agent: general-purpose -->

- [x] `bash -n lib/scripts/templates/file-suggestion.sh`
- [x] `npm test` (or `node --test test/`) green, including the new worktree/symlink cases
- [x] Add (or extend, if a suitable one already exists) a test in `test/install-global.test.js` proving the template-refresh behavior this fix depends on: write a stale/older `~/.claude/file-suggestion.sh` (e.g. content missing the `--follow` flag) into a scratch `HOME`, run `install-global.sh` (as the existing tests there already do, hermetically against a scratch `HOME`/`--target`), and assert the installed copy is now byte-identical to `lib/scripts/templates/file-suggestion.sh` — i.e. this fix (and any future template fix) is picked up automatically by `update`/`setup`/`install` with no extra wiring, and there is now a regression test pinning that down.
- [x] Manually confirm (or note as residual for UAT, matching TASK-029's precedent) that `git rev-parse --git-common-dir` behaves as expected on this machine's git version, from both a plain checkout and a `git worktree add`-created sibling

<!-- Updated: 2026-08-20 -->
> **Step 4 done.** `bash -n lib/scripts/templates/file-suggestion.sh` exits 0. Full `npm test`: 383/383 passing, 0 failures — nothing outside this task's files regressed. `test/file-suggestion.test.js` alone: 24/24. `test/install-global.test.js` alone: 8/8, including the new test `a stale installed file-suggestion.sh is refreshed to match the live template byte-for-byte` (seeds a stale pre-fix copy — `--follow` stripped from the `rg` call — into a scratch `HOME/.claude/file-suggestion.sh`, runs the real `install-global.sh` hermetically per this file's existing `buildTemplate`/`runInstall`/`scratchDir` conventions, and asserts the installed file is byte-identical afterward to the live `lib/scripts/templates/file-suggestion.sh`). Manual `git rev-parse --git-common-dir` check on git 2.50.1 (Apple Git-155): from the main checkout prints `.git`; from a throwaway `git worktree add`-created sibling (under the scratchpad, cleaned up after — `git worktree remove`, branch deleted, `git status`/`git worktree list` confirmed clean) prints the absolute path `/Users/davidtaylor/Repositories/bootstrap-claude/.git`. Both match the expected behavior the fix relies on — no residual for UAT needed on this point.
