---
id: TASK-0125
aliases: [TASK-0125]
title: "Document pending-uat as a task status in the lifecycle, index headers, /primer check and dashboard"
status: pending-uat
created: 2026-09-20
updated: 2026-09-20
depends_on: []
blocks: [TASK-0126]
parallel_safe_with: []
origin_bug: ""
uat: "[[UAT-0125]]"
tags: [lifecycle, status, tasks, dashboard, doc-drift]
---

# TASK-0125 — Document pending-uat as a task status in the lifecycle, index headers, /primer check and dashboard

relates_to::[[whats-next]]
blocks::[[TASK-0126]]

## Objective

`pending-uat` is a live task status — `/tackle` writes it when every step is checked, `/roadmap-next`, `/power-mode` and `UAT-CORE.md` read it, and 24 of 31 active tasks carry it (2026-09-20) — yet it is missing from every place that defines or enumerates task statuses. Add it, consistently, to both `tasks/lifecycle.md` copies, both `tasks/index.md` headers, `/primer`'s index-consistency check, and the dashboard's status-tone map (today all `pending-uat` tasks render with **no badge**: `statusKeyword()` rejects the `pending` keyword because it is followed by `-`, and there is no `pending-uat` key). Pin it with a lockstep test. No skill behaviour changes beyond `/primer`'s one consistency-check sentence.

## Approach

Documentation-and-data fix, no behaviour redesign. The lifecycle doc is template-owned and always refreshed by `sync-wiki-scaffold.sh`, so the **template is the source of truth**: edit `lib/scripts/templates/wiki/work/tasks/lifecycle.md` first, then apply the identical edit to `wiki/work/tasks/lifecycle.md` and give both the same `updated:` date so their bodies and frontmatter match. Make every edit a minimal, anchored `Edit` after a fresh `Read` — sibling ROADMAP-0014 tasks are editing nearby files concurrently; never rewrite a file whole.

Chosen state model: `todo ──▶ in-progress ──▶ pending-uat ──▶ done`, with `trashed` reachable from any non-terminal state. `pending-uat` is an **active** state (it stays in `index.md`); only `done`/`trashed` are terminal. Dashboard tone: `accent` (in-flight, like `in-progress`) — the tone set is `neutral | accent | good | bad | muted`.

## Steps

### 1. Lifecycle docs (template first, then live)  <!-- agent: general-purpose -->

- [x] `Read` `lib/scripts/templates/wiki/work/tasks/lifecycle.md`, then `Edit`:
  - `status` row (line 18): `` `todo \| in-progress \| pending-uat \| done \| trashed` ``
  - transition diagram (lines 33-37) becomes
    ```
    todo ──▶ in-progress ──▶ pending-uat ──▶ done
      │            │              │
      └────────────┴──────────────┴──▶ trashed
    ```
  - add a bullet between **in-progress** and **done**: `**pending-uat** — implementation complete: every `## Steps` checkbox is checked and `/tackle` set this status. Awaiting verification — `/uat-create` if no UAT exists yet, then `/uat-walk` / `/uat-auto`. Still an active state (stays listed in `index.md`).`
  - reword the **done** bullet's lead so it reads "verification finished — its UAT passed (...) or was explicitly skipped (`/uat-skip`)"; keep the trailing sentence "A task reaches **done** only when its UAT is all-pass or skipped".
  - line 10: make explicit that only `done`/`trashed` are terminal (already says so) — leave unchanged if it already does.
  - bump `updated:` (line 3) to `2026-09-20`.
- [x] Apply the byte-identical body edits to `wiki/work/tasks/lifecycle.md` (its `updated:` is already `2026-09-19` — set it to `2026-09-20`). Afterwards the two files must be byte-identical. <!-- Updated: 2026-09-20 --> (The live copy already carried a "3-digit names" paragraph the template lacked; added it to the template so the copies are byte-identical — verified with `cmp`.)

### 2. Index headers  <!-- agent: general-purpose -->

- [x] `lib/scripts/templates/wiki/work/tasks/index.md` line 7 and `wiki/work/tasks/index.md` line 8: change "(`todo`, `in-progress`)" to "(`todo`, `in-progress`, `pending-uat`)". Do not touch any bullet rows or the `updated:` of the live index beyond what `Edit` hygiene requires.

### 3. /primer consistency check  <!-- agent: general-purpose -->

- [x] `lib/skills/primer/SKILL.md` line 81: change "(frontmatter `status: todo` or `in-progress`)" to "(frontmatter `status: todo`, `in-progress` or `pending-uat`)". Nothing else in that line changes.

### 4. Dashboard status tone  <!-- agent: general-purpose -->

- [x] In `lib/scripts/templates/wiki/dashboard.html` add `'pending-uat': 'accent',` to `STATUS_TONES` directly after `'in-progress': 'accent',` (line ~887). `statusKeyword()` needs no change: it already scans every key with word-boundary checks, and `pending-uat` (idx 0, followed by end-of-string or a space) matches, while the shorter `pending` keyword is correctly rejected inside it.
- [x] Apply the same one-line edit to the live copy `wiki/dashboard.html` (an always-refresh scaffold copy of the template). Do **not** overwrite either whole file — both carry unrelated uncommitted edits.

### 5. Sweep for other task-status enumerations  <!-- agent: Explore -->

- [x] `search_for_pattern` (default multiline, use `[^\n]*` not `.*`; full repo-relative globs) over `lib/skills/`, `lib/scripts/`, `wiki/work/`, `README.md`, `CLAUDE.md`, `.serena/memories/` for lists of task statuses that omit `pending-uat` (e.g. `` `todo`, `in-progress` `` or `todo | in-progress | done`). Fix each genuine omission with an anchored `Edit`; record every hit and its disposition (fixed / intentionally not a status list) in the task's Notes. `wiki/work/uat/lifecycle.md` gets one cross-reference sentence only if it describes task status and omits `pending-uat`.

### 6. Lockstep test  <!-- agent: general-purpose -->

- [x] Create `test/task-lifecycle-pending-uat.test.js` (zero-dependency `node:test` + `node:assert/strict`, read-only, no subprocess — mirror `test/adr-rename-invariants.test.js`). Cases:
  - both `tasks/lifecycle.md` copies are byte-identical, their `status` enum contains `pending-uat` between `in-progress` and `done`, and the diagram line contains `in-progress ──▶ pending-uat ──▶ done`;
  - both `tasks/index.md` headers name `pending-uat` among the active statuses;
  - `lib/skills/primer/SKILL.md` names `pending-uat` in its consistency-check sentence;
  - in both dashboard copies `STATUS_TONES` has a `'pending-uat'` key, and — extracting `STATUS_TONES` and `statusKeyword` source with a regex and evaluating them in `node:vm` — `statusKeyword('pending-uat')` returns `'pending-uat'`, `statusKeyword('todo')` returns `'todo'`, and `statusKeyword('pending')` still returns `'pending'` (guards the word-boundary rule);
  - regression guard: every task status literally written by `lib/skills/tackle/SKILL.md` (`pending-uat`, `in-progress`) is a member of the lifecycle enum.
- [x] Run file-scoped (new test 7/7 pass; the three sibling suites 32/32 pass): `node --test test/task-lifecycle-pending-uat.test.js`, then `node --test test/backfill-wiki-aliases.test.js test/wiki-work-naming-convention.test.js test/task-dependency-single-source.test.js` (suites that read `tasks/lifecycle.md`). Report any failure; five known pre-existing unrelated failures in the full suite (`shared-id-resolution` (f), `skill-frontmatter-aliases` ×4) are out of scope — do not run the full suite as a gate.

### 7. Log and status  <!-- agent: general-purpose -->

- [x] Append one `edit` entry to `wiki/log.md` (`Read` the tail, then `Edit`): `## [2026-09-20] edit | TASK-0125 document pending-uat task status` with a one-sentence summary and the file list. Do not touch `hot.md` (the tackle epilogue refreshes it).

## Notes

- Scope fence: no change to `/tackle`, `/roadmap-next`, `/power-mode`, `UAT-CORE.md` or `/uat-skip` — they already handle `pending-uat`.
- The `pending-uat` status was discovered by the `/whats-next` research (`raw/research/whats-next/index.md`, finding on lifecycle drift); TASK-0126 hard-codes the enum and therefore depends on this task.
- Do not run `install-global.sh` (out of scope; the installed skill copy syncs on the next normal install).
- Step 5 sweep dispositions (2026-09-20):
  - Fixed: `CLAUDE.md:174` (tasks/lifecycle enum), `lib/prompts/migrate-wiki.md:85` (active tasks list), `lib/skills/primer/SKILL.md:78` (one line per `todo`/`in-progress`/`pending-uat` task).
  - Intentionally NOT changed: `lib/skills/uat-walk/UAT-CORE.md:155` (`todo|in-progress` sibling-task check before appending "decision fully implemented") — the scope fence forbids touching UAT-CORE.md, and a `pending-uat` sibling is already fully implemented, so the check is arguably correct as written. Flag for a separate look if desired.
  - Not task-status lists (no change): `migrate-wiki.md:31` (legacy `.docs` initial-status mapping), tackle/roadmap-next/power-mode/uat-skip/task-create references (already handle `pending-uat` or are creation/transition examples), adr-deprecate/prd-deprecate example rows, UAT-CORE.md:114 (test-runner markers), `lib/hooks/lib/serena.js:761` (keyword stoplist), historical task/UAT/roadmap prose, `README.md` and `.serena/memories/` (no hits).
  - `wiki/work/uat/lifecycle.md` (and template): line 48 names only `done` and links to the tasks lifecycle — no enumeration, no change.
- Step 1: the live `tasks/lifecycle.md` already carried a "3-digit names" paragraph the template lacked; it was added to the template so the two copies are byte-identical (verified with `cmp`).
