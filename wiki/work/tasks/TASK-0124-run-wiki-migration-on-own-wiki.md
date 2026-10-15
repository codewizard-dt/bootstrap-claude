---
id: TASK-0124
aliases: [TASK-0124]
title: "Run the PRD/ADR/un-archive migration on this repo's own wiki and verify it"
status: todo
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0123]
blocks: []
parallel_safe_with: []
uat: ""
tags: [migration, wiki-lint, operational, roadmap-0014-phase-4]
---

# TASK-0124 — Run the PRD/ADR/un-archive migration on this repo's own wiki and verify it

relates_to::[[wiki-skill-boilerplate-duplication]]
depends_on::[[TASK-0123]]

## Objective

Apply the idempotent migration step delivered by [[TASK-0123]] (the `update-project.sh` migration script) to **this repository's own `wiki/`** as its first real use: rename `REQ-`/`DEC-` items to `PRD-`/`ADR-` (old ID kept in `aliases:`), rewrite live `[[REQ-…]]`/`[[DEC-…]]` links and typed links, rename `linked_requirements`/`linked_decisions` to `linked_prds`/`linked_adrs`, and un-archive the roadmaps, decisions and requirements `archive/` folders into Active/Closed family-index sections. Then prove the result: old IDs still resolve, nothing dangles, `wiki/log.md` and `raw/` are preserved, the family layout matches the ROADMAP-0014 decisions, and the test suite shows no new failures. This is the last item of ROADMAP-0014 Phase 4 (the operational one) and follows [[TASK-0123]]. It is an **operational** task: it changes no skill, script, or template source, only the repo's own `wiki/` content (plus, if a test hard-codes a migrated path, that constant).

## Approach

**Binding decisions.** The 2026-09-19 Q&A items 1-8 and the Phase 4 sequencing note in `wiki/work/roadmaps/ROADMAP-0014-wiki-skill-deduplication-fixes.md` (Notes) govern. In particular: IDs `PRD-`/`ADR-` with old IDs in `aliases:`; directories keep their names; the migration leaves `raw/` untouched and does not edit or reorder existing `wiki/log.md` entries (old IDs there resolve through `aliases:`); tasks, UAT and bugs keep `archive/`.

**Do not commit.** This task never runs `git commit`, `git add`, or any history-changing command. Whether to take a checkpoint commit before the real run is **the user's decision**. The tree is already heavily dirty (other in-flight tasks), so this task cannot assume a clean checkpoint; it takes its own filesystem backup instead (Step 2), and rollback is defined against that backup.

**Run in a quiet window.** The migration rewrites files across `wiki/`. Other agents (`tackle-*`, `uat-*`, `task-create-*`) append to `wiki/log.md` and edit task/UAT/index files concurrently, so run Steps 3-4 only when no other agent is writing under `wiki/` (confirm with the team lead). Concurrent writers can make the rollback backup stale and confuse the verification diffs.

**Log handling (read carefully).** The migration script writes its own `wiki/log.md` entry. "`wiki/log.md` unchanged" therefore means: the pre-run bytes are a strict **prefix** of the post-run file (no existing entry was edited, reordered or removed), and everything after that prefix is new `## [date] <op> | …` entries only. This task does not hand-write a log entry unless the script failed to write one, in which case append one manually in the same format after the run, noting the fallback.

**Expected file counts (as of 2026-09-19; re-derive at run time, treat as a floor).**

| Family | Archived today | Expected after migration |
|--------|----------------|--------------------------|
| decisions | `archive/DEC-0001-wiki-cross-family-linking-schema.md`, `archive/index.md` | file lives at `wiki/work/decisions/ADR-0001-wiki-cross-family-linking-schema.md` (`id: ADR-0001`, `aliases` includes `DEC-0001`); `archive/` gone |
| requirements | `archive/index.md` only (no archived REQ items; no live REQ items) | zero renames; `archive/` gone; index gains Active + Closed sections |
| roadmaps | 9 archived: ROADMAP-002 to ROADMAP-010, plus `archive/index.md` | all 9 back in `wiki/work/roadmaps/`, IDs unchanged; `archive/` gone; live: 001, 011, 012, 0013, 0014 (plus any added since) |

**Stop-and-report rule.** After the dry run, compare the plan against the table above and against a fresh inventory (Step 1). If the plan shows a rename/move/rewrite count that is lower than the inventory, or any file the script proposes to touch under `raw/`, or any change to existing `wiki/log.md` lines, or a touch of `wiki/work/tasks|uat|bugs/archive/`, or any file count that cannot be explained by the inventory: **stop, make no changes, and report the discrepancy to the team lead/user.** Do not "fix the script" inside this task; a script defect goes back to [[TASK-0123]] (or a new bug via `/bug-create`).

**Rollback (documented before it is needed).**

1. The script is **idempotent**: after a partial or interrupted run, re-running it converges to the same end state, so the first recovery attempt is simply to re-run it (dry run first).
2. To fully undo, restore from the Step 2 backup, not `git checkout` on the whole tree (that would destroy other agents' uncommitted work):
   - `rsync -a --delete <scratchpad>/wiki-backup/wiki/ wiki/` and `rsync -a --delete <scratchpad>/wiki-backup/raw/ raw/`.
   - If `git status --porcelain -- wiki raw` was **empty** when the backup was taken (recorded in Step 2), the simpler equivalent is `git restore --source=HEAD --staged --worktree -- wiki raw && git clean -fd -- wiki`.
   - Verify with `diff -r <scratchpad>/wiki-backup/wiki wiki` (no output) and `git status --porcelain -- wiki raw` matching the Step 2 baseline.
3. Never run `git checkout .`, `git reset --hard`, or `git clean` on the repo root.

## Steps

### 1. Preflight and inventory  <!-- agent: Explore -->

- [ ] Read [[TASK-0123]] and the migration script it delivered; record the script path, its flags (`--dry-run`), and how it reports plan counts. Confirm TASK-0123 is `done` (or implemented) and its tests pass; if the script does not exist, stop and report.
- [ ] Read the ROADMAP-0014 Notes (Q&A items 1-8 and the sequencing note) so the run is checked against the binding decisions.
- [ ] Inventory with `mcp__serena__list_dir` on `wiki/work/requirements`, `wiki/work/decisions`, `wiki/work/roadmaps` (recursive) and count: requirement items, decision files (live + archived), archived roadmaps. Compare with the table in Approach and record the numbers.
- [ ] Baseline searches (record counts; use `mcp__serena__search_for_pattern`, excluding `wiki/log.md` and `raw/`): `\[\[(REQ|DEC)-` , `linked_requirements|linked_decisions`, and `aliases:` lines in the decision/requirement/roadmap files.
- [ ] Baseline `/wiki-lint` run on the **pre-migration** wiki (read-only; approve no fixes). Save the findings list so post-migration findings can be split into "pre-existing" and "introduced by migration".
- [ ] Baseline test run: `npm test`. Record failing tests. Only these are the known pre-existing failures: `skill-frontmatter-aliases` (x4) and `task-typed-links` (x1), unless earlier tasks already fixed them.
- [ ] Ask the team lead to confirm no other agent is writing under `wiki/` (quiet window) and that the user has made their checkpoint-commit decision. Do not commit on their behalf.

### 2. Backup and baseline snapshot  <!-- agent: general-purpose -->

- [ ] Record `git status --porcelain -- wiki raw` and `git diff --stat -- wiki/log.md raw` into `<scratchpad>/pre-run-status.txt` (scratchpad directory from the system prompt, never `/tmp`).
- [ ] Copy the trees outside the repo: `cp -R wiki <scratchpad>/wiki-backup/wiki` and `cp -R raw <scratchpad>/wiki-backup/raw`. Also record `wc -c wiki/log.md` and `shasum -a 256 wiki/log.md` for the prefix check in Step 5.
- [ ] Confirm the backup with `diff -r wiki <scratchpad>/wiki-backup/wiki` (no output).

### 3. Dry run and plan review  <!-- agent: general-purpose -->

- [ ] Run the script with `--dry-run` from the repo root (the invocation recorded in Step 1, for example via `npx @codewizard-dt/bootstrap update` migration mode or the script directly). Save the full output to `<scratchpad>/dry-run.txt`.
- [ ] Review the plan against the Approach table and the inventory: DEC-0001 renamed and un-archived; nine roadmaps un-archived; three `archive/` dirs removed; `archive/index.md` contents folded into each family index's Closed section; link/typed-link rewrites and `linked_*` field renames counted; **zero** proposed changes under `raw/`; **no** edits to existing `wiki/log.md` lines; tasks/UAT/bugs archives untouched.
- [ ] Apply the **stop-and-report rule**. If anything is unexpected, send the discrepancy to the team lead and stop here. Otherwise write a one-paragraph plan summary into the final report.

### 4. Real run  <!-- agent: general-purpose -->

- [ ] Run the script for real (same invocation, no `--dry-run`). Save output to `<scratchpad>/real-run.txt`. Do not run `install-global.sh`, and do not commit.
- [ ] If the run fails part-way, apply Rollback step 1 (re-run; it is idempotent) before considering step 2.
- [ ] Re-run with `--dry-run` immediately after: it must report nothing left to do (proves idempotency on the real data).

### 5. Verify  <!-- agent: general-purpose -->

Run every check; a failure of any one triggers the rollback decision (report to the team lead, do not improvise fixes).

- [ ] **Lint.** Run `/wiki-lint` (read-only, approve no fixes). It must include the typed-link resolution check 2.11 from [[TASK-0092]]: every `rel::[[target]]` must resolve, and old `DEC-`/`REQ-` targets must resolve via `aliases:`. Diff findings against the Step 1 baseline: no finding introduced by the migration.
- [ ] **Dangling links.** `mcp__serena__search_for_pattern` for `\[\[(REQ|DEC)-` over `wiki/**` excluding `wiki/log.md` and `raw/`. Every remaining hit must be classified as either (a) resolves through an `aliases:` entry, or (b) documentation inside a code span/fence describing the migration (expected in ROADMAP-0014 and the task files for the migration itself). Any hit that is a live link to a non-existent target is a failure.
- [ ] **Old fields gone.** Search `linked_requirements|linked_decisions` over `wiki/**` (excluding `wiki/log.md`): live frontmatter must use `linked_prds`/`linked_adrs`; remaining hits must be documentation only.
- [ ] **Alias check.** Confirm `wiki/work/decisions/ADR-0001-wiki-cross-family-linking-schema.md` has `id: ADR-0001` and `aliases` containing both `ADR-0001` and `DEC-0001`, and that `[[DEC-0001]]`-style references in live files still resolve to it (lint 2.11 covers this; spot-check ROADMAP-0014's former `linked_decisions` field).
- [ ] **`raw/` byte-unchanged.** `diff -r <scratchpad>/wiki-backup/raw raw` is empty, and `git diff --stat -- raw` equals the Step 2 baseline.
- [ ] **`wiki/log.md` preserved.** `cmp -n <bytes-recorded-in-Step-2> <scratchpad>/wiki-backup/wiki/log.md wiki/log.md` reports no difference (pre-run bytes are an exact prefix), and the appended tail contains only new `## [date] …` entries, including the script's own migration entry. Compare `git diff --stat -- wiki/log.md` before/after: insertions only, zero deletions attributable to this task.
- [ ] **Archive dirs gone.** `mcp__serena__list_dir` confirms `wiki/work/roadmaps/archive`, `wiki/work/decisions/archive` and `wiki/work/requirements/archive` no longer exist; the nine roadmaps and the ADR file are present in their family directories; `wiki/work/tasks/archive`, `wiki/work/uat/archive` and `wiki/work/bugs/archive` are still present and untouched.
- [ ] **Family indexes.** Read `wiki/work/roadmaps/index.md`, `wiki/work/decisions/index.md`, `wiki/work/requirements/index.md`: each has an **Active** section and a **Closed** section, the folded archive entries appear under Closed with working links, and no index links into a removed `archive/` path.
- [ ] **Top-level indexes.** `wiki/index.md` and any other live page that linked archive paths (for example `roadmaps/archive/...` or `decisions/archive/...`) now point at the un-archived locations (search `/archive/` over `wiki/**` excluding `wiki/log.md` and the three preserved family archives).
- [ ] **Tests.** `npm test`. Allowed failures: exactly the known pre-existing ones (`skill-frontmatter-aliases` x4, `task-typed-links` x1) unless earlier tasks fixed them. A failing test that hard-codes a migrated wiki path or ID may be repaired only by updating that path constant (no assertion weakened); list every such edit in the report. Any other new failure means stop and report.
- [ ] **Working tree scope.** `git status --porcelain` shows changes under `wiki/` only from this task (plus test-constant repairs above); no changes under `lib/`, `bin/`, or `raw/` were caused by it.

### 6. Report  <!-- agent: general-purpose -->

- [ ] Report to the team lead/user: script path and invocation, dry-run plan summary, counts (renamed, un-archived, links rewritten, fields renamed), the lint result vs. baseline, the dangling-link classification, the test result vs. baseline, the log/raw preservation evidence, and the rollback command set (backup location). State plainly that nothing was committed.
- [ ] Confirm the migration's own `wiki/log.md` entry exists; if the script wrote none, append the fallback entry now (format `## [YYYY-MM-DD] migrate | PRD/ADR migration on this repo's wiki`, 1-3 sentences, noting it was appended by TASK-0124).
- [ ] Do not delete the Step 2 backup until the user has reviewed and committed the result; note its path in the report.
