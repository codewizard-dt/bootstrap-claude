---
title: Hot Cache
updated: 2026-08-21
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-21_

## Key Recent Facts

- **TASK-066 shipped, UAT'd, and archived: `@`-autocomplete now works in git worktrees with symlinked `wiki/`/`raw/`.** `lib/scripts/templates/file-suggestion.sh` fixed on both fronts diagnosed in [[file-suggestion-worktree-symlink-gap]]: `sentinel_entries()` resolves the shared `.git/info/exclude` via `git rev-parse --git-common-dir` (works from a linked worktree, not just the main checkout), and `list_reincluded()` now passes `--follow`/`-L` so symlinked sentinel dirs are traversed. 5 new unit tests (`test/file-suggestion.test.js` ×4, `test/install-global.test.js` ×1 proving the fix auto-propagates via `install-global.sh`'s unconditional template `cp` — no extra wiring needed for `update`/`setup`/`install`); full suite green at 383/383. UAT-066 walked interactively, all 3 cases passed, including a live Claude Code session in a real `git worktree add` sibling — the original bug report, confirmed fixed end-to-end. **Notable process finding**: the UAT's first-draft fixture pointed the worktree's symlinks at this repo's own `wiki/`/`raw/`, which has no bootstrap sentinel (same premise UAT-029 recorded) and so couldn't exercise the fix at all — corrected mid-walkthrough to a scratch git repo with a real sentinel, matching the unit tests' own `mkRepo`/`mkWorktree` convention. Also corrected a wrong Expected Result (an untracked fixture file doesn't propagate into a linked worktree — real git behavior, not a fix defect).
- **ROADMAP-008 is done and archived** (completed 2026-08-15, committed `c33808d`): Obsidian wikilink alias resolution.
- **`/roadmap-next` and `/roadmap-add` reworked** (committed `a5dafe3`): `/roadmap-next <roadmap>` now requires an explicit roadmap argument and groups items into parallelizable waves; `/roadmap-add` removed; new `/roadmap-assess` surveys all active roadmaps together.
- **ROADMAP-007 is done and archived** (default `.obsidian/graph.json` styling, committed `eb92073`, release 2.22.0).
- Only one active roadmap remains: **ROADMAP-001** (11/12 items checked, Phase 4 advisory locking deliberately deferred).
- **All three open bugs from earlier sessions fixed, verified, archived: [[BUG-0009]], [[BUG-0010]], [[BUG-0011]].** Only [[BUG-0001]]–[[BUG-0008]] remain open (older, unrelated).
- **`wiki/log.md` is now 750+ lines**, past the ~500-line rotation threshold — `/wiki-rotate-log` is due.

## Recent Changes

- Created (2026-08-20): `wiki/knowledge/concepts/file-suggestion-worktree-symlink-gap.md`.
- Created (2026-08-20, archived 2026-08-21): `wiki/work/tasks/archive/TASK-066-file-suggestion-worktree-symlink.md`, `wiki/work/uat/archive/UAT-066-file-suggestion-worktree-symlink.md`.
- Modified (2026-08-20/21, uncommitted): `lib/scripts/templates/file-suggestion.sh` (both fixes), `test/file-suggestion.test.js` (+4 tests), `test/install-global.test.js` (+1 test), `wiki/knowledge/entities/tools/claude-code-file-picker.md`, `wiki/index.md`, `wiki/work/tasks/index.md`, `wiki/work/uat/index.md`, `wiki/work/tasks/archive/index.md`, `wiki/work/uat/archive/index.md`, `wiki/log.md`.
- Committed since the last pre-existing hot-cache refresh (2026-08-15 → 2026-08-20): `c33808d` (ROADMAP-008 complete), `a5dafe3` (`/roadmap-next` single-roadmap mode + `/roadmap-assess`).

## Active Threads

- **Uncommitted work ready for `/git-commit`**: TASK-066's full fix + tests + wiki trail (all archived, all green) — likely the next natural action.
- **ROADMAP-001 (11/12, active)**, **TASK-031 (todo)**, **TASK-039 (pending-uat)**, **TASK-060 (todo)**, **BUG-0001–0008 (open, older, unrelated)**.
- **`wiki/log.md` rotation is due** (~750 lines, threshold ~500) — run `/wiki-rotate-log` next wiki-writing session.
- Carried forward, unconfirmed still-open: **Unresolved `update`-specific bug under investigation** (a `prompt_yn`/interactive-read issue on `update-project.sh` on a different machine — re-check status before treating as active).
- **Optional doc fix flagged**: `README.md` line 247 stale re: Serena scope.
- **Optional follow-up research flagged**: `${CLAUDE_PROJECT_DIR:-.}` expansion inside Serena's `--project` argument.
