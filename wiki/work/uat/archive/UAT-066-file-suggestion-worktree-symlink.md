---
id: UAT-066
aliases: [UAT-066]
title: "UAT: Fix fileSuggestion @-autocomplete for git worktrees with symlinked wiki/raw"
status: passed
task: TASK-066
created: 2026-08-20
updated: 2026-08-21
---

# UAT-066 — UAT: Fix fileSuggestion @-autocomplete for git worktrees with symlinked wiki/raw

implements::[[TASK-066]]

> **Source task**: [[TASK-066]]
> **Generated**: 2026-08-20

---

## What this UAT is and is not

Unlike `merge-gitignore.sh` (see UAT-029), neither bug this task fixes needs a tty — `file-suggestion.sh` reads stdin JSON and writes stdout, so the entire deterministic contract already lives in `test/file-suggestion.test.js` (4 new cases) and `test/install-global.test.js` (1 new case), all exercised by `/tackle`'s step 4. This file therefore carries only:

- **UAT-UNIT-001** — a pointer confirming the full suite is green, so nothing here duplicates what `node:test` already proves.
- **UAT-INSTALL-001** — refreshing the real `~/.claude/file-suggestion.sh` on this machine, which mutates real global config and needs explicit consent (same reasoning as UAT-029's UAT-INSTALL-003).
- **UAT-MANUAL-001** — the one thing nothing can automate: Claude Code's own `@` picker, in a live session, in a real `git worktree add`-created sibling with `wiki/`/`raw/` symlinked in. This is the original bug report and the only true end-to-end proof.

**Premise inherited from the task's findings, restated so nobody re-derives it:** `~/.claude/file-suggestion.sh` on this machine was installed before this fix (per TASK-029's UAT-INSTALL-003) and is now stale relative to the fixed template — it still has the hardcoded `.git/info/exclude` path and no `--follow`/`-L`. UAT-MANUAL-001 will not show the fix until UAT-INSTALL-001 refreshes it and the session is restarted.

---

## Prerequisites

- [ ] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude`; `node` (v18+), `git` (`--git-common-dir` requires git ≥ 2.5, ubiquitous), `bash` on `PATH`.
- [ ] Session variable, exported once:
  ```bash
  export REPO=/Users/davidtaylor/Repositories/bootstrap-claude && export UAT066=$(mktemp -d /tmp/uat-066-XXXXXX) && echo "$UAT066"
  ```
- [ ] **Nothing outside `$UAT066` may be written**, with the single exception of UAT-INSTALL-001 (`~/.claude/file-suggestion.sh`). This repo's own `.git/info/exclude` must be byte-identical before and after the whole run:
  ```bash
  md5 -q "$REPO/.git/info/exclude" 2>/dev/null || echo "no exclude file in this repo (expected — see UAT-029)"
  ```
  Record the value now (if any) and re-check it at the end.

---

## Test Cases

### UAT-UNIT-001: the repeatable suite covers both bug fixes and the auto-propagation guarantee

- **Scenario**: Everything deterministic about TASK-066 is now unit-tested — worktree `.git/info/exclude` resolution via `git rev-parse --git-common-dir`, both bug-reproduction states (pre-fix hardcoded path blind in a worktree; pre-fix `find` fallback blind on a symlink), and the `install-global.sh` template-refresh guarantee this fix depends on for automatic propagation.
- **Repeatable Unit Test**: Created (during `/tackle`): `test/file-suggestion.test.js` — 4 new cases (`a linked git worktree resolves the shared .git/info/exclude via --git-common-dir, so sentinel re-inclusion still fires`; `BUG REPRO — pre-fix hardcoded .git/info/exclude path is blind from a linked git worktree`; `a symlinked sentinel dir inside a linked worktree is still traversed for suggestions`; `BUG REPRO — pre-fix find fallback (no -L) cannot see a symlinked sentinel dir`) — and `test/install-global.test.js` — 1 new case (`a stale installed file-suggestion.sh is refreshed to match the live template byte-for-byte`).
- **Unit Test Command**: `node --test test/file-suggestion.test.js test/install-global.test.js`
- **Steps**:
  1. Run the full suite from the repo root:
     ```bash
     cd "$REPO" && npm test
     ```
- **Expected Result**: Exit 0, `fail 0`. As of generation the suite is **383/383 green** (5 of them new here). The two `BUG REPRO` cases assert the pre-fix *failure* state on a hand-reverted scratch copy of the live script, so a green run also confirms the tests can tell "fixed" apart from "was never broken."
- [x] Pass <!-- 2026-08-20 · `cd $REPO && npm test` → 383/383, exit 0. -->

---

### UAT-INSTALL-001: refreshing the installed picker picks up the fix with no extra wiring

> **This case writes outside `$UAT066`.** It overwrites `~/.claude/file-suggestion.sh` on this machine (already present and executable from TASK-029's install) and, if `~/.claude/settings.json` is missing/different keys, may touch that file too via the same merge path TASK-029 exercised. The deny-list merge is additive with no removal path. Get explicit go-ahead before running it, and do not run it as part of an automated sweep.

- **Scenario**: Confirm on this real machine — not just in the hermetic `test/install-global.test.js` case — that re-running the installer replaces the stale `~/.claude/file-suggestion.sh` with the fixed template, byte-for-byte, with no manual step.
- **Repeatable Unit Test**: Not applicable: mutates the user's real global configuration; no test may do that. (The hermetic equivalent is `test/install-global.test.js`'s new case, already covered by UAT-UNIT-001.)
- **Steps**:
  1. Record the before-state:
     ```bash
     md5 -q ~/.claude/file-suggestion.sh 2>/dev/null || echo "picker absent"
     ```
  2. Run the installer:
     ```bash
     bash "$REPO/lib/scripts/install-global.sh"
     ```
  3. Compare the installed copy against the live template:
     ```bash
     diff -q ~/.claude/file-suggestion.sh "$REPO/lib/scripts/templates/file-suggestion.sh" && echo "byte-identical"
     ```
- **Expected Result**: Step 1 shows the pre-fix md5 (present, since TASK-029's install already ran on this machine). Step 2 prints `Installing file suggestion picker (~/.claude/file-suggestion.sh)...` and completes without error (the `fileSuggestion` settings key is likely already registered from TASK-029, so expect `"fileSuggestion" already set` rather than a fresh-registration message — that is correct and does not block the file copy, which is unconditional). Step 3 prints `byte-identical`.
- [x] Pass <!-- 2026-08-21 -->

---

### UAT-MANUAL-001: `@`-autocomplete lists a symlinked wiki path from inside a git worktree, in a live session

**The one case nothing can automate — and the original bug report.** `@` is an interactive UI affordance with no headless trigger. This is the only end-to-end proof that a real `git worktree add`-created sibling, with `wiki/`/`raw/` symlinked in, now suggests those paths — the exact scenario that was broken before this task.

> **Corrected premise (found during the walkthrough, 2026-08-21):** the first draft of this fixture pointed the worktree's symlinked `wiki/`/`raw/` at *this* repo's real `wiki/`/`raw/` — but this repo carries no bootstrap sentinel in `.git/info/exclude` (`wiki/` is git-tracked here; same premise UAT-029 recorded), so neither the base listing (no `--follow`, by design — see TASK-066's Approach) nor the re-inclusion pass (nothing sentinel-scoped to re-include) would ever see it. That fixture proves nothing about the fix either way. Corrected to build a throwaway **scratch** git repo instead, matching `test/file-suggestion.test.js`'s `mkRepo`/`mkWorktree` and UAT-029's `mkfix.sh` convention — a real sentinel block in *its own* `.git/info/exclude`, never touching this repo's.

- **Scenario**: A scratch git repo carrying a real bootstrap sentinel, with a linked worktree whose `wiki/`/`raw/` are symlinks back into the scratch main checkout, opened in a fresh interactive session after UAT-INSTALL-001.
- **Repeatable Unit Test**: Not applicable: interactive UI affordance with no headless trigger. (The non-interactive equivalent of this exact fixture shape is `test/file-suggestion.test.js`'s new worktree/symlink cases, already covered by UAT-UNIT-001.)
- **Depends on**: UAT-INSTALL-001 (the installed picker must be the fixed one) and a full session restart afterwards.
- **Steps**:
  1. Build the scratch main checkout — fixture files plus a real sentinel block in its own `.git/info/exclude` — and confirm the *un-worktreed* picker sees it as a control:
     ```bash
     D=$(mktemp -d "$UAT066/main-XXXXXX") && mkdir -p "$D/wiki" "$D/raw" "$D/src" && printf 'x\n' > "$D/wiki/hot.md" && printf 'x\n' > "$D/raw/hotraw.md" && printf 'x\n' > "$D/src/hotsrc.txt" && git -C "$D" init -q && printf '%s\n' '# bootstrap machine-local (autocomplete-visible)' '.serena/' 'raw/' 'wiki/' > "$D/.git/info/exclude" && echo "$D" && printf '{"query":"hot"}' | CLAUDE_PROJECT_DIR="$D" ~/.claude/file-suggestion.sh
     ```
  2. Create a linked worktree off that scratch repo, replace its `wiki/`/`raw/` with symlinks back to the scratch main checkout's copies, and confirm the picker is correct *outside* Claude Code — if this is wrong, the UI test cannot succeed and diagnoses nothing:
     ```bash
     git -C "$D" worktree add "$UAT066/wt" -b uat-066-check -q && rm -rf "$UAT066/wt/wiki" "$UAT066/wt/raw" && ln -s "$D/wiki" "$UAT066/wt/wiki" && ln -s "$D/raw" "$UAT066/wt/raw" && printf '{"query":"hot"}' | CLAUDE_PROJECT_DIR="$UAT066/wt" ~/.claude/file-suggestion.sh
     ```
  3. **Fully quit every running Claude Code session** — the `fileSuggestion` command is invoked fresh per query, but confirm no stale session is pinned to an old working directory or cached picker state.
  4. Start a fresh interactive session in the worktree:
     ```bash
     cd "$UAT066/wt" && claude
     ```
  5. At the prompt type `@wiki/ho` (do not submit) and read the suggestion list.
- **Expected Result**:
  - Step 1 prints `wiki/hot.md`, `raw/hotraw.md`, `src/hotsrc.txt` (control: the picker works correctly against the scratch main checkout with no worktree involved).
  - Step 2 prints `wiki/hot.md` and `raw/hotraw.md` from inside the **linked worktree** with `wiki/`/`raw/` as **symlinks** — proving both TASK-066 fixes fire together (worktree `.git/info/exclude` resolution + symlink traversal), outside any Claude Code involvement. **`src/hotsrc.txt` is correctly absent here** — it was never committed in the scratch repo (no commits exist), so git never materializes it in the linked worktree at all; that is real git worktree behavior (only committed content is shared across worktrees; untracked files are per-worktree), not something this fix touches, and its absence is not a failure signal.
  - Step 5 offers `wiki/hot.md` in the live session — the exact combination (worktree + symlink) that was silently blind before this task.
  - **If step 5 shows nothing while step 2 printed the path**, the script is correct and the integration is not: check that the session was fully restarted and that `~/.claude/file-suggestion.sh` (not a cached copy) is being invoked.
- [x] Pass <!-- 2026-08-21 -->

---

## Post-run check

- [ ] This repo's `.git/info/exclude` is unchanged, if it existed before (see Prerequisites) — the scratch fixture never touches it:
  ```bash
  git -C "$REPO" status --short
  ```
- [ ] Scratch worktree removed (registered against the **scratch** main checkout `$D`, not `$REPO`):
  ```bash
  git -C "$D" worktree remove "$UAT066/wt" --force 2>/dev/null || rm -rf "$UAT066/wt"; git -C "$D" worktree prune 2>/dev/null; echo "worktree cleaned"
  ```
- [ ] Scratch root removed:
  ```bash
  rm -rf "$UAT066" && echo "cleaned"
  ```
