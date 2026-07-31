---
id: TASK-032
title: "Extract canonical hooks wiring from lib/hooks/README.md into lib/scripts/templates/settings-hooks.json"
status: done
created: 2026-07-31
updated: 2026-07-31
depends_on: []
blocks: [TASK-033, TASK-034]
parallel_safe_with: [TASK-036]
uat: "[[UAT-032]]"
tags: [install, hooks, settings]
---

# TASK-032 — Extract canonical hooks wiring from lib/hooks/README.md into lib/scripts/templates/settings-hooks.json

derived_from::[[ROADMAP-004]]

## Objective

Today the canonical `~/.claude/settings.json` hooks wiring exists only as a fenced JSON block inside `lib/hooks/README.md` (lines ~723-877), meant to be hand-pasted by a human. This task extracts that block into a standalone template file, `lib/scripts/templates/settings-hooks.json`, so a later merge script (TASK-033) can programmatically wire hooks the same way `merge-settings-deny.js` already wires the deny list from `lib/scripts/templates/settings-deny.json`. This is Phase 1 item 1 of ROADMAP-004 (the resilient hook install / automated settings.json wiring effort) and is a pure extraction — no merge logic, no `install-global.sh` changes, no README rewrite yet. Those are later tasks (TASK-033+) that depend on this template existing and being correct.

## Approach

The authoritative source for *what* this template must contain is the approved implementation plan at `/Users/davidtaylor/.claude/plans/ok-now-parallel-cerf.md`, section "Changes → 1. New template". Read it before starting — it is the spec, not just background:

- The template is a **bare `hooks`-value object** — i.e. it is the object that currently sits inside `{"hooks": {...}}` in the README, extracted **without** the wrapping `"hooks"` key. This mirrors `lib/scripts/templates/settings-deny.json`, which ships as a bare array rather than wrapped in `{"deny": [...]}`. Concretely: the template's top-level keys are `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure` — **not** a single `hooks` key containing those.
- The content must be extracted **byte-for-byte** from the JSON block in `lib/hooks/README.md` (currently around lines 724-876 — confirm the exact current line numbers before editing, since the file may have drifted). This includes:
  - `SessionStart`: 1 block (`serena-session-reset.js`)
  - `PreToolUse`: 10 blocks, in the order they appear in the README, including the block for `mv-absolute-path-block.js` which carries an `"if": "Bash(mv *)"` key that must be preserved exactly
  - `PostToolUse`: 1 block (`serena-usage-tracker.js`)
  - `PostToolUseFailure`: 1 block (`serena-usage-tracker.js` again — same script referenced from two different events, this is intentional, not a duplicate to collapse)
- Do not paraphrase, reformat matchers, reorder blocks, or "clean up" anything during extraction — later tasks (the merge script and its test suite) depend on this file matching the README's block exactly so that a byte-diff-style verification is possible.

## Steps

- [x] Read `/Users/davidtaylor/.claude/plans/ok-now-parallel-cerf.md` in full (short file) to confirm the template's exact shape and where it fits in the overall change set — do not start extraction from memory of this task file alone.
- [x] Open `lib/hooks/README.md` and locate the exact fenced JSON code block under the `## Required ~/.claude/settings.json wiring` heading (near the plan's cited ~724-876, but re-locate by searching for the heading and the opening ` ```json ` fence rather than trusting line numbers, since the file may have shifted). Confirmed at heading line 718, fence 723-877 — no drift.
- [x] Confirm the block contains exactly these events, in this order, with this shape: `SessionStart` (1 array entry), `PreToolUse` (10 array entries), `PostToolUse` (1 array entry), `PostToolUseFailure` (1 array entry).
- [x] Confirm the `mv-absolute-path-block.js` entry inside the `Bash` `PreToolUse` block still carries `"if": "Bash(mv *)"` — this is the one hook entry with a conditional filter and it must not be dropped or altered during extraction.
- [x] Create `lib/scripts/templates/settings-hooks.json` containing **only** the inner object (the value that was under the `"hooks"` key in the README's `{"hooks": {...}}` block), so the file's own top-level keys are `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure` — copied byte-for-byte from the README block (whitespace/formatting may be re-indented consistently, but keys, string values, array order, and the `if` filter must not change).
- [x] Verify the bijection between hook commands referenced in the new template and the hook scripts actually shipped in `lib/hooks/`: list the `.js` files directly inside `lib/hooks/` (excluding the `lib/hooks/lib/` subdirectory and `lib/hooks/README.md`) — there should be exactly 18 files — and confirm every `command` string in the template (`node ~/.claude/hooks/<name>.js`) resolves to one of those 18 basenames, and every one of the 18 basenames appears at least once as a command in the template. `serena-usage-tracker.js` is expected to appear **twice** (once under `PostToolUse`, once under `PostToolUseFailure`); every other basename should appear exactly once. Record the mapping (a simple table or list is fine) in your completion notes so TASK-033's test suite has a documented bijection to encode as an assertion.

  **Bijection mapping (18 basenames, all present, verified):**

  | basename | event(s) |
  |---|---|
  | serena-session-reset.js | SessionStart |
  | env-file-guard.js | PreToolUse |
  | claude-settings-guard.js | PreToolUse |
  | env-content-read-guard.js | PreToolUse |
  | serena-first-read-guard.js | PreToolUse |
  | serena-edit-guard.js | PreToolUse |
  | serena-write-guard.js | PreToolUse |
  | serena-first-guard.js | PreToolUse |
  | serena-first-glob-guard.js | PreToolUse |
  | serena-pre-delegation.js | PreToolUse |
  | serena-bash-grep-block.js | PreToolUse |
  | mv-absolute-path-block.js | PreToolUse (carries `"if": "Bash(mv *)"`) |
  | git-protected-ops-block.js | PreToolUse |
  | interpreter-indirection-guard.js | PreToolUse |
  | package-install-consent.js | PreToolUse |
  | absolute-path-guard.js | PreToolUse |
  | protected-write-guard.js | PreToolUse |
  | serena-usage-tracker.js | PostToolUse, PostToolUseFailure (2×) |

- [x] Validate the new file is syntactically valid JSON, e.g. via `node -e "JSON.parse(require('fs').readFileSync('lib/scripts/templates/settings-hooks.json', 'utf8')); console.log('ok')"` (or an equivalent one-liner) run from the repo root. Fix and re-validate if it fails. Result: `ok`.
- [x] Check `package.json`'s `files` array: confirm `lib/` is listed (it is, unqualified, alongside negations for `raw/research/`, `raw/companies/`, and `raw/*.pdf` — none of which touch `lib/scripts/templates/`), so the new template ships in the npm tarball without any additional entry. If a future edit ever adds a `lib/`-scoped negation, this file must not be excluded by it — note that constraint rather than assuming it's safe forever. Confirmed, no edit made.
- [x] Do not modify `lib/hooks/README.md` in this task — leave the existing inline JSON block in place. Replacing it with a pointer to the new template is explicit follow-up work (covered by a later ROADMAP-004 task, e.g. TASK-034), not part of this extraction. Confirmed untouched.
- [x] Do not create, modify, or wire up any merge script (`lib/scripts/merge-settings-hooks.js`) in this task — that is TASK-033. This task's deliverable is the template file alone. Confirmed — no merge script created.
- [x] Confirm no other files were changed: `git status` should show exactly one new file, `lib/scripts/templates/settings-hooks.json`. Confirmed — only that file is new/attributable to this task; other working-tree changes present belong to concurrent agents on other tasks (TASK-036 editing `lib/scripts/lib.sh`, etc.) and were not touched by this task.

<!-- Updated: 2026-07-31 -->
