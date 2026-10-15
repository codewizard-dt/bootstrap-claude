---
id: TASK-0094
aliases: [TASK-0094]
title: "Strip req-update's inline retire branch and redirect to /req-retire"
status: trashed
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: []
uat: "[[UAT-0094]]"
tags: [req-update, req-retire, skill-design, correctness]
---

# TASK-0094 — Strip req-update's inline retire branch and redirect to /req-retire

relates_to::[[wiki-skill-boilerplate-duplication]]

> **Trashed 2026-09-19:** superseded by [[TASK-0115]]: req-update removed entirely.

## Objective

`/req-update` carries an inline "Retiring branch" that flips `status: retired`, appends the reason to `## Notes`, removes the index row, and logs — but never performs the `git mv` into `wiki/work/requirements/archive/` nor appends to `archive/index.md`, both of which `/req-retire` (Step 5.5) does. A requirement retired via `/req-update` therefore ends up in a different state (retired status, still in the active directory, absent from the archive index) than one retired via `/req-retire`. Remove the duplicated branch from `/req-update` so `/req-retire` is the single owner of retirement, and make `/req-update` redirect to it.

## Approach

**Source-of-truth note**: edit `lib/skills/req-update/SKILL.md` in this repo, never `~/.claude/skills/req-update/` — that copy is machine-local and overwritten by `install-global.sh`.

Chosen fix: **strip and redirect**, not "copy the archive step into `req-update`". Copying would preserve the duplication that caused the drift; `req-retire` is already the dedicated, confirmation-gated, archive-aware flow (and its own body says it is "a focused shortcut for the retirement flow"). `/req-update` keeps its two real jobs — direct edits to `draft`, append-only amendments to `approved` — and, on retirement intent, stops and points at `/req-retire <ref> [reason]`. `/req-retire` already accepts both `draft` and `approved`, so the redirect applies to both statuses.

Scope boundaries:

- Only `lib/skills/req-update/SKILL.md` and a new contract test change. `lib/skills/req-retire/SKILL.md` is **not** edited — it is already correct. Its line 16 mention of "supersession ... `/req-update` with supersession intent" points at a `/req-update` capability that does not exist (no `superseded` branch anywhere in `req-update`); that stale pointer is a separate finding, deliberately left out of this task.
- `req-update`'s frontmatter `description` currently claims "set retired/superseded status"; the `retired` half is removed here because it becomes false. The `superseded` half was already false (no branch sets it) — dropping the whole phrase is the honest description.
- Phase 4 of `ROADMAP-0014` later removes `/req-update` entirely; this fix is still worth landing first because the bug is live today and independent of that rename work.

## Steps

### 1. Remove the inline retire branch from `req-update` <!-- agent: general-purpose -->

- [x] In `lib/skills/req-update/SKILL.md`, delete the `approved` (retiring) row from the behavior table (line ~20: "`approved` (retiring) | Set `status: retired`, append reason to `## Notes`, update wiki index, append log entry — use `/req-retire` ...").
- [x] Delete the entire "**Retiring branch**" block in Step 2 (the 7-item numbered list from "Ask for the retirement reason" through "Skip to Step 10 (report)").
- [x] In Step 2's status-branch table, edit the `approved` row to drop the trailing clause "; also check if the user intends to retire (see retiring branch below)".
- [x] Edit the frontmatter `description:` line to remove "; set retired/superseded status" so it reads: `Amend an approved requirement with a tracked Amendment block (append-only); apply direct edits to drafts; surface downstream decision/task impact`.
- [x] In Step 10's report table, change the "Branch taken" row to drop the `retired` option (`direct-edit (draft)` or `amendment (approved)`), and change "Amendment number" row's `(or `—` for direct-edit/retired)` to `(or `—` for direct-edit)`.

### 2. Add the redirect <!-- agent: general-purpose -->

- [x] In Step 2 (after the status-branch table), add a **Retirement intent** rule: if the requirement's status is `draft` or `approved` and the user's change instructions (from `$ARGUMENTS`) express intent to retire, deprecate, close out, or abandon the requirement (as opposed to amending its content), **STOP** and tell the user: "Retirement is handled by `/req-retire` (it also archives the file and updates the archive index). Run `/req-retire <ref> [reason]`." Make no edits, and do not ask for a retirement reason here.
- [x] Add the same one-line pointer to the top-of-file behavior table as a replacement for the removed row: `| any (retiring) | Not handled here — stop and redirect to `/req-retire` |`.
- [x] Add a CRITICAL Rule (append as rule 5, renumber subsequent rules) — "**Never retire from this skill** — retirement (status flip + `git mv` archive + archive index) is owned by `/req-retire`; redirect instead of reimplementing".
- [x] Confirm nothing else in the file still describes writing `status: retired` or a `req-retired` log entry (the only remaining `retired` mentions should be the refuse-on-terminal-status rows/rules).

### 3. Add a contract test <!-- agent: general-purpose -->

- [x] Create `test/req-update-retire-redirect.test.js`, mirroring the structure and header style of `test/wiki-lint-taskless-decisions.test.js` (zero-dependency, `node:test` + `node:assert/strict`, `'use strict'`, repo-relative `lib/skills/req-update/SKILL.md`, hermetic — no subprocess, no writes; a short comment block explaining why a doc-only skill change is tested).
- [x] Assert: the file no longer contains `**Retiring branch**`, no `req-retired` log-entry text, and no "Remove the requirement's row" index step; the `description:` frontmatter line does not contain `retired/superseded`; the behavior table has no `approved` (retiring) row that writes status.
- [x] Assert: the file contains a redirect to `/req-retire` inside Step 2 (between `## Step 2` and `## Step 3`), and a CRITICAL Rule containing "Never retire from this skill".
- [x] Assert: the `retired` and `superseded` refuse-and-stop rows (Step 2 table) and CRITICAL Rule 4 remain intact — the fix must not weaken terminal-status refusal.
- [x] Assert `lib/skills/req-retire/SKILL.md` is untouched in the relevant respect: still contains `git mv wiki/work/requirements/<file>.md wiki/work/requirements/archive/<file>.md` (guards against someone "fixing" the divergence in the wrong direction).
- [x] Run `node --test test/req-update-retire-redirect.test.js` and confirm it passes; then run `npm test` to confirm no sibling suite regressed. (New test 7/7 pass; `npm test` 529/535 — 6 failures in task-add/uat-generate/req-create/roadmap-create/task-audit skill contract tests, files outside this task's scope, owned by sibling in-flight work.)
<!-- Updated: 2026-09-19 -->

